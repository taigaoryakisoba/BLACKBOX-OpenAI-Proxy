export interface ModelConfig {
  id?: string;
  name: string;
  mode: boolean;
}

export const MODEL_CONFIG: Record<string, ModelConfig> = {
  free: {
    name: 'blackbox/free',
    mode: true,
  },
  'blackbox/free': {
    name: 'blackbox/free',
    mode: true,
  },
  'anthropic/claude-sonnet-4.6': {
    name: 'anthropic/claude-sonnet-4.6',
    mode: true,
  },
  'anthropic/claude-sonnet-4.5': {
    name: 'anthropic/claude-sonnet-4.5',
    mode: true,
  },
  'anthropic/claude-opus-4.6': {
    name: 'anthropic/claude-opus-4.6',
    mode: true,
  },
  'anthropic/claude-opus-4.5': {
    name: 'anthropic/claude-opus-4.5',
    mode: true,
  },
  'openai/gpt-5.2-codex': {
    name: 'openai/gpt-5.2-codex',
    mode: true,
  },
  'google/gemini-3-pro-preview': {
    name: 'google/gemini-3-pro-preview',
    mode: true,
  },
  'google/gemini-3.1-pro-preview': {
    name: 'google/gemini-3.1-pro-preview',
    mode: true,
  },
  'ai21/jamba-large-1.7': {
    name: 'ai21/jamba-large-1.7',
    mode: true,
  },
  'ai21/jamba-mini-1.7': {
    name: 'ai21/jamba-mini-1.7',
    mode: true,
  },
  'aion-labs/aion-1.0': {
    name: 'aion-labs/aion-1.0',
    mode: true,
  },
  'aion-labs/aion-1.0-mini': {
    name: 'aion-labs/aion-1.0-mini',
    mode: true,
  },
  'aion-labs/aion-rp-llama-3.1-8b': {
    name: 'aion-labs/aion-rp-llama-3.1-8b',
    mode: true,
  },
  'alfredpros/codellama-7b-instruct-solidity': {
    name: 'alfredpros/codellama-7b-instruct-solidity',
    mode: true,
  },
  'alibaba/tongyi-deepresearch-30b-a3b': {
    name: 'alibaba/tongyi-deepresearch-30b-a3b',
    mode: true,
  },
  'allenai/molmo-2-8b:free': {
    name: 'allenai/molmo-2-8b:free',
    mode: true,
  },
  'allenai/olmo-2-0325-32b-instruct': {
    name: 'allenai/olmo-2-0325-32b-instruct',
    mode: true,
  },
  'allenai/olmo-3-32b-think': {
    name: 'allenai/olmo-3-32b-think',
    mode: true,
  },
  'allenai/olmo-3-7b-instruct': {
    name: 'allenai/olmo-3-7b-instruct',
    mode: true,
  },
  'allenai/olmo-3-7b-think': {
    name: 'allenai/olmo-3-7b-think',
    mode: true,
  },
  'allenai/olmo-3.1-32b-instruct': {
    name: 'allenai/olmo-3.1-32b-instruct',
    mode: true,
  },
  'allenai/olmo-3.1-32b-think': {
    name: 'allenai/olmo-3.1-32b-think',
    mode: true,
  },
  'alpindale/goliath-120b': {
    name: 'alpindale/goliath-120b',
    mode: true,
  },
  'amazon/nova-2-lite-v1': {
    name: 'amazon/nova-2-lite-v1',
    mode: true,
  },
  'amazon/nova-lite-v1': {
    name: 'amazon/nova-lite-v1',
    mode: true,
  },
  'amazon/nova-micro-v1': {
    name: 'amazon/nova-micro-v1',
    mode: true,
  },
  'amazon/nova-premier-v1': {
    name: 'amazon/nova-premier-v1',
    mode: true,
  },
  'amazon/nova-pro-v1': {
    name: 'amazon/nova-pro-v1',
    mode: true,
  },
  'anthracite-org/magnum-v4-72b': {
    name: 'anthracite-org/magnum-v4-72b',
    mode: true,
  },
  'anthropic/claude-3-haiku': {
    name: 'anthropic/claude-3-haiku',
    mode: true,
  },
  'anthropic/claude-3.5-haiku': {
    name: 'anthropic/claude-3.5-haiku',
    mode: true,
  },
  'anthropic/claude-3.7-sonnet:thinking': {
    name: 'anthropic/claude-3.7-sonnet:thinking',
    mode: true,
  },
  'anthropic/claude-3.7-sonnet': {
    name: 'anthropic/claude-3.7-sonnet',
    mode: true,
  },
  'anthropic/claude-haiku-4.5': {
    name: 'anthropic/claude-haiku-4.5',
    mode: true,
  },
  'anthropic/claude-opus-4': {
    name: 'anthropic/claude-opus-4',
    mode: true,
  },
  'anthropic/claude-opus-4.1': {
    name: 'anthropic/claude-opus-4.1',
    mode: true,
  },
  'anthropic/claude-sonnet-4': {
    name: 'anthropic/claude-sonnet-4',
    mode: true,
  },
  'arcee-ai/coder-large': {
    name: 'arcee-ai/coder-large',
    mode: true,
  },
  'arcee-ai/maestro-reasoning': {
    name: 'arcee-ai/maestro-reasoning',
    mode: true,
  },
  'arcee-ai/spotlight': {
    name: 'arcee-ai/spotlight',
    mode: true,
  },
  'arcee-ai/trinity-large-preview:free': {
    name: 'arcee-ai/trinity-large-preview:free',
    mode: true,
  },
  'arcee-ai/trinity-mini': {
    name: 'arcee-ai/trinity-mini',
    mode: true,
  },
  'arcee-ai/trinity-mini:free': {
    name: 'arcee-ai/trinity-mini:free',
    mode: true,
  },
  'arcee-ai/virtuoso-large': {
    name: 'arcee-ai/virtuoso-large',
    mode: true,
  },
  'baidu/ernie-4.5-21b-a3b': {
    name: 'baidu/ernie-4.5-21b-a3b',
    mode: true,
  },
  'baidu/ernie-4.5-21b-a3b-thinking': {
    name: 'baidu/ernie-4.5-21b-a3b-thinking',
    mode: true,
  },
  'baidu/ernie-4.5-300b-a47b': {
    name: 'baidu/ernie-4.5-300b-a47b',
    mode: true,
  },
  'bria/fibo': {
    name: 'bria/fibo',
    mode: true,
  },
  'bytedance-seed/seed-1.6': {
    name: 'bytedance-seed/seed-1.6',
    mode: true,
  },
  'bytedance-seed/seed-1.6-flash': {
    name: 'bytedance-seed/seed-1.6-flash',
    mode: true,
  },
  'bytedance/ui-tars-1.5-7b': {
    name: 'bytedance/ui-tars-1.5-7b',
    mode: true,
  },
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free': {
    name: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    mode: true,
  },
  'cohere/command-a': {
    name: 'cohere/command-a',
    mode: true,
  },
  'cohere/command-r-08-2024': {
    name: 'cohere/command-r-08-2024',
    mode: true,
  },
  'cohere/command-r-plus-08-2024': {
    name: 'cohere/command-r-plus-08-2024',
    mode: true,
  },
  'cohere/command-r7b-12-2024': {
    name: 'cohere/command-r7b-12-2024',
    mode: true,
  },
  'deepcogito/cogito-v2-preview-llama-109b-moe': {
    name: 'deepcogito/cogito-v2-preview-llama-109b-moe',
    mode: true,
  },
  'deepcogito/cogito-v2-preview-llama-405b': {
    name: 'deepcogito/cogito-v2-preview-llama-405b',
    mode: true,
  },
  'deepcogito/cogito-v2-preview-llama-70b': {
    name: 'deepcogito/cogito-v2-preview-llama-70b',
    mode: true,
  },
  'deepcogito/cogito-v2.1-671b': {
    name: 'deepcogito/cogito-v2.1-671b',
    mode: true,
  },
  'deepseek/deepseek-chat': {
    name: 'deepseek/deepseek-chat',
    mode: true,
  },
  'deepseek/deepseek-chat-v3-0324': {
    name: 'deepseek/deepseek-chat-v3-0324',
    mode: true,
  },
  'deepseek/deepseek-chat-v3.1': {
    name: 'deepseek/deepseek-chat-v3.1',
    mode: true,
  },
  'deepseek/deepseek-r1': {
    name: 'deepseek/deepseek-r1',
    mode: true,
  },
  'deepseek/deepseek-r1-0528': {
    name: 'deepseek/deepseek-r1-0528',
    mode: true,
  },
  'deepseek/deepseek-r1-0528:free': {
    name: 'deepseek/deepseek-r1-0528:free',
    mode: true,
  },
  'deepseek/deepseek-r1-distill-qwen-32b': {
    name: 'deepseek/deepseek-r1-distill-qwen-32b',
    mode: true,
  },
  'deepseek/deepseek-v3.1-terminus:exacto': {
    name: 'deepseek/deepseek-v3.1-terminus:exacto',
    mode: true,
  },
  'deepseek/deepseek-v3.1-terminus': {
    name: 'deepseek/deepseek-v3.1-terminus',
    mode: true,
  },
  'deepseek/deepseek-v3.2': {
    name: 'deepseek/deepseek-v3.2',
    mode: true,
  },
  'deepseek/deepseek-v3.2-exp': {
    name: 'deepseek/deepseek-v3.2-exp',
    mode: true,
  },
  'deepseek/deepseek-v3.2-speciale': {
    name: 'deepseek/deepseek-v3.2-speciale',
    mode: true,
  },
  'eleutherai/llemma_7b': {
    name: 'eleutherai/llemma_7b',
    mode: true,
  },
  'essentialai/rnj-1-instruct': {
    name: 'essentialai/rnj-1-instruct',
    mode: true,
  },
  'gemini-flash-edit/multi': {
    name: 'gemini-flash-edit/multi',
    mode: true,
  },
  'google/gemini-2.0-flash-001': {
    name: 'google/gemini-2.0-flash-001',
    mode: true,
  },
  'google/gemini-2.0-flash-lite-001': {
    name: 'google/gemini-2.0-flash-lite-001',
    mode: true,
  },
  'google/gemini-2.5-flash': {
    name: 'google/gemini-2.5-flash',
    mode: true,
  },
  'google/gemini-2.5-flash-lite': {
    name: 'google/gemini-2.5-flash-lite',
    mode: true,
  },
  'google/gemini-2.5-flash-lite-preview-09-2025': {
    name: 'google/gemini-2.5-flash-lite-preview-09-2025',
    mode: true,
  },
  'google/gemini-2.5-flash-preview-09-2025': {
    name: 'google/gemini-2.5-flash-preview-09-2025',
    mode: true,
  },
  'google/gemini-2.5-pro': {
    name: 'google/gemini-2.5-pro',
    mode: true,
  },
  'google/gemini-2.5-pro-preview': {
    name: 'google/gemini-2.5-pro-preview',
    mode: true,
  },
  'google/gemini-2.5-pro-preview-05-06': {
    name: 'google/gemini-2.5-pro-preview-05-06',
    mode: true,
  },
  'google/gemini-3-flash-preview': {
    name: 'google/gemini-3-flash-preview',
    mode: true,
  },
  'google/gemma-2-27b-it': {
    name: 'google/gemma-2-27b-it',
    mode: true,
  },
  'google/gemma-2-9b-it': {
    name: 'google/gemma-2-9b-it',
    mode: true,
  },
  'google/gemma-3-12b-it': {
    name: 'google/gemma-3-12b-it',
    mode: true,
  },
  'google/gemma-3-12b-it:free': {
    name: 'google/gemma-3-12b-it:free',
    mode: true,
  },
  'google/gemma-3-4b-it': {
    name: 'google/gemma-3-4b-it',
    mode: true,
  },
  'google/gemma-3-4b-it:free': {
    name: 'google/gemma-3-4b-it:free',
    mode: true,
  },
  'google/gemma-3n-e2b-it:free': {
    name: 'google/gemma-3n-e2b-it:free',
    mode: true,
  },
  'google/gemma-3n-e4b-it': {
    name: 'google/gemma-3n-e4b-it',
    mode: true,
  },
  'google/gemma-3n-e4b-it:free': {
    name: 'google/gemma-3n-e4b-it:free',
    mode: true,
  },
  'google/nano-banana': {
    name: 'google/nano-banana',
    mode: true,
  },
  'google/nano-banana-pro': {
    name: 'google/nano-banana-pro',
    mode: true,
  },
  'gryphe/mythomax-l2-13b': {
    name: 'gryphe/mythomax-l2-13b',
    mode: true,
  },
  'ibm-granite/granite-4.0-h-micro': {
    name: 'ibm-granite/granite-4.0-h-micro',
    mode: true,
  },
  'inception/mercury': {
    name: 'inception/mercury',
    mode: true,
  },
  'inception/mercury-coder': {
    name: 'inception/mercury-coder',
    mode: true,
  },
  'inflection/inflection-3-pi': {
    name: 'inflection/inflection-3-pi',
    mode: true,
  },
  'inflection/inflection-3-productivity': {
    name: 'inflection/inflection-3-productivity',
    mode: true,
  },
  'kwaipilot/kat-coder-pro': {
    name: 'kwaipilot/kat-coder-pro',
    mode: true,
  },
  'liquid/lfm-2.2-6b': {
    name: 'liquid/lfm-2.2-6b',
    mode: true,
  },
  'liquid/lfm-2.5-1.2b-instruct:free': {
    name: 'liquid/lfm-2.5-1.2b-instruct:free',
    mode: true,
  },
  'liquid/lfm-2.5-1.2b-thinking:free': {
    name: 'liquid/lfm-2.5-1.2b-thinking:free',
    mode: true,
  },
  'liquid/lfm2-8b-a1b': {
    name: 'liquid/lfm2-8b-a1b',
    mode: true,
  },
  'mancer/weaver': {
    name: 'mancer/weaver',
    mode: true,
  },
  'meituan/longcat-flash-chat': {
    name: 'meituan/longcat-flash-chat',
    mode: true,
  },
  'meta-llama/llama-3-70b-instruct': {
    name: 'meta-llama/llama-3-70b-instruct',
    mode: true,
  },
  'meta-llama/llama-3-8b-instruct': {
    name: 'meta-llama/llama-3-8b-instruct',
    mode: true,
  },
  'meta-llama/llama-3.1-405b': {
    name: 'meta-llama/llama-3.1-405b',
    mode: true,
  },
  'meta-llama/llama-3.1-405b-instruct': {
    name: 'meta-llama/llama-3.1-405b-instruct',
    mode: true,
  },
  'meta-llama/llama-3.1-405b-instruct:free': {
    name: 'meta-llama/llama-3.1-405b-instruct:free',
    mode: true,
  },
  'meta-llama/llama-3.1-70b-instruct': {
    name: 'meta-llama/llama-3.1-70b-instruct',
    mode: true,
  },
  'meta-llama/llama-3.1-8b-instruct': {
    name: 'meta-llama/llama-3.1-8b-instruct',
    mode: true,
  },
  'meta-llama/llama-3.2-1b-instruct': {
    name: 'meta-llama/llama-3.2-1b-instruct',
    mode: true,
  },
  'meta-llama/llama-3.2-3b-instruct': {
    name: 'meta-llama/llama-3.2-3b-instruct',
    mode: true,
  },
  'meta-llama/llama-3.2-3b-instruct:free': {
    name: 'meta-llama/llama-3.2-3b-instruct:free',
    mode: true,
  },
  'meta-llama/llama-3.3-70b-instruct': {
    name: 'meta-llama/llama-3.3-70b-instruct',
    mode: true,
  },
  'meta-llama/llama-4-maverick': {
    name: 'meta-llama/llama-4-maverick',
    mode: true,
  },
  'meta-llama/llama-4-scout': {
    name: 'meta-llama/llama-4-scout',
    mode: true,
  },
  'meta-llama/llama-guard-2-8b': {
    name: 'meta-llama/llama-guard-2-8b',
    mode: true,
  },
  'meta-llama/llama-guard-3-8b': {
    name: 'meta-llama/llama-guard-3-8b',
    mode: true,
  },
  'meta-llama/llama-guard-4-12b': {
    name: 'meta-llama/llama-guard-4-12b',
    mode: true,
  },
  'microsoft/phi-4': {
    name: 'microsoft/phi-4',
    mode: true,
  },
  'microsoft/wizardlm-2-8x22b': {
    name: 'microsoft/wizardlm-2-8x22b',
    mode: true,
  },
  'minimax/minimax-01': {
    name: 'minimax/minimax-01',
    mode: true,
  },
  'minimax/minimax-free': {
    name: 'minimax/minimax-free',
    mode: true,
  },
  'minimax/minimax-m1': {
    name: 'minimax/minimax-m1',
    mode: true,
  },
  'minimax/minimax-m2': {
    name: 'minimax/minimax-m2',
    mode: true,
  },
  'minimax/minimax-m2-her': {
    name: 'minimax/minimax-m2-her',
    mode: true,
  },
  'minimax/minimax-m2.1': {
    name: 'minimax/minimax-m2.1',
    mode: true,
  },
  'mistralai/codestral-2508': {
    name: 'mistralai/codestral-2508',
    mode: true,
  },
  'mistralai/devstral-2512': {
    name: 'mistralai/devstral-2512',
    mode: true,
  },
  'mistralai/devstral-medium': {
    name: 'mistralai/devstral-medium',
    mode: true,
  },
  'mistralai/devstral-small': {
    name: 'mistralai/devstral-small',
    mode: true,
  },
  'mistralai/ministral-14b-2512': {
    name: 'mistralai/ministral-14b-2512',
    mode: true,
  },
  'mistralai/ministral-3b': {
    name: 'mistralai/ministral-3b',
    mode: true,
  },
  'mistralai/ministral-3b-2512': {
    name: 'mistralai/ministral-3b-2512',
    mode: true,
  },
  'mistralai/ministral-8b': {
    name: 'mistralai/ministral-8b',
    mode: true,
  },
  'mistralai/ministral-8b-2512': {
    name: 'mistralai/ministral-8b-2512',
    mode: true,
  },
  'mistralai/mistral-7b-instruct': {
    name: 'mistralai/mistral-7b-instruct',
    mode: true,
  },
  'mistralai/mistral-7b-instruct-v0.1': {
    name: 'mistralai/mistral-7b-instruct-v0.1',
    mode: true,
  },
  'mistralai/mistral-7b-instruct-v0.2': {
    name: 'mistralai/mistral-7b-instruct-v0.2',
    mode: true,
  },
  'mistralai/mistral-7b-instruct-v0.3': {
    name: 'mistralai/mistral-7b-instruct-v0.3',
    mode: true,
  },
  'mistralai/mistral-large': {
    name: 'mistralai/mistral-large',
    mode: true,
  },
  'mistralai/mistral-large-2407': {
    name: 'mistralai/mistral-large-2407',
    mode: true,
  },
  'mistralai/mistral-large-2411': {
    name: 'mistralai/mistral-large-2411',
    mode: true,
  },
  'mistralai/mistral-large-2512': {
    name: 'mistralai/mistral-large-2512',
    mode: true,
  },
  'mistralai/mistral-medium-3': {
    name: 'mistralai/mistral-medium-3',
    mode: true,
  },
  'mistralai/mistral-medium-3.1': {
    name: 'mistralai/mistral-medium-3.1',
    mode: true,
  },
  'mistralai/mistral-nemo': {
    name: 'mistralai/mistral-nemo',
    mode: true,
  },
  'mistralai/mistral-saba': {
    name: 'mistralai/mistral-saba',
    mode: true,
  },
  'mistralai/mistral-small-24b-instruct-2501': {
    name: 'mistralai/mistral-small-24b-instruct-2501',
    mode: true,
  },
  'mistralai/mistral-small-3.1-24b-instruct:free': {
    name: 'mistralai/mistral-small-3.1-24b-instruct:free',
    mode: true,
  },
  'mistralai/mistral-small-3.2-24b-instruct': {
    name: 'mistralai/mistral-small-3.2-24b-instruct',
    mode: true,
  },
  'mistralai/mistral-small-creative': {
    name: 'mistralai/mistral-small-creative',
    mode: true,
  },
  'mistralai/mistral-tiny': {
    name: 'mistralai/mistral-tiny',
    mode: true,
  },
  'mistralai/mixtral-8x22b-instruct': {
    name: 'mistralai/mixtral-8x22b-instruct',
    mode: true,
  },
  'mistralai/mixtral-8x7b-instruct': {
    name: 'mistralai/mixtral-8x7b-instruct',
    mode: true,
  },
  'mistralai/pixtral-12b': {
    name: 'mistralai/pixtral-12b',
    mode: true,
  },
  'mistralai/pixtral-large-2411': {
    name: 'mistralai/pixtral-large-2411',
    mode: true,
  },
  'mistralai/voxtral-small-24b-2507': {
    name: 'mistralai/voxtral-small-24b-2507',
    mode: true,
  },
  'moonshotai/kimi-dev-72b': {
    name: 'moonshotai/kimi-dev-72b',
    mode: true,
  },
  'moonshotai/kimi-k2:free': {
    name: 'moonshotai/kimi-k2:free',
    mode: true,
  },
  'moonshotai/kimi-k2': {
    name: 'moonshotai/kimi-k2',
    mode: true,
  },
  'moonshotai/kimi-k2-0905': {
    name: 'moonshotai/kimi-k2-0905',
    mode: true,
  },
  'moonshotai/kimi-k2-0905:exacto': {
    name: 'moonshotai/kimi-k2-0905:exacto',
    mode: true,
  },
  'moonshotai/kimi-k2-thinking': {
    name: 'moonshotai/kimi-k2-thinking',
    mode: true,
  },
  'moonshotai/kimi-k2.5': {
    name: 'moonshotai/kimi-k2.5',
    mode: true,
  },
  'morph/morph-v3-fast': {
    name: 'morph/morph-v3-fast',
    mode: true,
  },
  'morph/morph-v3-large': {
    name: 'morph/morph-v3-large',
    mode: true,
  },
  'neversleep/llama-3.1-lumimaid-8b': {
    name: 'neversleep/llama-3.1-lumimaid-8b',
    mode: true,
  },
  'neversleep/noromaid-20b': {
    name: 'neversleep/noromaid-20b',
    mode: true,
  },
  'nex-agi/deepseek-v3.1-nex-n1': {
    name: 'nex-agi/deepseek-v3.1-nex-n1',
    mode: true,
  },
  'nousresearch/hermes-2-pro-llama-3-8b': {
    name: 'nousresearch/hermes-2-pro-llama-3-8b',
    mode: true,
  },
  'nousresearch/hermes-3-llama-3.1-405b:free': {
    name: 'nousresearch/hermes-3-llama-3.1-405b:free',
    mode: true,
  },
  'nousresearch/hermes-3-llama-3.1-405b': {
    name: 'nousresearch/hermes-3-llama-3.1-405b',
    mode: true,
  },
  'nousresearch/hermes-3-llama-3.1-70b': {
    name: 'nousresearch/hermes-3-llama-3.1-70b',
    mode: true,
  },
  'nousresearch/hermes-4-405b': {
    name: 'nousresearch/hermes-4-405b',
    mode: true,
  },
  'nvidia/llama-3.1-nemotron-70b-instruct': {
    name: 'nvidia/llama-3.1-nemotron-70b-instruct',
    mode: true,
  },
  'nvidia/llama-3.1-nemotron-ultra-253b-v1': {
    name: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
    mode: true,
  },
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': {
    name: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    mode: true,
  },
  'nvidia/nemotron-3-nano-30b-a3b': {
    name: 'nvidia/nemotron-3-nano-30b-a3b',
    mode: true,
  },
  'nvidia/nemotron-3-nano-30b-a3b:free': {
    name: 'nvidia/nemotron-3-nano-30b-a3b:free',
    mode: true,
  },
  'nvidia/nemotron-nano-9b-v2': {
    name: 'nvidia/nemotron-nano-9b-v2',
    mode: true,
  },
  'nvidia/nemotron-nano-9b-v2:free': {
    name: 'nvidia/nemotron-nano-9b-v2:free',
    mode: true,
  },
  'openai/chatgpt-4o-latest': {
    name: 'openai/chatgpt-4o-latest',
    mode: true,
  },
  'openai/gpt-3.5-turbo': {
    name: 'openai/gpt-3.5-turbo',
    mode: true,
  },
  'openai/gpt-3.5-turbo-0613': {
    name: 'openai/gpt-3.5-turbo-0613',
    mode: true,
  },
  'openai/gpt-3.5-turbo-16k': {
    name: 'openai/gpt-3.5-turbo-16k',
    mode: true,
  },
  'openai/gpt-3.5-turbo-instruct': {
    name: 'openai/gpt-3.5-turbo-instruct',
    mode: true,
  },
  'openai/gpt-4': {
    name: 'openai/gpt-4',
    mode: true,
  },
  'openai/gpt-4-1106-preview': {
    name: 'openai/gpt-4-1106-preview',
    mode: true,
  },
  'openai/gpt-4-turbo': {
    name: 'openai/gpt-4-turbo',
    mode: true,
  },
  'openai/gpt-4-turbo-preview': {
    name: 'openai/gpt-4-turbo-preview',
    mode: true,
  },
  'openai/gpt-4.1': {
    name: 'openai/gpt-4.1',
    mode: true,
  },
  'openai/gpt-4.1-mini': {
    name: 'openai/gpt-4.1-mini',
    mode: true,
  },
  'openai/gpt-4.1-nano': {
    name: 'openai/gpt-4.1-nano',
    mode: true,
  },
  'openai/gpt-4o:extended': {
    name: 'openai/gpt-4o:extended',
    mode: true,
  },
  'openai/gpt-4o': {
    name: 'openai/gpt-4o',
    mode: true,
  },
  'openai/gpt-4o-2024-05-13': {
    name: 'openai/gpt-4o-2024-05-13',
    mode: true,
  },
  'openai/gpt-4o-2024-08-06': {
    name: 'openai/gpt-4o-2024-08-06',
    mode: true,
  },
  'openai/gpt-4o-2024-11-20': {
    name: 'openai/gpt-4o-2024-11-20',
    mode: true,
  },
  'openai/gpt-4o-audio-preview': {
    name: 'openai/gpt-4o-audio-preview',
    mode: true,
  },
  'openai/gpt-4o-mini': {
    name: 'openai/gpt-4o-mini',
    mode: true,
  },
  'openai/gpt-4o-mini-2024-07-18': {
    name: 'openai/gpt-4o-mini-2024-07-18',
    mode: true,
  },
  'openai/gpt-4o-mini-search-preview': {
    name: 'openai/gpt-4o-mini-search-preview',
    mode: true,
  },
  'openai/gpt-4o-search-preview': {
    name: 'openai/gpt-4o-search-preview',
    mode: true,
  },
  'openai/gpt-5': {
    name: 'openai/gpt-5',
    mode: true,
  },
  'openai/gpt-5-chat': {
    name: 'openai/gpt-5-chat',
    mode: true,
  },
  'openai/gpt-5-codex': {
    name: 'openai/gpt-5-codex',
    mode: true,
  },
  'openai/gpt-5-mini': {
    name: 'openai/gpt-5-mini',
    mode: true,
  },
  'openai/gpt-5-nano': {
    name: 'openai/gpt-5-nano',
    mode: true,
  },
  'openai/gpt-5-pro': {
    name: 'openai/gpt-5-pro',
    mode: true,
  },
  'openai/gpt-5.1': {
    name: 'openai/gpt-5.1',
    mode: true,
  },
  'openai/gpt-5.1-chat': {
    name: 'openai/gpt-5.1-chat',
    mode: true,
  },
  'openai/gpt-5.1-codex': {
    name: 'openai/gpt-5.1-codex',
    mode: true,
  },
  'openai/gpt-5.1-codex-max': {
    name: 'openai/gpt-5.1-codex-max',
    mode: true,
  },
  'openai/gpt-5.1-codex-mini': {
    name: 'openai/gpt-5.1-codex-mini',
    mode: true,
  },
  'openai/gpt-5.2': {
    name: 'openai/gpt-5.2',
    mode: true,
  },
  'openai/gpt-5.2-chat': {
    name: 'openai/gpt-5.2-chat',
    mode: true,
  },
  'openai/gpt-5.2-pro': {
    name: 'openai/gpt-5.2-pro',
    mode: true,
  },
  'openai/gpt-5.3-codex': {
    name: 'openai/gpt-5.3-codex',
    mode: true,
  },
  'openai/gpt-5.4': {
    name: 'openai/gpt-5.4',
    mode: true,
  },
  'openai/gpt-5.4-pro': {
    name: 'openai/gpt-5.4-pro',
    mode: true,
  },
  'openai/gpt-audio': {
    name: 'openai/gpt-audio',
    mode: true,
  },
  'openai/gpt-audio-mini': {
    name: 'openai/gpt-audio-mini',
    mode: true,
  },
  'openai/gpt-oss-120b:exacto': {
    name: 'openai/gpt-oss-120b:exacto',
    mode: true,
  },
  'openai/gpt-oss-120b': {
    name: 'openai/gpt-oss-120b',
    mode: true,
  },
  'openai/gpt-oss-20b': {
    name: 'openai/gpt-oss-20b',
    mode: true,
  },
  'openai/gpt-oss-safeguard-20b': {
    name: 'openai/gpt-oss-safeguard-20b',
    mode: true,
  },
  'openai/o1': {
    name: 'openai/o1',
    mode: true,
  },
  'openai/o1-pro': {
    name: 'openai/o1-pro',
    mode: true,
  },
  'openai/o3': {
    name: 'openai/o3',
    mode: true,
  },
  'openai/o3-deep-research': {
    name: 'openai/o3-deep-research',
    mode: true,
  },
  'openai/o3-mini': {
    name: 'openai/o3-mini',
    mode: true,
  },
  'openai/o3-mini-high': {
    name: 'openai/o3-mini-high',
    mode: true,
  },
  'openai/o3-pro': {
    name: 'openai/o3-pro',
    mode: true,
  },
  'openai/o4-mini': {
    name: 'openai/o4-mini',
    mode: true,
  },
  'openai/o4-mini-deep-research': {
    name: 'openai/o4-mini-deep-research',
    mode: true,
  },
  'openai/o4-mini-high': {
    name: 'openai/o4-mini-high',
    mode: true,
  },
  'perplexity/sonar': {
    name: 'perplexity/sonar',
    mode: true,
  },
  'perplexity/sonar-deep-research': {
    name: 'perplexity/sonar-deep-research',
    mode: true,
  },
  'perplexity/sonar-pro': {
    name: 'perplexity/sonar-pro',
    mode: true,
  },
  'perplexity/sonar-pro-search': {
    name: 'perplexity/sonar-pro-search',
    mode: true,
  },
  'perplexity/sonar-reasoning-pro': {
    name: 'perplexity/sonar-reasoning-pro',
    mode: true,
  },
  'playgroundai/playground-v25': {
    name: 'playgroundai/playground-v25',
    mode: true,
  },
  'prime-intellect/intellect-3': {
    name: 'prime-intellect/intellect-3',
    mode: true,
  },
  'qwen/qwen-2.5-72b-instruct': {
    name: 'qwen/qwen-2.5-72b-instruct',
    mode: true,
  },
  'qwen/qwen-2.5-7b-instruct': {
    name: 'qwen/qwen-2.5-7b-instruct',
    mode: true,
  },
  'qwen/qwen-2.5-coder-32b-instruct': {
    name: 'qwen/qwen-2.5-coder-32b-instruct',
    mode: true,
  },
  'qwen/qwen-max': {
    name: 'qwen/qwen-max',
    mode: true,
  },
  'qwen/qwen-plus': {
    name: 'qwen/qwen-plus',
    mode: true,
  },
  'qwen/qwen-plus-2025-07-28:thinking': {
    name: 'qwen/qwen-plus-2025-07-28:thinking',
    mode: true,
  },
  'qwen/qwen-plus-2025-07-28': {
    name: 'qwen/qwen-plus-2025-07-28',
    mode: true,
  },
  'qwen/qwen-turbo': {
    name: 'qwen/qwen-turbo',
    mode: true,
  },
  'qwen/qwen2.5-coder-7b-instruct': {
    name: 'qwen/qwen2.5-coder-7b-instruct',
    mode: true,
  },
  'qwen/qwen3-14b': {
    name: 'qwen/qwen3-14b',
    mode: true,
  },
  'qwen/qwen3-235b-a22b': {
    name: 'qwen/qwen3-235b-a22b',
    mode: true,
  },
  'qwen/qwen3-235b-a22b-2507': {
    name: 'qwen/qwen3-235b-a22b-2507',
    mode: true,
  },
  'qwen/qwen3-235b-a22b-thinking-2507': {
    name: 'qwen/qwen3-235b-a22b-thinking-2507',
    mode: true,
  },
  'qwen/qwen3-30b-a3b': {
    name: 'qwen/qwen3-30b-a3b',
    mode: true,
  },
  'qwen/qwen3-30b-a3b-instruct-2507': {
    name: 'qwen/qwen3-30b-a3b-instruct-2507',
    mode: true,
  },
  'qwen/qwen3-30b-a3b-thinking-2507': {
    name: 'qwen/qwen3-30b-a3b-thinking-2507',
    mode: true,
  },
  'qwen/qwen3-32b': {
    name: 'qwen/qwen3-32b',
    mode: true,
  },
  'qwen/qwen3-4b:free': {
    name: 'qwen/qwen3-4b:free',
    mode: true,
  },
  'qwen/qwen3-8b': {
    name: 'qwen/qwen3-8b',
    mode: true,
  },
  'qwen/qwen3-coder:free': {
    name: 'qwen/qwen3-coder:free',
    mode: true,
  },
  'qwen/qwen3-coder:exacto': {
    name: 'qwen/qwen3-coder:exacto',
    mode: true,
  },
  'qwen/qwen3-coder-30b-a3b-instruct': {
    name: 'qwen/qwen3-coder-30b-a3b-instruct',
    mode: true,
  },
  'qwen/qwen3-coder-flash': {
    name: 'qwen/qwen3-coder-flash',
    mode: true,
  },
  'qwen/qwen3-coder-plus': {
    name: 'qwen/qwen3-coder-plus',
    mode: true,
  },
  'qwen/qwen3-next-80b-a3b-instruct': {
    name: 'qwen/qwen3-next-80b-a3b-instruct',
    mode: true,
  },
  'qwen/qwen3-next-80b-a3b-instruct:free': {
    name: 'qwen/qwen3-next-80b-a3b-instruct:free',
    mode: true,
  },
  'qwen/qwen3-next-80b-a3b-thinking': {
    name: 'qwen/qwen3-next-80b-a3b-thinking',
    mode: true,
  },
  'qwen/qwq-32b': {
    name: 'qwen/qwq-32b',
    mode: true,
  },
  'raifle/sorcererlm-8x22b': {
    name: 'raifle/sorcererlm-8x22b',
    mode: true,
  },
  'relace/relace-apply-3': {
    name: 'relace/relace-apply-3',
    mode: true,
  },
  'relace/relace-search': {
    name: 'relace/relace-search',
    mode: true,
  },
  'sao10k/l3-euryale-70b': {
    name: 'sao10k/l3-euryale-70b',
    mode: true,
  },
  'sao10k/l3-lunaris-8b': {
    name: 'sao10k/l3-lunaris-8b',
    mode: true,
  },
  'sao10k/l3.1-70b-hanami-x1': {
    name: 'sao10k/l3.1-70b-hanami-x1',
    mode: true,
  },
  'sao10k/l3.1-euryale-70b': {
    name: 'sao10k/l3.1-euryale-70b',
    mode: true,
  },
  'sao10k/l3.3-euryale-70b': {
    name: 'sao10k/l3.3-euryale-70b',
    mode: true,
  },
  'stepfun-ai/step3': {
    name: 'stepfun-ai/step3',
    mode: true,
  },
  'tencent/hunyuan-a13b-instruct': {
    name: 'tencent/hunyuan-a13b-instruct',
    mode: true,
  },
  'thedrummer/cydonia-24b-v4.1': {
    name: 'thedrummer/cydonia-24b-v4.1',
    mode: true,
  },
  'thedrummer/rocinante-12b': {
    name: 'thedrummer/rocinante-12b',
    mode: true,
  },
  'thedrummer/skyfall-36b-v2': {
    name: 'thedrummer/skyfall-36b-v2',
    mode: true,
  },
  'thedrummer/unslopnemo-12b': {
    name: 'thedrummer/unslopnemo-12b',
    mode: true,
  },
  'tngtech/deepseek-r1t-chimera': {
    name: 'tngtech/deepseek-r1t-chimera',
    mode: true,
  },
  'tngtech/deepseek-r1t-chimera:free': {
    name: 'tngtech/deepseek-r1t-chimera:free',
    mode: true,
  },
  'tngtech/deepseek-r1t2-chimera:free': {
    name: 'tngtech/deepseek-r1t2-chimera:free',
    mode: true,
  },
  'tngtech/tng-r1t-chimera:free': {
    name: 'tngtech/tng-r1t-chimera:free',
    mode: true,
  },
  'undi95/remm-slerp-l2-13b': {
    name: 'undi95/remm-slerp-l2-13b',
    mode: true,
  },
  'upstage/solar-pro-3:free': {
    name: 'upstage/solar-pro-3:free',
    mode: true,
  },
  'writer/palmyra-x5': {
    name: 'writer/palmyra-x5',
    mode: true,
  },
  'x-ai/grok-3': {
    name: 'x-ai/grok-3',
    mode: true,
  },
  'x-ai/grok-3-beta': {
    name: 'x-ai/grok-3-beta',
    mode: true,
  },
  'x-ai/grok-3-mini': {
    name: 'x-ai/grok-3-mini',
    mode: true,
  },
  'x-ai/grok-3-mini-beta': {
    name: 'x-ai/grok-3-mini-beta',
    mode: true,
  },
  'x-ai/grok-4': {
    name: 'x-ai/grok-4',
    mode: true,
  },
  'x-ai/grok-4-fast': {
    name: 'x-ai/grok-4-fast',
    mode: true,
  },
  'x-ai/grok-4.1-fast': {
    name: 'x-ai/grok-4.1-fast',
    mode: true,
  },
  'x-ai/grok-code-fast-1': {
    name: 'x-ai/grok-code-fast-1',
    mode: true,
  },
  'xiaomi/mimo-v2-flash': {
    name: 'xiaomi/mimo-v2-flash',
    mode: true,
  },
  'z-ai/glm-4-32b': {
    name: 'z-ai/glm-4-32b',
    mode: true,
  },
  'z-ai/glm-4.5': {
    name: 'z-ai/glm-4.5',
    mode: true,
  },
  'z-ai/glm-4.5-air:free': {
    name: 'z-ai/glm-4.5-air:free',
    mode: true,
  },
  'z-ai/glm-4.5-air': {
    name: 'z-ai/glm-4.5-air',
    mode: true,
  },
  'z-ai/glm-4.5v': {
    name: 'z-ai/glm-4.5v',
    mode: true,
  },
  'z-ai/glm-4.6:exacto': {
    name: 'z-ai/glm-4.6:exacto',
    mode: true,
  },
  'z-ai/glm-4.6': {
    name: 'z-ai/glm-4.6',
    mode: true,
  },
  'z-ai/glm-4.6v': {
    name: 'z-ai/glm-4.6v',
    mode: true,
  },
  'z-ai/glm-4.7': {
    name: 'z-ai/glm-4.7',
    mode: true,
  },
  'z-ai/glm-4.7-flash': {
    name: 'z-ai/glm-4.7-flash',
    mode: true,
  },
};
