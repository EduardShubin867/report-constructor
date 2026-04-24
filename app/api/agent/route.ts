import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { ModelMessage } from 'ai';
import { orchestrate } from '@/lib/agents/orchestrator';
import type { AgentEvent } from '@/lib/agents/types';
import type { AgentResponseOutput } from '@/lib/agents/agent-response-schema';
import { recordAgentRun } from '@/lib/agent-analytics';
import { normalizeAnalysisContext } from '@/lib/analysis-context';
import { getBusinessToday } from '@/lib/business-time';
import { logger } from '@/lib/logger';
import type { AnalysisContext, OsagoChartSpec } from '@/lib/report-history-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // seconds — agent does multiple LLM roundtrips

/** Response shape returned by sub-agents after structured output + SSE */
export interface AgentResponse extends AgentResponseOutput {
  _skillRounds?: number;
  _selectedSource?: { sourceId: string; sourceName: string };
  _analysisContext?: AnalysisContext;
  format?: 'plain' | 'markdown';
  charts?: OsagoChartSpec[];
  metadata?: unknown;
}

/** SSE event types sent to the client */
export type SSEEvent = AgentEvent;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY не настроен' }, { status: 500 });
  }

  let body: {
    query: string;
    previousSql?: string;
    retryError?: string;
    skipAutoRowLimit?: boolean;
    chatSessionId?: string;
    history?: ModelMessage[];
    analysisContext?: AnalysisContext;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { query, previousSql, retryError, skipAutoRowLimit, chatSessionId, history } = body;
  const analysisContext = normalizeAnalysisContext(body.analysisContext);
  if (!query?.trim()) {
    return Response.json({ error: 'Запрос не может быть пустым' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const requestId = randomUUID();
      const events: AgentEvent[] = [];
      const send = (event: AgentEvent) => {
        const enriched: AgentEvent = event.id ? event : { ...event, id: randomUUID() };
        events.push(enriched);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(enriched)}\n\n`));
      };

      const startTime = Date.now();
      logger.info('agent.request.start', 'SSE request started', { requestId });

      try {
        const today = getBusinessToday();

        await orchestrate({
          ctx: {
            requestId,
            ...(typeof chatSessionId === 'string' && chatSessionId.trim().length > 0
              ? { chatSessionId: chatSessionId.trim() }
              : {}),
            today,
            query,
            previousSql,
            retryError,
            ...(skipAutoRowLimit === true ? { skipAutoRowLimit: true } : {}),
            ...(Array.isArray(history) && history.length > 0 ? { history } : {}),
            ...(analysisContext ? { analysisContext } : {}),
          },
          send,
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        logger.error('agent.request', 'orchestrate threw', {
          requestId,
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        });
        const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
        send({ type: 'error', error: message });
      } finally {
        logger.info('agent.request.end', 'SSE request finished', {
          requestId,
          durationMs: Date.now() - startTime,
        });
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
