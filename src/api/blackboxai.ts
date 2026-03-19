import {
  API_ENDPOINT,
  BASE_HEADERS,
  MAX_TOKENS_DEFAULT,
  DEFAULT_USER_SELECTED_AGENT,
  DEFAULT_GITHUB_TOKEN,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_IS_PREMIUM,
  SUBSCRIPTION_CUSTOMER_ID,
  VALIDATION_TOKEN,
} from '../configs/env';
import logger from '../services/logger';

export const buildBlackboxPayload = ({
  chatId,
  agentMode,
  messages,
  maxTokens,
}: {
  chatId: string;
  agentMode: any;
  messages: any[];
  maxTokens: number;
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

    isPremium: DEFAULT_IS_PREMIUM,

    subscriptionCache: SUBSCRIPTION_CUSTOMER_ID
      ? { customerId: SUBSCRIPTION_CUSTOMER_ID }
      : undefined,

    beastMode: false,
    reasoningMode: false,
    designerMode: false,
    workspaceId: DEFAULT_WORKSPACE_ID,
    asyncMode: false,
    integrations: {},
    isTaskPersistent: false,
    selectedElement: null,
  };
};

export const callBlackboxAPIJson = async (
  payload: any,
  ctx: any = {},
  { safeJson, redactHeaders, DEBUG_MAX_CHARS }: any
) => {
  const reqId = ctx.reqId ?? 'n/a';

  logger.debug(`[${reqId}] [UPSTREAM REQUEST] POST ${API_ENDPOINT}`);
  logger.debug(
    `[${reqId}] [UPSTREAM REQUEST] headers=${safeJson(redactHeaders(BASE_HEADERS), DEBUG_MAX_CHARS)}`
  );
  logger.debug(
    `[${reqId}] [UPSTREAM REQUEST] payload=${safeJson(payload, DEBUG_MAX_CHARS)}`
  );

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify(payload),
  });

  const status = response.status;
  const statusText = response.statusText;

  const rawText = await response.text().catch(() => '');
  logger.debug(`[${reqId}] [UPSTREAM RESPONSE] status=${status} ${statusText}`);
  logger.debug(
    `[${reqId}] [UPSTREAM RESPONSE] body=${rawText.length ? rawText.slice(0, DEBUG_MAX_CHARS) : ''}${rawText.length > DEBUG_MAX_CHARS ? '... (truncated)' : ''}`
  );

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

export const callBlackboxAPIStream = async (
  payload: any,
  ctx: any = {},
  { safeJson, redactHeaders, DEBUG_MAX_CHARS }: any
) => {
  const reqId = ctx.reqId ?? 'n/a';
  const signal = ctx.signal;

  logger.debug(`[${reqId}] [UPSTREAM REQUEST] POST ${API_ENDPOINT} (stream)`);
  logger.debug(
    `[${reqId}] [UPSTREAM REQUEST] headers=${safeJson(redactHeaders(BASE_HEADERS), DEBUG_MAX_CHARS)}`
  );
  logger.debug(
    `[${reqId}] [UPSTREAM REQUEST] payload=${safeJson(payload, DEBUG_MAX_CHARS)}`
  );

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: BASE_HEADERS as any,
    body: JSON.stringify(payload),
    signal,
  });

  logger.debug(
    `[${reqId}] [UPSTREAM RESPONSE] status=${response.status} ${response.statusText} (stream)`
  );

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
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
