import { NextRequest } from 'next/server';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { AgentEvent } from '@/lib/agents/types';
import type { AgentResponseOutput } from '@/lib/agents/agent-response-schema';
import { recordAgentRun } from '@/lib/agent-analytics';
import { getBusinessToday } from '@/lib/business-time';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // seconds — agent does multiple LLM roundtrips

/** Response shape returned by sub-agents after structured output + SSE */
export interface AgentResponse extends AgentResponseOutput {
  _skillRounds?: number;
}

/** SSE event types sent to the client */
export type SSEEvent = AgentEvent;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY не настроен' }, { status: 500 });
  }

  let body: { query: string; previousSql?: string; retryError?: string; skipAutoRowLimit?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { query, previousSql, retryError, skipAutoRowLimit } = body;
  if (!query?.trim()) {
    return Response.json({ error: 'Запрос не может быть пустым' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const events: AgentEvent[] = [];
      const send = (event: AgentEvent) => {
        events.push(event);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const startTime = Date.now();
      console.log('[Agent] SSE request started');

      try {
        const today = getBusinessToday();

        await orchestrate({
          ctx: {
            today,
            query,
            previousSql,
            retryError,
            ...(skipAutoRowLimit === true ? { skipAutoRowLimit: true } : {}),
          },
          send,
        });
      } catch (err) {
        console.error(`[Agent] Error after ${((Date.now() - startTime) / 1000).toFixed(1)}s:`, err);
        const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
        send({ type: 'error', error: message });
      } finally {
        recordAgentRun({
          userQuery: query,
          events,
          durationMs: Date.now() - startTime,
        });
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
