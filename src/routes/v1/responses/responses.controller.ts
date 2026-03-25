import { Request, Response } from 'express';
import { MAX_TOKENS_DEFAULT, DEBUG_MAX_CHARS } from '../../../configs/env';
import { MODEL_CONFIG } from '../../../configs/models';
import {
  ResponseParamsSchema,
  ResponsesBodySchema,
  ResponsesCompactBodySchema,
} from '../../../schemas/openai';
import {
  resolveModel,
  genId,
  genShortId,
  nowUnix,
  setSseHeaders,
  writeSseEvent,
  isAbortError,
  readUpstreamDeltas,
  safeJson,
  redactHeaders,
  extractRawAIResponse,
} from '../../../utils/utils';
import {
  coerceResponsesInputToArray,
  normalizeResponsesInputToOpenAiMessages,
  normalizeMessagesToBlackboxShape,
  sendOpenAIError,
  sendKnownRequestError,
  sendValidationError,
  buildToolSystemPrompt,
  detectToolCalls,
  extractThinkingSections,
  findFirstToolCallIndex,
  findFirstToolCallStartIndex,
} from '../../../services/openai';
import responsesStore from '../../../services/responses-store';
import blackboxChatService from '../../../services/blackbox-chat';
import logger from '../../../services/logger';

const getReasoningEffort = (body: any): string | null => {
  if (typeof body?.reasoning?.effort === 'string') return body.reasoning.effort;
  if (typeof body?.reasoning_effort === 'string') return body.reasoning_effort;
  return null;
};

const shouldIncludeReasoningSummary = (body: any): boolean => {
  const summary = body?.reasoning?.summary;
  return typeof summary === 'string' ? summary !== 'none' : false;
};

const shouldIncludeEncryptedReasoning = (body: any): boolean => {
  return Array.isArray(body?.include)
    ? body.include.includes('reasoning.encrypted_content')
    : false;
};

const buildReasoningItem = (
  reasoningText: string,
  includeEncryptedReasoning: boolean
) => {
  const trimmed = reasoningText.trim();
  if (!trimmed) return null;

  return {
    id: `rs_${genId()}`,
    type: 'reasoning',
    summary: [{ type: 'summary_text', text: trimmed }],
    content: [{ type: 'reasoning_text', text: trimmed }],
    encrypted_content: includeEncryptedReasoning ? trimmed : null,
  };
};

const buildMessageItem = (text: string) => ({
  id: `msg_${genId()}`,
  type: 'message',
  status: 'completed',
  role: 'assistant',
  content: [{ type: 'output_text', text, annotations: [] }],
});

const parseJsonObject = (input: string, fallback: any = {}) => {
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
};

const buildToolResponseItem = (toolCall: any) => {
  const callId = `call_${genId()}`;
  const kind = toolCall.kind ?? 'function';

  if (kind === 'custom') {
    return {
      outputItem: {
        id: `ctc_${genId()}`,
        type: 'custom_tool_call',
        status: 'completed',
        call_id: callId,
        name: toolCall.name,
        input: toolCall.arguments,
      },
      callId,
    };
  }

  if (kind === 'local_shell') {
    const payload = parseJsonObject(toolCall.arguments, {});
    return {
      outputItem: {
        type: 'local_shell_call',
        call_id: callId,
        status: 'completed',
        action: {
          type: 'exec',
          command: Array.isArray(payload.command) ? payload.command : [],
          timeout_ms:
            typeof payload.timeout_ms === 'number' ? payload.timeout_ms : null,
          working_directory:
            typeof payload.workdir === 'string' ? payload.workdir : null,
          env: null,
          user: null,
        },
      },
      callId,
    };
  }

  if (kind === 'tool_search') {
    return {
      outputItem: {
        id: `ts_${genId()}`,
        type: 'tool_search_call',
        call_id: callId,
        status: 'completed',
        execution: 'client',
        arguments: parseJsonObject(toolCall.arguments, {}),
      },
      callId,
    };
  }

  if (kind === 'web_search') {
    const payload = parseJsonObject(toolCall.arguments, {});
    return {
      outputItem: {
        id: `ws_${genId()}`,
        type: 'web_search_call',
        status: 'completed',
        action: {
          type: 'search',
          query:
            typeof payload.query === 'string'
              ? payload.query
              : Array.isArray(payload.queries)
                ? payload.queries[0] ?? null
                : null,
          queries: Array.isArray(payload.queries) ? payload.queries : null,
        },
      },
      callId,
    };
  }

  if (kind === 'image_generation') {
    const payload = parseJsonObject(toolCall.arguments, {});
    return {
      outputItem: {
        id: `ig_${genId()}`,
        type: 'image_generation_call',
        status: 'completed',
        revised_prompt:
          typeof payload.prompt === 'string' ? payload.prompt : undefined,
        result: '',
      },
      callId,
    };
  }

  return {
    outputItem: {
      id: `fc_${genId()}`,
      type: 'function_call',
      status: 'completed',
      name: toolCall.name,
      call_id: callId,
      arguments: toolCall.arguments,
    },
    callId,
  };
};

const buildResponseFromRawText = ({
  body,
  responseId,
  created,
  model,
  rawText,
}: {
  body: any;
  responseId: string;
  created: number;
  model: string;
  rawText: string;
}) => {
  const { visibleText, reasoningText } = extractThinkingSections(rawText);
  const outputItems: any[] = [];
  const reasoningItem = shouldIncludeReasoningSummary(body)
    ? buildReasoningItem(reasoningText, shouldIncludeEncryptedReasoning(body))
    : null;

  const toolCalls = detectToolCalls(visibleText, body.tools ?? []);

  if (toolCalls && toolCalls.length > 0) {
    const firstToolIndex = findFirstToolCallIndex(visibleText, body.tools ?? []);
    const messageText =
      firstToolIndex >= 0
        ? visibleText.slice(0, firstToolIndex).trimEnd()
        : '';

    if (messageText) {
      outputItems.push(buildMessageItem(messageText));
    }

    for (const toolCall of toolCalls) {
      outputItems.push(buildToolResponseItem(toolCall).outputItem);
    }
  } else if (visibleText) {
    outputItems.push(buildMessageItem(visibleText));
  }

  if (reasoningItem) {
    outputItems.push(reasoningItem);
  }

  return {
    id: responseId,
    object: 'response',
    created_at: created,
    status: 'completed',
    model,
    output: outputItems,
  };
};

const buildMessagesAndPayload = async ({
  body,
  fullInput,
  instructions,
  resolvedModel,
}: {
  body: any;
  fullInput: any[];
  instructions: string | null;
  resolvedModel: any;
}) => {
  const openAiMessages = normalizeResponsesInputToOpenAiMessages(
    fullInput,
    instructions
  );

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    const toolPrompt = buildToolSystemPrompt(body.tools, {
      parallelToolCalls: body.parallel_tool_calls,
      toolChoice: body.tool_choice,
    });
    if (toolPrompt) {
      const sysIdx = openAiMessages.findIndex((message) => message.role === 'system');
      if (sysIdx >= 0) {
        openAiMessages[sysIdx] = {
          ...openAiMessages[sysIdx],
          content: `${toolPrompt}\n\n${String(openAiMessages[sysIdx].content ?? '')}`,
        };
      } else {
        openAiMessages.unshift({ role: 'system', content: toolPrompt });
      }
    }
  }

  const messages = await normalizeMessagesToBlackboxShape(
    openAiMessages,
    resolvedModel.name
  );

  if (messages.length === 0) {
    const error: any = new Error('input must be a string or an array of messages');
    error.status = 400;
    error.code = 'invalid_input';
    throw error;
  }

  return blackboxChatService.buildPayload({
    chatId: genShortId(),
    agentMode: { ...resolvedModel },
    messages,
    maxTokens:
      typeof body.max_output_tokens === 'number'
        ? body.max_output_tokens
        : MAX_TOKENS_DEFAULT,
    reasoningMode:
      Boolean(getReasoningEffort(body)) || shouldIncludeReasoningSummary(body),
  });
};

const completeStoredResponse = (
  responseId: string,
  responseBody: any,
  completedAt: number
) => {
  responsesStore.completeRecord(responseId, responseBody.output ?? [], completedAt);
};

const runBackgroundResponse = async ({
  body,
  responseId,
  created,
  resolvedModel,
  reqId,
  fullInput,
  instructions,
}: {
  body: any;
  responseId: string;
  created: number;
  resolvedModel: any;
  reqId: string;
  fullInput: any[];
  instructions: string | null;
}) => {
  const abortController = new AbortController();
  responsesStore.attachAbortController(responseId, abortController);

  try {
    const payload = await buildMessagesAndPayload({
      body,
      fullInput,
      instructions,
      resolvedModel,
    });

    const data = await blackboxChatService.callJson(
      payload,
      { reqId, signal: abortController.signal },
      {
        safeJson,
        redactHeaders,
        DEBUG_MAX_CHARS,
      }
    );

    const rawText = extractRawAIResponse(data);
    const responseBody = buildResponseFromRawText({
      body,
      responseId,
      created,
      model: resolvedModel.name,
      rawText,
    });

    completeStoredResponse(responseId, responseBody, nowUnix());
  } catch (error: any) {
    if (isAbortError(error)) {
      responsesStore.failRecord(responseId, {
        message: 'Response was cancelled',
        type: 'cancelled',
        code: 'response_cancelled',
      }, 'cancelled');
      return;
    }

    logger.error(`[${reqId}] [/v1/responses background] Error:`, error);
    responsesStore.failRecord(responseId, {
      message: error?.message ?? 'Unknown error',
      type: 'internal_server_error',
      code: error?.status ? `upstream_${error.status}` : null,
      details: error?.details ?? null,
    });
  }
};

export const retrieveResponse = async (req: Request, res: Response) => {
  const responseParamsValidation = ResponseParamsSchema.safeParse(req.params);
  if (!responseParamsValidation.success) {
    return sendValidationError(res, responseParamsValidation.error.issues);
  }

  const record = responsesStore.getRecord(responseParamsValidation.data.responseId);
  if (!record) {
    return sendOpenAIError(res, 404, 'Response not found', 'response_not_found');
  }

  return res.json({
    id: record.id,
    object: record.object,
    created_at: record.created_at,
    completed_at: record.completed_at,
    status: record.status,
    model: record.model,
    output: record.output,
    error: record.error,
    previous_response_id: record.previous_response_id,
  });
};

export const cancelResponse = async (req: Request, res: Response) => {
  const responseParamsValidation = ResponseParamsSchema.safeParse(req.params);
  if (!responseParamsValidation.success) {
    return sendValidationError(res, responseParamsValidation.error.issues);
  }

  const record = responsesStore.cancel(responseParamsValidation.data.responseId);
  if (!record) {
    return sendOpenAIError(res, 404, 'Response not found', 'response_not_found');
  }

  return res.json({
    id: record.id,
    object: record.object,
    created_at: record.created_at,
    completed_at: record.completed_at,
    status: record.status,
    model: record.model,
    output: record.output,
    error: record.error,
    previous_response_id: record.previous_response_id,
  });
};

export const compact = async (req: Request, res: Response) => {
  const compactValidation = ResponsesCompactBodySchema.safeParse(req.body ?? {});
  if (!compactValidation.success) {
    return sendValidationError(res, compactValidation.error.issues);
  }

  const body = compactValidation.data;
  const reqId = req.reqId;

  const resolved = resolveModel(MODEL_CONFIG, body.model);
  if (!resolved) {
    return sendOpenAIError(
      res,
      400,
      `Model not allowed: ${String(body.model ?? '')}`,
      'model_not_allowed'
    );
  }

  try {
    const fullInput = coerceResponsesInputToArray(body.input);
    const summarizerInstructions =
      'Summarize the conversation context for a future coding turn. Preserve the user goal, constraints, file paths, unresolved issues, important tool results, and next steps. Keep it concise and factual.';

    const payload = await buildMessagesAndPayload({
      body: { ...body, tools: [] },
      fullInput,
      instructions: summarizerInstructions,
      resolvedModel: resolved,
    });

    const data = await blackboxChatService.callJson(
      payload,
      { reqId },
      {
        safeJson,
        redactHeaders,
        DEBUG_MAX_CHARS,
      }
    );

    const rawText = extractRawAIResponse(data);
    const summaryText = extractThinkingSections(rawText).visibleText || rawText.trim();
    const retainedItems = fullInput.filter((item) => {
      if (item?.type !== 'message') return false;
      return item.role === 'user' || item.role === 'developer';
    });

    return res.json({
      output: [
        ...retainedItems,
        {
          type: 'compaction',
          encrypted_content: summaryText,
        },
      ],
    });
  } catch (error: any) {
    const knownError = sendKnownRequestError(res, error);
    if (knownError) return knownError;

    logger.error(`[${reqId}] [/v1/responses/compact] Error:`, error);
    return res.status(500).json({
      error: {
        message: error?.message ?? 'Unknown error',
        type: 'internal_server_error',
        code: error?.status ? `upstream_${error.status}` : null,
        details: error?.details ?? null,
      },
    });
  }
};

export const responses = async (req: Request, res: Response) => {
  const responsesValidation = ResponsesBodySchema.safeParse(req.body ?? {});
  if (!responsesValidation.success) {
    return sendValidationError(res, responsesValidation.error.issues);
  }

  const body = responsesValidation.data;
  const reqId = req.reqId;

  const resolved = resolveModel(MODEL_CONFIG, body.model);
  if (!resolved) {
    return sendOpenAIError(
      res,
      400,
      `Model not allowed: ${String(body.model ?? '')}`,
      'model_not_allowed'
    );
  }

  let requestState;
  try {
    requestState = responsesStore.resolveRequestState(body);
  } catch (error: any) {
    return sendOpenAIError(
      res,
      error?.status ?? 404,
      error?.message ?? 'previous_response_id not found',
      error?.code ?? 'previous_response_not_found'
    );
  }

  const responseId = `resp_${genId()}`;
  const created = nowUnix();
  responsesStore.createPendingRecord({
    id: responseId,
    model: resolved.name,
    createdAt: created,
    instructions: requestState.instructions,
    previousResponseId: requestState.previous?.id ?? null,
    fullInput: requestState.fullInput,
    store: body.store !== false || body.background === true,
  });

  if (body.background === true && body.stream !== true) {
    void runBackgroundResponse({
      body,
      responseId,
      created,
      resolvedModel: resolved,
      reqId,
      fullInput: requestState.fullInput,
      instructions: requestState.instructions,
    });

    return res.json({
      id: responseId,
      object: 'response',
      created_at: created,
      completed_at: null,
      status: 'in_progress',
      model: resolved.name,
      output: [],
      error: null,
      previous_response_id: requestState.previous?.id ?? null,
    });
  }

  if (body.stream === true) {
    setSseHeaders(res);

    const abortController = new AbortController();
    responsesStore.attachAbortController(responseId, abortController);
    res.on('close', () => abortController.abort());

    writeSseEvent(res, 'response.created', {
      type: 'response.created',
      sequence_number: 0,
      response: {
        id: responseId,
        object: 'response',
        created_at: created,
        status: 'in_progress',
        completed_at: null,
        error: null,
        incomplete_details: null,
        instructions: requestState.instructions,
        max_output_tokens:
          typeof body.max_output_tokens === 'number' ? body.max_output_tokens : null,
        model: resolved.name,
        output: [],
        previous_response_id: requestState.previous?.id ?? null,
        reasoning_effort: getReasoningEffort(body),
        store: body.store !== false || body.background === true,
        temperature: typeof body.temperature === 'number' ? body.temperature : 1,
        text: body.text ?? { format: { type: 'text' } },
        tool_choice: body.tool_choice ?? 'auto',
        tools: Array.isArray(body.tools) ? body.tools : [],
      },
    });

    try {
      const payload = await buildMessagesAndPayload({
        body,
        fullInput: requestState.fullInput,
        instructions: requestState.instructions,
        resolvedModel: resolved,
      });

      const upstream = await blackboxChatService.callStream(
        payload,
        { reqId, signal: abortController.signal },
        {
          safeJson,
          redactHeaders,
          DEBUG_MAX_CHARS,
        }
      );

      let fullText = '';
      let emittedText = '';
      let hasStartedMessage = false;
      const outputItems: any[] = [];
      let seq = 1;
      const messageItemId = `msg_${genId()}`;

      const startMessageIfNeeded = () => {
        if (hasStartedMessage) return;
        hasStartedMessage = true;
        writeSseEvent(res, 'response.output_item.added', {
          type: 'response.output_item.added',
          output_index: outputItems.length,
          item: {
            id: messageItemId,
            type: 'message',
            status: 'in_progress',
            role: 'assistant',
            content: [],
          },
          sequence_number: seq++,
        });
        writeSseEvent(res, 'response.content_part.added', {
          type: 'response.content_part.added',
          item_id: messageItemId,
          output_index: outputItems.length,
          content_index: 0,
          part: { type: 'output_text', text: '', annotations: [] },
          sequence_number: seq++,
        });
      };

      if (upstream.body) {
        for await (const delta of readUpstreamDeltas(upstream.body.getReader())) {
          fullText += delta;
          const visibleText = extractThinkingSections(fullText).visibleText;
          const remainingText = visibleText.slice(emittedText.length);
          const firstToolIndex = findFirstToolCallStartIndex(
            remainingText,
            body.tools ?? []
          );

          if (firstToolIndex >= 0) {
            const safeText = remainingText.slice(0, firstToolIndex);
            if (safeText) {
              startMessageIfNeeded();
              writeSseEvent(res, 'response.output_text.delta', {
                type: 'response.output_text.delta',
                item_id: messageItemId,
                output_index: outputItems.length,
                content_index: 0,
                delta: safeText,
                sequence_number: seq++,
              });
              emittedText += safeText;
            }
            continue;
          }

          if (remainingText) {
            startMessageIfNeeded();
            writeSseEvent(res, 'response.output_text.delta', {
              type: 'response.output_text.delta',
              item_id: messageItemId,
              output_index: outputItems.length,
              content_index: 0,
              delta: remainingText,
              sequence_number: seq++,
            });
            emittedText += remainingText;
          }
        }
      }

      const { visibleText, reasoningText } = extractThinkingSections(fullText);
      const reasoningItem = shouldIncludeReasoningSummary(body)
        ? buildReasoningItem(reasoningText, shouldIncludeEncryptedReasoning(body))
        : null;

      const toolCalls = detectToolCalls(visibleText, body.tools ?? []);
      if (!toolCalls || toolCalls.length === 0) {
        const trailingText = visibleText.slice(emittedText.length);
        if (trailingText) {
          startMessageIfNeeded();
          writeSseEvent(res, 'response.output_text.delta', {
            type: 'response.output_text.delta',
            item_id: messageItemId,
            output_index: outputItems.length,
            content_index: 0,
            delta: trailingText,
            sequence_number: seq++,
          });
          emittedText += trailingText;
        }
      }

      if (hasStartedMessage && emittedText.trim()) {
        const messageItem = buildMessageItem(emittedText);
        messageItem.id = messageItemId;
        writeSseEvent(res, 'response.output_text.done', {
          type: 'response.output_text.done',
          item_id: messageItemId,
          output_index: outputItems.length,
          content_index: 0,
          text: emittedText,
          sequence_number: seq++,
        });
        writeSseEvent(res, 'response.content_part.done', {
          type: 'response.content_part.done',
          item_id: messageItemId,
          output_index: outputItems.length,
          content_index: 0,
          part: { type: 'output_text', text: emittedText, annotations: [] },
          sequence_number: seq++,
        });
        writeSseEvent(res, 'response.output_item.done', {
          type: 'response.output_item.done',
          output_index: outputItems.length,
          item: messageItem,
          sequence_number: seq++,
        });
        outputItems.push(messageItem);
      }

      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          const { outputItem } = buildToolResponseItem(toolCall);

          if (outputItem.type === 'function_call') {
            writeSseEvent(res, 'response.output_item.added', {
              type: 'response.output_item.added',
              output_index: outputItems.length,
              item: {
                ...outputItem,
                status: 'in_progress',
                arguments: '',
              },
              sequence_number: seq++,
            });
            writeSseEvent(res, 'response.function_call_arguments.delta', {
              type: 'response.function_call_arguments.delta',
              item_id: outputItem.id,
              output_index: outputItems.length,
              delta: outputItem.arguments,
              sequence_number: seq++,
            });
            writeSseEvent(res, 'response.function_call_arguments.done', {
              type: 'response.function_call_arguments.done',
              item_id: outputItem.id,
              name: outputItem.name,
              output_index: outputItems.length,
              arguments: outputItem.arguments,
              sequence_number: seq++,
            });
          }

          writeSseEvent(res, 'response.output_item.done', {
            type: 'response.output_item.done',
            output_index: outputItems.length,
            item: outputItem,
            sequence_number: seq++,
          });
          outputItems.push(outputItem);
        }
      } else if (!emittedText.trim() && visibleText) {
        const messageItem = buildMessageItem(visibleText);
        writeSseEvent(res, 'response.output_item.done', {
          type: 'response.output_item.done',
          output_index: outputItems.length,
          item: messageItem,
          sequence_number: seq++,
        });
        outputItems.push(messageItem);
      }

      if (reasoningItem) {
        writeSseEvent(res, 'response.output_item.done', {
          type: 'response.output_item.done',
          output_index: outputItems.length,
          item: reasoningItem,
          sequence_number: seq++,
        });
        outputItems.push(reasoningItem);
      }

      const responseBody = {
        id: responseId,
        object: 'response',
        created_at: created,
        status: 'completed',
        model: resolved.name,
        output: outputItems,
      };

      writeSseEvent(res, 'response.completed', {
        type: 'response.completed',
        sequence_number: seq++,
        response: responseBody,
      });

      completeStoredResponse(responseId, responseBody, nowUnix());
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (error: any) {
      if (isAbortError(error)) {
        responsesStore.failRecord(responseId, {
          message: 'Response was cancelled',
          type: 'cancelled',
          code: 'response_cancelled',
        }, 'cancelled');
        return;
      }

      logger.error(`[${reqId}] [/v1/responses stream] Error:`, error);
      responsesStore.failRecord(responseId, {
        message: error?.message ?? 'Unknown error',
        type: 'internal_server_error',
        code: error?.status ? `upstream_${error.status}` : null,
        details: error?.details ?? null,
      });

      if (!res.writableEnded) {
        writeSseEvent(res, 'response.failed', {
          type: 'response.failed',
          response: {
            id: responseId,
            object: 'response',
            created_at: created,
            status: 'failed',
            model: resolved.name,
            error: {
              message: error?.message ?? 'Unknown error',
              type: 'internal_server_error',
              code: error?.status ? `upstream_${error.status}` : null,
            },
          },
        });
        res.write('data: [DONE]\n\n');
        res.end();
      }
      return;
    }
  }

  try {
    const payload = await buildMessagesAndPayload({
      body,
      fullInput: requestState.fullInput,
      instructions: requestState.instructions,
      resolvedModel: resolved,
    });
    const data = await blackboxChatService.callJson(
      payload,
      { reqId },
      {
        safeJson,
        redactHeaders,
        DEBUG_MAX_CHARS,
      }
    );

    const rawText = extractRawAIResponse(data);
    const responseBody = buildResponseFromRawText({
      body,
      responseId,
      created,
      model: resolved.name,
      rawText,
    });

    completeStoredResponse(responseId, responseBody, nowUnix());
    return res.json(responseBody);
  } catch (error: any) {
    const knownError = sendKnownRequestError(res, error);
    if (knownError) return knownError;

    logger.error(`[${reqId}] [/v1/responses] Error:`, error);
    responsesStore.failRecord(responseId, {
      message: error?.message ?? 'Unknown error',
      type: 'internal_server_error',
      code: error?.status ? `upstream_${error.status}` : null,
      details: error?.details ?? null,
    });
    return res.status(500).json({
      error: {
        message: error?.message ?? 'Unknown error',
        type: 'internal_server_error',
        code: error?.status ? `upstream_${error.status}` : null,
        details: error?.details ?? null,
      },
    });
  }
};


