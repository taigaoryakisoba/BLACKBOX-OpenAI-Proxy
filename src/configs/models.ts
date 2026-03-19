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
