import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  requestOsagoAgentMessage,
  rewriteOsagoChartUrls,
} from '@/lib/osago-agent-client';
import { normalizeOsagoChartSpecs } from '@/lib/osago-chart-specs';

export const dynamic = 'force-dynamic';
export const maxDuration = 1200;

type OsagoAgentEvent =
  | { type: 'phase'; phase: string; id?: string }
  | { type: 'trace'; scope: string; message: string; durationMs?: number; data?: Record<string, unknown>; id?: string }
  | { type: 'result'; data: Record<string, unknown>; id?: string }
  | { type: 'error'; error: string; id?: string };

function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? '/constructor';
}

function getHeartbeatMs(): number {
  const heartbeatMs = Number(process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS ?? '15000');
  return Number.isFinite(heartbeatMs) && heartbeatMs > 0 ? heartbeatMs : 15000;
}

function encodeEvent(event: OsagoAgentEvent): Uint8Array {
  const enriched = event.id ? event : { ...event, id: randomUUID() };
  return new TextEncoder().encode(`data: ${JSON.stringify(enriched)}\n\n`);
}

export async function POST(request: NextRequest) {
  let body: { query?: string; chatId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const query = body.query?.trim();
  const chatId = body.chatId?.trim();
  if (!query) {
    return NextResponse.json({ error: 'Запрос не может быть пустым' }, { status: 400 });
  }
  if (!chatId) {
    return NextResponse.json({ error: 'chatId обязателен' }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      const send = (event: OsagoAgentEvent) => {
        if (isClosed) return;
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          isClosed = true;
          clearInterval(heartbeat);
        }
      };
      const startedAt = Date.now();
      const heartbeat = setInterval(() => {
        const elapsedMs = Date.now() - startedAt;
        send({
          type: 'trace',
          scope: 'osago-agent',
          message: 'ОСАГО-агент всё ещё считает ответ…',
          durationMs: elapsedMs,
          data: { elapsedSeconds: Math.round(elapsedMs / 1000) },
        });
      }, getHeartbeatMs());

      send({ type: 'phase', phase: 'thinking' });
      send({
        type: 'trace',
        scope: 'osago-agent',
        message: 'Отправляю запрос ОСАГО-агенту',
        data: { chatId },
      });

      try {
        const response = await requestOsagoAgentMessage({ query, chatId });
        const explanation = rewriteOsagoChartUrls(response.content, getBasePath());
        const charts = normalizeOsagoChartSpecs(response.metadata?.chart_specs);

        send({
          type: 'result',
          data: {
            explanation,
            suggestions: [],
            format: 'markdown',
            charts,
            sessionId: response.session_id,
            messageId: response.id,
            metadata: response.metadata ?? null,
          },
        });
      } catch (error) {
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'ОСАГО-агент недоступен',
        });
      } finally {
        clearInterval(heartbeat);
        if (isClosed) return;
        isClosed = true;
        controller.close();
      }
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
