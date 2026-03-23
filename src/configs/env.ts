import { config } from 'dotenv';

config(); // Load .env if present

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const API_ENDPOINT =
  process.env.BLACKBOX_API_ENDPOINT ?? 'https://app.blackbox.ai/api/chat';
export const VALIDATION_TOKEN = process.env.BLACKBOX_VALIDATION_TOKEN ?? '';
export const MAX_TOKENS_DEFAULT = Number(
  process.env.BLACKBOX_MAX_TOKENS ?? 1024
);

export const SUBSCRIPTION_CUSTOMER_ID = process.env.BLACKBOX_CUSTOMER_ID ?? '';
export const SESSION_TOKEN = process.env.BLACKBOX_SESSION_TOKEN ?? '';
export const LOGIN_EMAIL = process.env.BLACKBOX_LOGIN_EMAIL ?? '';
export const LOGIN_PASSWORD = process.env.BLACKBOX_LOGIN_PASSWORD ?? '';
export const LOGIN_EAGER = (process.env.BLACKBOX_LOGIN_EAGER ?? 'false') === 'true';
export const LOGIN_RETRY_COOLDOWN_MS = Number(
  process.env.BLACKBOX_LOGIN_RETRY_COOLDOWN_MS ?? 60_000
);

export const DEFAULT_USER_SELECTED_AGENT =
  process.env.BLACKBOX_USER_SELECTED_AGENT ?? 'VscodeAgent';
export const DEFAULT_GITHUB_TOKEN = process.env.BLACKBOX_GITHUB_TOKEN ?? '';
export const DEFAULT_WORKSPACE_ID = process.env.BLACKBOX_WORKSPACE_ID ?? '';

export const DEBUG_LOG = (process.env.DEBUG_LOG ?? 'false') === 'true';
export const DEBUG_MAX_CHARS = Number(process.env.DEBUG_MAX_CHARS ?? 10);

export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export interface ModelConfig {
  id: string;
  name: string;
  mode: boolean;
}

export const MODEL_CONFIG: Record<string, ModelConfig> = {
  'anthropic/claude-opus-4.6': {
    id: 'Claude Opus 4.6',
    name: 'anthropic/claude-opus-4.6',
    mode: true,
  },
  'google/gemini-3.1-pro-preview': {
    id: 'Gemini 3.1 Pro Preview',
    name: 'google/gemini-3.1-pro-preview',
    mode: true,
  },
  'openai/gpt-5.4': {
    id: 'GPT-5.4',
    name: 'openai/gpt-5.4',
    mode: true,
  },
  'openai/gpt-5.3-codex': {
    id: 'GPT-5.3-codex',
    name: 'openai/gpt-5.3-codex',
    mode: true,
  },
  'openai/gpt-5.2': {
    id: 'GPT-5.2',
    name: 'openai/gpt-5.2',
    mode: true,
  },

  // Aliases
  'GPT-5.2': { id: 'GPT-5.2', name: 'openai/gpt-5.2', mode: true },
  'Claude-Opus-4.6': {
    id: 'Claude Opus 4.6',
    name: 'anthropic/claude-opus-4.6',
    mode: true,
  },
  'Claude Opus 4.6': {
    id: 'Claude Opus 4.6',
    name: 'anthropic/claude-opus-4.6',
    mode: true,
  },
};

export const BASE_HEADERS = Object.freeze({
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'content-type': 'application/json',
  origin: 'https://app.blackbox.ai',
  pragma: 'no-cache',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
});
