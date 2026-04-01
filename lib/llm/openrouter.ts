import type { LLMProvider, LLMCallOptions, LLMCallResult } from './types';

export interface OpenRouterConfig {
  apiKey: string;
  siteUrl?: string;
  siteTitle?: string;
}

export function createOpenRouterProvider(config: OpenRouterConfig): LLMProvider {
  return {
    async call(options: LLMCallOptions): Promise<LLMCallResult> {
      const payload: Record<string, unknown> = {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.1,
      };

      if (options.tools) {
        payload.tools = options.tools;
        payload.tool_choice = options.toolChoice ?? 'auto';
      }
      if (options.responseFormat) {
        payload.response_format = options.responseFormat;
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.siteUrl ?? 'http://localhost:3000',
          'X-Title': config.siteTitle ?? 'OSAGO Report Generator',
        },
        body: Buffer.from(JSON.stringify(payload), 'utf-8'),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('OpenRouter error:', err);
        throw new Error('Ошибка AI-сервиса');
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) throw new Error('Пустой ответ от модели');

      return {
        message: choice.message,
        finishReason: choice.finish_reason ?? '',
      };
    },
  };
}
