import { Request, Response } from 'express';
import {
  MAX_TOKENS_DEFAULT,
  DEBUG_LOG,
  DEBUG_MAX_CHARS,
} from '../../../configs/env';
import { MODEL_CONFIG } from '../../../configs/models';
import {
  resolveModel,
  genId,
  genShortId,
  logDebug,
  extractAIResponse,
  nowUnix,
  setSseHeaders,
  writeSseEvent,
  isAbortError,
  readUpstreamDeltas,
  safeJson,
  redactHeaders,
} from '../../../utils/utils';
import {
  normalizeResponsesBodyToOpenAiMessages,
  normalizeMessagesToBlackboxShape,
  sendOpenAIError,
  buildToolSystemPrompt,
  detectToolCall,
} from '../../../services/openai';
import {
  buildBlackboxPayload,
  callBlackboxAPIJson,
  callBlackboxAPIStream,
} from '../../../api/blackboxai';

export const responses = async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const reqId = (req as any).reqId ?? genId();

  const resolved = resolveModel(MODEL_CONFIG, body.model);
  if (!resolved) {
    return sendOpenAIError(
      res,
      400,
      `Model not allowed: ${String(body.model ?? '')}`,
      'model_not_allowed'
    );
  }

  const openAiMessages = normalizeResponsesBodyToOpenAiMessages(body);

  // ツール定義がある場合、システムプロンプトにツール使用方法を注入する
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    const toolPrompt = buildToolSystemPrompt(body.tools);
    if (toolPrompt) {
      const sysIdx = openAiMessages.findIndex((m) => m.role === 'system');
      if (sysIdx >= 0) {
        openAiMessages[sysIdx] = {
          ...openAiMessages[sysIdx],
          content: toolPrompt + '\n\n' + openAiMessages[sysIdx].content,
        };
      } else {
        openAiMessages.unshift({ role: 'system', content: toolPrompt });
      }
    }
  }

  const chatId = genShortId();
  const messages = await normalizeMessagesToBlackboxShape(
    openAiMessages,
    resolved.name
  );

  if (messages.length === 0) {
    return sendOpenAIError(
      res,
      400,
      'input must be a string or an array of messages',
      'invalid_input'
    );
  }

  const payload = buildBlackboxPayload({
    chatId,
    agentMode: { ...resolved },
    messages,
    maxTokens: MAX_TOKENS_DEFAULT,
  });

  logDebug(
    DEBUG_LOG,
    `[${reqId}] [RESPONSES] resolvedModel=${resolved.name} messages=${messages.length} chatId=${chatId} stream=${Boolean(
      body.stream
    )}`
  );

  if (body.stream === true) {
    setSseHeaders(res);

    const abortController = new AbortController();
    res.on('close', () => abortController.abort());

    const responseId = `resp_${genId()}`;
    const created = nowUnix();
    const outputIndex = 0;

    // response.created を送信（status: in_progress）
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
        instructions:
          typeof body.instructions === 'string' ? body.instructions : null,
        max_output_tokens: null,
        model: resolved.name,
        output: [],
        previous_response_id: null,
        reasoning_effort: null,
        store: false,
        temperature: 1,
        text: { format: { type: 'text' } },
        tool_choice: body.tool_choice ?? 'auto',
        tools: Array.isArray(body.tools) ? body.tools : [],
      },
    });

    try {
      const upstream = await callBlackboxAPIStream(
        payload,
        { reqId, signal: abortController.signal },
        {
          logDebug: (...args: any[]) => logDebug(DEBUG_LOG, ...args),
          safeJson,
          redactHeaders,
          DEBUG_MAX_CHARS,
        }
      );

      let fullText = '';
      let isToolCallCandidate = true;
      let isStreamingText = false;
      let inThinkBlock = false;
      const itemId = `msg_${genId()}`;
      const contentIndex = 0;
      let seq = 1;

      if (upstream.body) {
        for await (const delta of readUpstreamDeltas(
          upstream.body.getReader()
        )) {
          const chunk = delta as string;
          fullText += chunk;

          if (isStreamingText) {
            writeSseEvent(res, 'response.output_text.delta', {
              type: 'response.output_text.delta',
              item_id: itemId,
              output_index: outputIndex,
              content_index: contentIndex,
              delta: chunk,
              sequence_number: seq++,
            });
            continue;
          }

          // <think> ブロックの簡易判定
          if (fullText.includes('<think>') && !fullText.includes('</think>')) {
            inThinkBlock = true;
            continue;
          } else if (fullText.includes('</think>')) {
            inThinkBlock = false;
          }

          if (inThinkBlock) continue;

          const processedText = fullText
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .trim();

          // まだテキストが十分にない場合は判定を保留
          if (processedText.length < 5) continue;

          // ツールコールの候補かどうかの判定
          if (
            processedText.startsWith('{') ||
            processedText.startsWith('[Tool call:') ||
            processedText.startsWith('```')
          ) {
            // ツールコールの可能性が高いのでバッファリングを継続
            isToolCallCandidate = true;
          } else {
            // 通常のテキストメッセージと判定
            isToolCallCandidate = false;
            isStreamingText = true;

            // 1. response.output_item.added (message)
            writeSseEvent(res, 'response.output_item.added', {
              type: 'response.output_item.added',
              output_index: outputIndex,
              item: {
                id: itemId,
                type: 'message',
                status: 'in_progress',
                role: 'assistant',
                content: [],
              },
              sequence_number: seq++,
            });

            // 2. response.content_part.added
            writeSseEvent(res, 'response.content_part.added', {
              type: 'response.content_part.added',
              item_id: itemId,
              output_index: outputIndex,
              content_index: contentIndex,
              part: { type: 'output_text', text: '', annotations: [] },
              sequence_number: seq++,
            });

            // 3. 蓄積していたテキストを送信
            if (processedText) {
              writeSseEvent(res, 'response.output_text.delta', {
                type: 'response.output_text.delta',
                item_id: itemId,
                output_index: outputIndex,
                content_index: contentIndex,
                delta: processedText,
                sequence_number: seq++,
              });
            }
          }
        }
      }

      if (isToolCallCandidate) {
        const processedText = fullText
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();
        const toolCall = detectToolCall(processedText, body.tools ?? []);

        if (toolCall) {
          // ===== function_call イベントシーケンス（OpenAI Responses API 仕様準拠）=====
          const fcId = `fc_${genId()}`;
          const callId = `call_${genId()}`;
          const argsStr = toolCall.arguments;
          let seq = 1;

          // 1. response.output_item.added (function_call, in_progress)
          writeSseEvent(res, 'response.output_item.added', {
            type: 'response.output_item.added',
            output_index: outputIndex,
            item: {
              id: fcId,
              type: 'function_call',
              status: 'in_progress',
              name: toolCall.name,
              call_id: callId,
              arguments: '',
            },
            sequence_number: seq++,
          });

          // 2. response.function_call_arguments.delta
          writeSseEvent(res, 'response.function_call_arguments.delta', {
            type: 'response.function_call_arguments.delta',
            item_id: fcId,
            output_index: outputIndex,
            delta: argsStr,
            sequence_number: seq++,
          });

          // 3. response.function_call_arguments.done
          writeSseEvent(res, 'response.function_call_arguments.done', {
            type: 'response.function_call_arguments.done',
            item_id: fcId,
            name: toolCall.name,
            output_index: outputIndex,
            arguments: argsStr,
            sequence_number: seq++,
          });

          // 4. response.output_item.done (function_call, completed)
          writeSseEvent(res, 'response.output_item.done', {
            type: 'response.output_item.done',
            output_index: outputIndex,
            item: {
              id: fcId,
              type: 'function_call',
              status: 'completed',
              name: toolCall.name,
              call_id: callId,
              arguments: argsStr,
            },
            sequence_number: seq++,
          });

          // 5. response.completed
          writeSseEvent(res, 'response.completed', {
            type: 'response.completed',
            sequence_number: seq++,
            response: {
              id: responseId,
              object: 'response',
              created_at: created,
              status: 'completed',
              model: resolved.name,
              output: [
                {
                  id: fcId,
                  type: 'function_call',
                  status: 'completed',
                  name: toolCall.name,
                  call_id: callId,
                  arguments: argsStr,
                },
              ],
            },
          });
        } else {
          // ツールコール候補だったが、最終的にツールコールとして検出されなかった場合
          // 1. response.output_item.added (message)
          writeSseEvent(res, 'response.output_item.added', {
            type: 'response.output_item.added',
            output_index: outputIndex,
            item: {
              id: itemId,
              type: 'message',
              status: 'in_progress',
              role: 'assistant',
              content: [],
            },
            sequence_number: seq++,
          });

          // 2. response.content_part.added
          writeSseEvent(res, 'response.content_part.added', {
            type: 'response.content_part.added',
            item_id: itemId,
            output_index: outputIndex,
            content_index: contentIndex,
            part: { type: 'output_text', text: '', annotations: [] },
            sequence_number: seq++,
          });

          // 3. response.output_text.delta（バッファ済みテキストを一括送信）
          if (processedText) {
            writeSseEvent(res, 'response.output_text.delta', {
              type: 'response.output_text.delta',
              item_id: itemId,
              output_index: outputIndex,
              content_index: contentIndex,
              delta: processedText,
              sequence_number: seq++,
            });
          }

          // 4. response.output_text.done
          writeSseEvent(res, 'response.output_text.done', {
            type: 'response.output_text.done',
            item_id: itemId,
            output_index: outputIndex,
            content_index: contentIndex,
            text: processedText,
            sequence_number: seq++,
          });

          // 5. response.content_part.done
          writeSseEvent(res, 'response.content_part.done', {
            type: 'response.content_part.done',
            item_id: itemId,
            output_index: outputIndex,
            content_index: contentIndex,
            part: { type: 'output_text', text: processedText, annotations: [] },
            sequence_number: seq++,
          });

          // 6. response.output_item.done (message, completed)
          writeSseEvent(res, 'response.output_item.done', {
            type: 'response.output_item.done',
            output_index: outputIndex,
            item: {
              id: itemId,
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                { type: 'output_text', text: processedText, annotations: [] },
              ],
            },
            sequence_number: seq++,
          });

          // 7. response.completed
          writeSseEvent(res, 'response.completed', {
            type: 'response.completed',
            sequence_number: seq++,
            response: {
              id: responseId,
              object: 'response',
              created_at: created,
              status: 'completed',
              model: resolved.name,
              output: [
                {
                  id: itemId,
                  type: 'message',
                  status: 'completed',
                  role: 'assistant',
                  content: [
                    {
                      type: 'output_text',
                      text: processedText,
                      annotations: [],
                    },
                  ],
                },
              ],
            },
          });
        }
      } else {
        // 通常のテキストストリーミングの終了処理
        const processedText = fullText
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();

        // 4. response.output_text.done
        writeSseEvent(res, 'response.output_text.done', {
          type: 'response.output_text.done',
          item_id: itemId,
          output_index: outputIndex,
          content_index: contentIndex,
          text: processedText,
          sequence_number: seq++,
        });

        // 5. response.content_part.done
        writeSseEvent(res, 'response.content_part.done', {
          type: 'response.content_part.done',
          item_id: itemId,
          output_index: outputIndex,
          content_index: contentIndex,
          part: { type: 'output_text', text: processedText, annotations: [] },
          sequence_number: seq++,
        });

        // 6. response.output_item.done (message, completed)
        writeSseEvent(res, 'response.output_item.done', {
          type: 'response.output_item.done',
          output_index: outputIndex,
          item: {
            id: itemId,
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [
              { type: 'output_text', text: processedText, annotations: [] },
            ],
          },
          sequence_number: seq++,
        });

        // 7. response.completed
        writeSseEvent(res, 'response.completed', {
          type: 'response.completed',
          sequence_number: seq++,
          response: {
            id: responseId,
            object: 'response',
            created_at: created,
            status: 'completed',
            model: resolved.name,
            output: [
              {
                id: itemId,
                type: 'message',
                status: 'completed',
                role: 'assistant',
                content: [
                  { type: 'output_text', text: processedText, annotations: [] },
                ],
              },
            ],
          },
        });
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (error: any) {
      if (isAbortError(error)) {
        logDebug(
          DEBUG_LOG,
          `[${reqId}] [/v1/responses stream] aborted by client`
        );
        return;
      }

      console.error(`[${reqId}] [/v1/responses stream] Error:`, error);

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
    const data = await callBlackboxAPIJson(
      payload,
      { reqId },
      {
        logDebug: (...args: any[]) => logDebug(DEBUG_LOG, ...args),
        safeJson,
        redactHeaders,
        DEBUG_MAX_CHARS,
      }
    );
    const aiText = extractAIResponse(data, DEBUG_MAX_CHARS);

    // ツールコール検出（非ストリーミング）
    const processedText = aiText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
    const toolCall = detectToolCall(processedText, body.tools ?? []);
    if (toolCall) {
      // ===== function_call レスポンス（OpenAI Responses API 仕様準拠）=====
      const fcId = `fc_${genId()}`;
      const callId = `call_${genId()}`;
      return res.json({
        id: `resp_${genId()}`,
        object: 'response',
        created_at: nowUnix(),
        status: 'completed',
        model: resolved.name,
        output: [
          {
            type: 'function_call',
            id: fcId,
            call_id: callId,
            name: toolCall.name,
            arguments: toolCall.arguments,
            status: 'completed',
          },
        ],
      });
    }

    // 通常テキストレスポンス
    return res.json({
      id: `resp_${genId()}`,
      object: 'response',
      created_at: nowUnix(),
      status: 'completed',
      model: resolved.name,
      output: [
        {
          id: `msg_${genId()}`,
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text: aiText, annotations: [] }],
        },
      ],
    });
  } catch (error: any) {
    console.error(`[${reqId}] [/v1/responses] Error:`, error);
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
