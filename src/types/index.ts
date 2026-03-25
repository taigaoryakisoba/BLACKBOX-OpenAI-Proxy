export interface ModelConfig {
  id: string;
  name: string;
  mode: boolean;
}

export interface ToolCall {
  kind?: string;
  name: string;
  arguments: string;
  payload?: any;
  apiType?: string;
}

export interface OpenAIMessage {
  role: string;
  content: string | any[];
  id?: string;
  createdAt?: string;
  modelLabel?: string;
}

export interface BlackboxImageData {
  filePath: string;
  contents: string;
}

export interface BlackboxMessageData {
  imagesData?: BlackboxImageData[];
  fileText?: string;
  title?: string;
}

export interface BlackboxMessage {
  id: string;
  createdAt: string;
  content: string;
  role: string;
  modelLabel?: string;
  data?: BlackboxMessageData;
}
