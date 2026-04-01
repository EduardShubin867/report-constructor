/** Message in the LLM conversation (OpenAI-compatible format) */
export interface LLMMessage {
  role: string;
  content?: string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
}

/** Tool call returned by the model */
export interface LLMToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** Options for a single LLM call */
export interface LLMCallOptions {
  model: string;
  messages: LLMMessage[];
  tools?: unknown[];
  toolChoice?: string;
  temperature?: number;
  responseFormat?: { type: string };
}

/** Result of a single LLM call */
export interface LLMCallResult {
  message: LLMMessage;
  finishReason: string;
}

/** Provider interface — abstracts the LLM API transport */
export interface LLMProvider {
  call(options: LLMCallOptions): Promise<LLMCallResult>;
}
