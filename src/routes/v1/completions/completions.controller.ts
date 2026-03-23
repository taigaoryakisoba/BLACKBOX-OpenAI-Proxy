import { Request, Response } from 'express';
import {
  MAX_TOKENS_DEFAULT,
  DEBUG_MAX_CHARS,
} from '../../../configs/env';
import { MODEL_CONFIG } from '../../../configs/models';
import {
  resolveModel,
  genId,
  genShortId,
  extractRawAIResponse,
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
  makeCompletionChunk,
} from '../../../services/openai';
import blackboxChatService from '../../../services/blackbox-chat';
import logger from '../../../services/logger';

const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi;

const stripThinkBlocks = (text: string): string => text.replace(THINK_BLOCK_RE, '');

const normalizePrompt = (
  prompt: any
): { promptText: string | null; errorMessage?: string; errorCode?: string } => {
  if (typeof prompt === 'string') {
    if (prompt.length === 0) {
      return {
        promptText: null,
        errorMessage: 'prompt must be a non-empty string',
        errorCode: 'invalid_prompt',
      };
    }
    return { promptText: prompt };
  }

  if (!Array.isArray(prompt)) {
    return {
      promptText: null,
      errorMessage: 'prompt must be a string or a single-item string array',
      errorCode: 'invalid_prompt',
    };
  }

  if (prompt.length === 0) {
    return {
      promptText: null,
      errorMessage: 'prompt array must contain exactly one string',
      errorCode: 'invalid_prompt',
    };
  }

  if (prompt.every((item) => typeof item === 'string')) {
    if (prompt.length !== 1) {
      return {
        promptText: null,
        errorMessage: 'prompt arrays with multiple items are not supported',
        errorCode: 'unsupported_parameter',
      };
    }

    if (prompt[0].length === 0) {
      return {
        promptText: null,
        errorMessage: 'prompt must be a non-empty string',
        errorCode: 'invalid_prompt',
      };
    }

    return { promptText: prompt[0] };
  }

  return {
    promptText: null,
    errorMessage: 'tokenized prompts are not supported on this proxy',
    errorCode: 'unsupported_parameter',
  };
};

const normalizeStopSequences = (
  stop: any
): { stopSequences: string[]; errorMessage?: string; errorCode?: string } => {
  if (stop == null) return { stopSequences: [] };

  if (typeof stop === 'string') {
    return { stopSequences: stop.length > 0 ? [stop] : [] };
  }

  if (Array.isArray(stop) && stop.every((item) => typeof item === 'string')) {
    return { stopSequences: stop.filter((item) => item.length > 0) };
  }

  return {
    stopSequences: [],
    errorMessage: 'stop must be a string or array of strings',
    errorCode: 'invalid_stop',
  };
};

const getUnsupportedParameterError = (
  body: any
): { message: string; code: string } | null => {
  if (
    typeof body.n !== 'undefined' &&
    Number.isFinite(Number(body.n)) &&
    Number(body.n) !== 1
  ) {
    return {
      message: 'n > 1 is not supported on this proxy',
      code: 'unsupported_parameter',
    };
  }

  if (
    typeof body.best_of !== 'undefined' &&
    Number.isFinite(Number(body.best_of)) &&
    Number(body.best_of) !== 1
  ) {
    return {
      message: 'best_of > 1 is not supported on this proxy',
      code: 'unsupported_parameter',
    };
  }

  if (typeof body.suffix !== 'undefined' && body.suffix !== null) {
    return {
      message: 'suffix is not supported on this proxy',
      code: 'unsupported_parameter',
    };
  }

  if (typeof body.logprobs !== 'undefined' && body.logprobs !== null) {
    return {
      message: 'logprobs is not supported on this proxy',
      code: 'unsupported_parameter',
    };
  }

  return null;
};

const findFirstStopIndex = (
  text: string,
  stopSequences: string[]
): { index: number; sequence: string } | null => {
  let firstIndex = -1;
  let matchedSequence = '';

  for (const stopSequence of stopSequences) {
    if (!stopSequence) continue;

    const index = text.indexOf(stopSequence);
    if (
      index !== -1 &&
      (firstIndex === -1 ||
        index < firstIndex ||
        (index === firstIndex && stopSequence.length > matchedSequence.length))
    ) {
      firstIndex = index;
      matchedSequence = stopSequence;
    }
  }

  if (firstIndex === -1) return null;

  return {
    index: firstIndex,
    sequence: matchedSequence,
  };
};

const getVisibleCompletionText = (
  text: string,
  stopSequences: string[],
  isFinal: boolean
): { text: string; stopped: boolean } => {
  const stopMatch = findFirstStopIndex(text, stopSequences);
  if (stopMatch) {
    return {
      text: text.slice(0, stopMatch.index),
      stopped: true,
    };
  }

  if (isFinal || stopSequences.length === 0) {
    return {
      text,
      stopped: false,
    };
  }

  const holdback = Math.max(
    0,
    ...stopSequences.map((stopSequence) => stopSequence.length - 1)
  );

  if (holdback === 0) {
    return {
      text,
      stopped: false,
    };
  }

  return {
    text: text.slice(0, Math.max(0, text.length - holdback)),
    stopped: false,
  };
};

export const completions = async (req: Request, res: Response) => {
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

  const unsupportedParameterError = getUnsupportedParameterError(body);
  if (unsupportedParameterError) {
    return sendOpenAIError(
      res,
      400,
      unsupportedParameterError.message,
      unsupportedParameterError.code
    );
  }

  const promptState = normalizePrompt(body.prompt);
  if (!promptState.promptText) {
    return sendOpenAIError(
      res,
      400,
      promptState.errorMessage ?? 'Invalid prompt',
      promptState.errorCode ?? 'invalid_prompt'
    );
  }

  const stopState = normalizeStopSequences(body.stop);
  if (stopState.errorMessage) {
    return sendOpenAIError(
      res,
      400,
      stopState.errorMessage,
      stopState.errorCode ?? 'invalid_stop'
    );
  }

  const maxTokens =
    Number.isFinite(Number(body.max_tokens)) && Number(body.max_tokens) > 0
      ? Number(body.max_tokens)
      : MAX_TOKENS_DEFAULT;

  const promptText = promptState.promptText;
  const stopSequences = stopState.stopSequences;
  const shouldEchoPrompt = body.echo === true;
  const chatId = genShortId();
  const messages = await normalizeMessagesToBlackboxShape(
    [{ role: 'user', content: promptText }],
    resolved.name
  );

  if (messages.length === 0) {
    return sendOpenAIError(
      res,
      400,
      'prompt must be a non-empty string',
      'invalid_prompt'
    );
  }

  const payload = blackboxChatService.buildPayload({
    chatId,
    agentMode: { ...resolved },
    messages,
    maxTokens,
  });

  logger.debug(
    `[${reqId}] [COMPLETIONS] resolvedModel=${resolved.name} promptLength=${promptText.length} chatId=${chatId} maxTokens=${maxTokens} stream=${Boolean(
      body.stream
    )}`
  );

  if (body.stream === true) {
    setSseHeaders(res);

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const completionId = `cmpl_${genId()}`;
    const created = nowUnix();

    try {
      if (shouldEchoPrompt) {
        writeSseData(
          res,
          makeCompletionChunk({
            id: completionId,
            model: resolved.name,
            created,
            contentDelta: promptText,
            finishReason: null,
          })
        );
      }

      const upstream = await blackboxChatService.callStream(
        payload,
        { reqId, signal: abortController.signal },
        {
          safeJson,
          redactHeaders,
          DEBUG_MAX_CHARS,
        }
      );

      let fullGeneratedText = '';
      let streamedVisibleTextLength = 0;
      let inThinkBlock = false;

      if (upstream.body) {
        for await (const delta of readUpstreamDeltas(upstream.body.getReader())) {
          const chunk = delta as string;
          fullGeneratedText += chunk;

          if (
            fullGeneratedText.includes('<think>') &&
            !fullGeneratedText.includes('</think>')
          ) {
            inThinkBlock = true;
            continue;
          } else if (fullGeneratedText.includes('</think>')) {
            inThinkBlock = false;
          }

          if (inThinkBlock) continue;

          const processedText = stripThinkBlocks(fullGeneratedText);
          const visibleState = getVisibleCompletionText(
            processedText,
            stopSequences,
            false
          );
          const newText = visibleState.text.slice(streamedVisibleTextLength);

          if (newText.length > 0) {
            writeSseData(
              res,
              makeCompletionChunk({
                id: completionId,
                model: resolved.name,
                created,
                contentDelta: newText,
                finishReason: null,
              })
            );
            streamedVisibleTextLength = visibleState.text.length;
          }

          if (visibleState.stopped) {
            abortController.abort();
            break;
          }
        }
      }

      const finalProcessedText = stripThinkBlocks(fullGeneratedText);
      const finalVisibleState = getVisibleCompletionText(
        finalProcessedText,
        stopSequences,
        true
      );
      const remainingText = finalVisibleState.text.slice(streamedVisibleTextLength);

      if (remainingText.length > 0) {
        writeSseData(
          res,
          makeCompletionChunk({
            id: completionId,
            model: resolved.name,
            created,
            contentDelta: remainingText,
            finishReason: null,
          })
        );
      }

      writeSseData(
        res,
        makeCompletionChunk({
          id: completionId,
          model: resolved.name,
          created,
          contentDelta: '',
          finishReason: 'stop',
        })
      );

      writeSseDone(res);
      return res.end();
    } catch (error: any) {
      if (isAbortError(error)) {
        if (!res.writableEnded) {
          writeSseDone(res);
          return res.end();
        }
        return;
      }

      logger.error(`[${reqId}] [/v1/completions stream] Error:`, error);
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
    const processedText = stripThinkBlocks(rawText ?? '');
    const visibleState = getVisibleCompletionText(
      processedText,
      stopSequences,
      true
    );
    const completionText = shouldEchoPrompt
      ? `${promptText}${visibleState.text}`
      : visibleState.text;

    return res.json({
      id: `cmpl_${genId()}`,
      object: 'text_completion',
      created: nowUnix(),
      model: resolved.name,
      choices: [
        {
          text: completionText,
          index: 0,
          logprobs: null,
          finish_reason: 'stop',
        },
      ],
      proxy: {
        responseTimeSec: Number(((Date.now() - startTime) / 1000).toFixed(1)),
        raw: data,
      },
    });
  } catch (error: any) {
    logger.error(`[${reqId}] [/v1/completions] Error:`, error);
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


