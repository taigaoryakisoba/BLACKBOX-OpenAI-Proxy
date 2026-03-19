export interface ModelConfig {
  id: string;
  name: string;
  mode: boolean;
}

export interface ToolCall {
  name: string;
  arguments: string;
}

export interface OpenAIMessage {
  role: string;
  content: string;
  id?: string;
  createdAt?: string;
  modelLabel?: string;
}

export interface BlackboxMessage {
  id: string;
  createdAt: string;
  content: string;
  role: string;
  modelLabel?: string;
}
