import {
  buildBlackboxChatPayload,
  postBlackboxChat,
} from '../api/blackbox/api/chat';
import { BlackboxApiClient } from '../api/blackbox/apiClient';
import type { BlackboxAuthContext } from './blackbox-auth';
import blackboxAuthService from './blackbox-auth';
import type { BlackboxValidationContext } from './blackbox-validation';
import blackboxValidationService from './blackbox-validation';
import logger from './logger';

interface BlackboxRequestContext {
  reqId?: string;
  signal?: AbortSignal;
}

interface BlackboxRequestDebugOptions {
  safeJson: (obj: any, maxChars: number) => string;
  redactHeaders: (headers: Record<string, string>) => Record<string, string>;
  DEBUG_MAX_CHARS: number;
}

class BlackboxChatService {
  private static instance: BlackboxChatService | null = null;

  private constructor() {}

  static getInstance(): BlackboxChatService {
    if (!BlackboxChatService.instance) {
      BlackboxChatService.instance = new BlackboxChatService();
    }

    return BlackboxChatService.instance;
  }

  buildPayload(params: {
    chatId: string;
    agentMode: any;
    messages: any[];
    maxTokens: number;
    reasoningMode?: boolean;
  }) {
    return buildBlackboxChatPayload(params);
  }

  private buildRequestHeaders(cookieHeader: string): Record<string, string> {
    return BlackboxApiClient.buildApiHeaders({}, cookieHeader);
  }

  private applyCustomerIdToPayload(payload: any, customerId: string) {
    return {
      ...payload,
      isPremium: !!customerId,
      subscriptionCache: customerId ? { customerId } : undefined,
    };
  }

  private applyValidationTokenToPayload(payload: any, token: string) {
    return {
      ...payload,
      validated: token,
    };
  }

  private shouldRetryWithFreshRuntimeContext(
    status: number,
    details: string,
    auth: BlackboxAuthContext,
    validation: BlackboxValidationContext
  ): boolean {
    const hasRuntimeContext =
      auth.source === 'runtime' || validation.source === 'runtime';

    if (!hasRuntimeContext) return false;
    if (status === 401 || status === 403) return true;

    return /login is required|session|unauthorized|forbidden/i.test(details);
  }

  private async request(
    payload: any,
    ctx: BlackboxRequestContext,
    options: BlackboxRequestDebugOptions,
    forceRefresh = false
  ): Promise<Response> {
    const reqId = ctx.reqId ?? 'n/a';
    const auth = await blackboxAuthService.getAuthContext(forceRefresh);
    const validation =
      await blackboxValidationService.getValidationContext(forceRefresh);
    const headers = this.buildRequestHeaders(auth.cookieHeader);
    const resolvedPayload = this.applyValidationTokenToPayload(
      this.applyCustomerIdToPayload(payload, auth.customerId),
      validation.token
    );

    logger.debug(`[${reqId}] [UPSTREAM REQUEST] POST /api/chat`);
    logger.debug(
      `[${reqId}] [UPSTREAM REQUEST] headers=${options.safeJson(
        options.redactHeaders(headers),
        options.DEBUG_MAX_CHARS
      )}`
    );
    logger.debug(
      `[${reqId}] [UPSTREAM REQUEST] payload=${options.safeJson(
        resolvedPayload,
        options.DEBUG_MAX_CHARS
      )}`
    );

    const response = await postBlackboxChat({
      payload: resolvedPayload,
      cookieHeader: auth.cookieHeader,
      signal: ctx.signal,
    });

    logger.debug(
      `[${reqId}] [UPSTREAM RESPONSE] status=${response.status} ${response.statusText}`
    );

    if (response.ok) {
      return response;
    }

    const rawText = await response.text().catch(() => '');
    logger.debug(
      `[${reqId}] [UPSTREAM RESPONSE] body=${rawText.length ? rawText.slice(0, options.DEBUG_MAX_CHARS) : ''}${rawText.length > options.DEBUG_MAX_CHARS ? '... (truncated)' : ''}`
    );

    if (
      !forceRefresh &&
      this.shouldRetryWithFreshRuntimeContext(
        response.status,
        rawText,
        auth,
        validation
      )
    ) {
      const reason = `upstream returned ${response.status} ${response.statusText || ''}`.trim();

      if (auth.source === 'runtime') {
        blackboxAuthService.invalidateRuntimeSession(reason);
      }

      if (validation.source === 'runtime') {
        blackboxValidationService.invalidateRuntimeToken(reason);
      }

      return this.request(payload, ctx, options, true);
    }

    const error: any = new Error(
      `Blackbox API error: ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.details = rawText;
    throw error;
  }

  async callJson(
    payload: any,
    ctx: BlackboxRequestContext = {},
    options: BlackboxRequestDebugOptions
  ) {
    const response = await this.request(payload, ctx, options);
    const rawText = await response.text().catch(() => '');

    logger.debug(
      `[${ctx.reqId ?? 'n/a'}] [UPSTREAM RESPONSE] body=${rawText.length ? rawText.slice(0, options.DEBUG_MAX_CHARS) : ''}${rawText.length > options.DEBUG_MAX_CHARS ? '... (truncated)' : ''}`
    );

    try {
      return rawText ? JSON.parse(rawText) : null;
    } catch {
      return rawText;
    }
  }

  async callStream(
    payload: any,
    ctx: BlackboxRequestContext = {},
    options: BlackboxRequestDebugOptions
  ): Promise<Response> {
    const response = await this.request(payload, ctx, options);

    if (!response.body) {
      const error: any = new Error(
        'Upstream returned no body (stream not available)'
      );
      error.status = 502;
      throw error;
    }

    return response;
  }
}

const blackboxChatService = BlackboxChatService.getInstance();

export default blackboxChatService;
