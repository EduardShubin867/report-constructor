import { NextRequest } from 'next/server';
import { createOpenRouterProvider } from '@/lib/llm/openrouter';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { AgentEvent } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // seconds — agent does multiple LLM roundtrips

/** Response shape returned by the sql-analyst sub-agent */
export interface AgentResponse {
  sql: string;
  explanation: string;
  suggestions: string[];
  canRetry?: boolean;
  _skillRounds?: number;
}

/** SSE event types sent to the client */
export type SSEEvent = AgentEvent;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY не настроен' }, { status: 500 });
  }

  let body: { query: string; previousSql?: string; retryError?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { query, previousSql, retryError } = body;
  if (!query?.trim()) {
    return Response.json({ error: 'Запрос не может быть пустым' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const startTime = Date.now();
      console.log('[Agent] SSE request started');

      try {
        const provider = createOpenRouterProvider({
          apiKey,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        });

        const today = new Date().toISOString().slice(0, 10);

        await orchestrate({
          provider,
          ctx: { today, query, previousSql, retryError },
          send,
        });
      } catch (err) {
        console.error(`[Agent] Error after ${((Date.now() - startTime) / 1000).toFixed(1)}s:`, err);
        const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
        send({ type: 'error', error: message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
