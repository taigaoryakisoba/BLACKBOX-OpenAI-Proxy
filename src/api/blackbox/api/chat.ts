import {
  DEFAULT_GITHUB_TOKEN,
  DEFAULT_USER_SELECTED_AGENT,
  DEFAULT_WORKSPACE_ID,
  SUBSCRIPTION_CUSTOMER_ID,
  VALIDATION_TOKEN,
} from '../../../configs/env';
import { BLACKBOX_CHAT_URL, BlackboxApiClient } from '../apiClient';

export const buildBlackboxChatPayload = ({
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

export interface PostBlackboxChatParams {
  payload: any;
  cookieHeader?: string;
  signal?: AbortSignal;
}

export const postBlackboxChat = async ({
  payload,
  cookieHeader = '',
  signal,
}: PostBlackboxChatParams): Promise<Response> =>
  BlackboxApiClient.requestApi({
    url: BLACKBOX_CHAT_URL,
    method: 'POST',
    cookieHeader,
    body: JSON.stringify(payload),
    signal,
  });
