import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * OpenRouter client for Vercel AI SDK (shared headers for OpenRouter analytics).
 */
export function createAppOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      'X-Title': 'OSAGO Report Generator',
    },
  });
}
