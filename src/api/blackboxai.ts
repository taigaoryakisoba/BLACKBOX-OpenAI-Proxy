import {
  API_ENDPOINT,
  BASE_HEADERS,
  DEFAULT_USER_SELECTED_AGENT,
  DEFAULT_GITHUB_TOKEN,
  DEFAULT_WORKSPACE_ID,
  SUBSCRIPTION_CUSTOMER_ID,
  VALIDATION_TOKEN,
} from '../configs/env';
import {
  getBlackboxAuthContext,
  invalidateRuntimeBlackboxAuth,
} from '../services/blackbox-auth';
import logger from '../services/logger';

export const buildBlackboxPayload = ({
  chatId,
  agentMode,
  messages,
  maxTokens,
  reasoningMode = false,
}: {
  chatId: string;
  agentMode: any;
  messages: any[];
  maxTokens: number;
  reasoningMode?: boolean;
}) => {
  if (agentMode.name === 'blackbox/free') agentMode = undefined;

  return {
    messages,
    agentMode,
    id: chatId,

    previewToken: null,
    userId: null,
    codeModelMode: true,
    trendingAgentMode: {},
    isMicMode: false,
    userSystemPrompt: null,
    maxTokens,
    playgroundTopP: null,
    playgroundTemperature: null,
    isChromeExt: false,
    githubToken: DEFAULT_GITHUB_TOKEN,
    clickedAnswer2: false,
    clickedAnswer3: false,
    clickedForceWebSearch: false,
    visitFromDelta: false,
    isMemoryEnabled: false,
    mobileClient: false,

    // userSelectedModel: agentMode.name,
    userSelectedAgent: DEFAULT_USER_SELECTED_AGENT,
    validated: VALIDATION_TOKEN,

    imageGenerationMode: false,
    imageGenMode: 'autoMode',
    webSearchModePrompt: false,
    deepSearchMode: false,
    promptSelection: '',
    domains: null,
    vscodeClient: false,
    codeInterpreterMode: false,

    customProfile: {
      name: '',
      occupation: '',
      traits: [],
      additionalInfo: '',
      enableNewChats: false,
    },

    webSearchModeOption: {
      autoMode: true,
      webMode: false,
      offlineMode: false,
    },

    isPremium: !!SUBSCRIPTION_CUSTOMER_ID,

    subscriptionCache: SUBSCRIPTION_CUSTOMER_ID
      ? { customerId: SUBSCRIPTION_CUSTOMER_ID }
      : undefined,

    beastMode: false,
    reasoningMode,
    designerMode: false,
    workspaceId: DEFAULT_WORKSPACE_ID,
    asyncMode: false,
    integrations: {},
    isTaskPersistent: false,
    selectedElement: null,
  };
};

const buildRequestHeaders = (cookieHeader: string): Record<string, string> => ({
  ...BASE_HEADERS,
  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
});

const applyCustomerIdToPayload = (payload: any, customerId: string) => ({
  ...payload,
  isPremium: !!customerId,
  subscriptionCache: customerId ? { customerId } : undefined,
});

const shouldRetryWithFreshRuntimeSession = (
  status: number,
  details: string,
  source: string
): boolean => {
  if (source !== 'runtime') return false;
  if (status === 401 || status === 403) return true;

  return /login is required|session|unauthorized|forbidden/i.test(details);
};

export const callBlackboxAPIJson = async (
  payload: any,
  ctx: any = {},
  { safeJson, redactHeaders, DEBUG_MAX_CHARS }: any
) => {
  const reqId = ctx.reqId ?? 'n/a';
  const signal = ctx.signal;

  const requestOnce = async (forceRefresh = false) => {
    const auth = await getBlackboxAuthContext(forceRefresh);
    const headers = buildRequestHeaders(auth.cookieHeader);
    const resolvedPayload = applyCustomerIdToPayload(payload, auth.customerId);

    logger.debug(`[${reqId}] [UPSTREAM REQUEST] POST ${API_ENDPOINT}`);
    logger.debug(
      `[${reqId}] [UPSTREAM REQUEST] headers=${safeJson(redactHeaders(headers), DEBUG_MAX_CHARS)}`
    );
    logger.debug(
      `[${reqId}] [UPSTREAM REQUEST] payload=${safeJson(resolvedPayload, DEBUG_MAX_CHARS)}`
    );

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(resolvedPayload),
      signal,
    });

    const status = response.status;
    const statusText = response.statusText;
    const rawText = await response.text().catch(() => '');

    logger.debug(`[${reqId}] [UPSTREAM RESPONSE] status=${status} ${statusText}`);
    logger.debug(
      `[${reqId}] [UPSTREAM RESPONSE] body=${rawText.length ? rawText.slice(0, DEBUG_MAX_CHARS) : ''}${rawText.length > DEBUG_MAX_CHARS ? '... (truncated)' : ''}`
    );

    if (
      !response.ok &&
      !forceRefresh &&
      shouldRetryWithFreshRuntimeSession(status, rawText, auth.source)
    ) {
      invalidateRuntimeBlackboxAuth(
        `upstream returned ${status} ${statusText || ''}`.trim()
      );
      return requestOnce(true);
    }

    if (!response.ok) {
      const error: any = new Error(`Blackbox API error: ${status} ${statusText}`);
      error.status = status;
      error.details = rawText;
      throw error;
    }

    try {
      return rawText ? JSON.parse(rawText) : null;
    } catch {
      return rawText;
    }
  };

  return requestOnce();
};

export const callBlackboxAPIStream = async (
  payload: any,
  ctx: any = {},
  { safeJson, redactHeaders, DEBUG_MAX_CHARS }: any
) => {
  const reqId = ctx.reqId ?? 'n/a';
  const signal = ctx.signal;

  const requestOnce = async (forceRefresh = false): Promise<Response> => {
    const auth = await getBlackboxAuthContext(forceRefresh);
    const headers = buildRequestHeaders(auth.cookieHeader);
    const resolvedPayload = applyCustomerIdToPayload(payload, auth.customerId);

    logger.debug(`[${reqId}] [UPSTREAM REQUEST] POST ${API_ENDPOINT} (stream)`);
    logger.debug(
      `[${reqId}] [UPSTREAM REQUEST] headers=${safeJson(redactHeaders(headers), DEBUG_MAX_CHARS)}`
    );
    logger.debug(
      `[${reqId}] [UPSTREAM REQUEST] payload=${safeJson(resolvedPayload, DEBUG_MAX_CHARS)}`
    );

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(resolvedPayload),
      signal,
    });

    logger.debug(
      `[${reqId}] [UPSTREAM RESPONSE] status=${response.status} ${response.statusText} (stream)`
    );

    if (!response.ok) {
      const rawText = await response.text().catch(() => '');

      if (
        !forceRefresh &&
        shouldRetryWithFreshRuntimeSession(response.status, rawText, auth.source)
      ) {
        invalidateRuntimeBlackboxAuth(
          `upstream stream returned ${response.status} ${response.statusText || ''}`.trim()
        );
        return requestOnce(true);
      }

      const error: any = new Error(
        `Blackbox API error: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      error.details = rawText;
      throw error;
    }

    if (!response.body) {
      const error: any = new Error(
        'Upstream returned no body (stream not available)'
      );
      error.status = 502;
      throw error;
    }

    return response;
  };

  return requestOnce();
};
