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
  writeSseData,
  writeSseDone,
  isAbortError,
  readUpstreamDeltas,
  safeJson,
  redactHeaders,
} from '../../../utils/utils';
import {
  normalizeMessagesToBlackboxShape,
  sendOpenAIError,
  makeChatCompletionChunk,
  buildToolSystemPrompt,
  detectToolCall,
} from '../../../services/openai';
import {
  buildBlackboxPayload,
  callBlackboxAPIJson,
  callBlackboxAPIStream,
} from '../../../api/blackboxai';

export const chatCompletions = async (req: Request, res: Response) => {
  const startTime = Date.now();
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

  const maxTokens =
    Number.isFinite(Number(body.max_tokens)) && Number(body.max_tokens) > 0
      ? Number(body.max_tokens)
      : MAX_TOKENS_DEFAULT;

  // ツール定義がある場合、システムプロンプトにツール使用方法を注入する
  const openAiMessages = Array.isArray(body.messages) ? [...body.messages] : [];
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
  const messages = normalizeMessagesToBlackboxShape(
    openAiMessages,
    resolved.name
  );

  if (messages.length === 0) {
    return sendOpenAIError(
      res,
      400,
      'messages must be a non-empty array of {role, content}',
      'invalid_messages'
    );
  }

  const payload = buildBlackboxPayload({
    chatId,
    agentMode: { ...resolved },
    messages,
    maxTokens,
  });

  logDebug(
    DEBUG_LOG,
    `[${reqId}] [CHAT] resolvedModel=${resolved.name} messages=${messages.length} chatId=${chatId} maxTokens=${maxTokens} stream=${Boolean(
      body.stream
    )}`
  );

  if (body.stream === true) {
    setSseHeaders(res);

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const completionId = `chatcmpl_${genId()}`;
    const created = nowUnix();

    // 初期チャンク（role確立用）
    writeSseData(
      res,
      makeChatCompletionChunk({
        id: completionId,
        model: resolved.name,
        created,
        contentDelta: '',
        finishReason: null,
      })
    );

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
      if (upstream.body) {
        for await (const delta of readUpstreamDeltas(
          upstream.body.getReader()
        )) {
          fullText += delta;
        }
      }

      const processedText = fullText
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();
      const toolCall = detectToolCall(processedText, body.tools ?? []);

      if (toolCall) {
        writeSseData(res, {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model: resolved.name,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: `call_${genId()}`,
                    type: 'function',
                    function: {
                      name: toolCall.name,
                      arguments: toolCall.arguments,
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        });
      } else {
        writeSseData(
          res,
          makeChatCompletionChunk({
            id: completionId,
            model: resolved.name,
            created,
            contentDelta: processedText,
            finishReason: 'stop',
          })
        );
      }

      writeSseDone(res);
      return res.end();
    } catch (error: any) {
      if (isAbortError(error)) return;
      console.error(`[${reqId}] [/v1/chat/completions stream] Error:`, error);
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ error: { message: error?.message ?? 'Unknown error', type: 'internal_server_error', code: error?.status ? `upstream_${error.status}` : null } })}\n\n`
        );
        writeSseDone(res);
        return res.end();
      }
    }
    return;
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
    const processedText = aiText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
    const toolCall = detectToolCall(processedText, body.tools ?? []);

    if (toolCall) {
      return res.json({
        id: `chatcmpl_${genId()}`,
        object: 'chat.completion',
        created: nowUnix(),
        model: resolved.name,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: `call_${genId()}`,
                  type: 'function',
                  function: {
                    name: toolCall.name,
                    arguments: toolCall.arguments,
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        proxy: {
          responseTimeSec: Number(((Date.now() - startTime) / 1000).toFixed(1)),
          raw: data,
        },
      });
    }

    return res.json({
      id: `chatcmpl_${genId()}`,
      object: 'chat.completion',
      created: nowUnix(),
      model: resolved.name,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: processedText },
          finish_reason: 'stop',
        },
      ],
      proxy: {
        responseTimeSec: Number(((Date.now() - startTime) / 1000).toFixed(1)),
        raw: data,
      },
    });
  } catch (error: any) {
    console.error(`[${reqId}] [/v1/chat/completions] Error:`, error);
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
