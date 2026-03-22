export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  proxy?: {
    responseTimeSec: number;
    raw: any;
  };
}

export interface CompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text: string;
    index: number;
    logprobs: any;
    finish_reason: string | null;
  }[];
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text: string;
    index: number;
    logprobs: any;
    finish_reason: string | null;
  }[];
  proxy?: {
    responseTimeSec: number;
    raw: any;
  };
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string | null;
    details?: any;
  };
}
