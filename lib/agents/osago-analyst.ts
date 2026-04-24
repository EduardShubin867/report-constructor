import type { SubAgentConfig } from './types';
import {
  requestOsagoAgentMessage,
  rewriteOsagoChartUrls,
} from '@/lib/osago-agent-client';
import { normalizeOsagoChartSpecs } from '@/lib/osago-chart-specs';
import { buildAnalysisContextSummary, isLikelyContextFollowUpQuery } from '@/lib/analysis-context';

function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? '/constructor';
}

function getHeartbeatMs(): number {
  const heartbeatMs = Number(process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS ?? '15000');
  return Number.isFinite(heartbeatMs) && heartbeatMs > 0 ? heartbeatMs : 15000;
}

function buildOsagoAgentQuery(
  query: string,
  analysisContext: Parameters<typeof buildAnalysisContextSummary>[0],
): string {
  const contextSummary = buildAnalysisContextSummary(analysisContext);
  if (!contextSummary || !isLikelyContextFollowUpQuery(query)) {
    return query;
  }

  return `Это продолжение предыдущего анализа ОСАГО. Сохрани тему, период и метрики из контекста, если пользователь явно не меняет их. Если в новой реплике назван другой регион, ДГ, агент или период — замени только этот фильтр.

${contextSummary}

Новый запрос пользователя: ${query}`;
}

const osagoAnalyst: SubAgentConfig = {
  name: 'osago-analyst',
  description: 'ОСАГО-агент (ML): аналитические вопросы по марже ОСАГО — убыточность, LR, прогнозы, объяснение трендов, причины изменений. Использует ML-бэкенд, а не SQL.',

  async run(ctx, send) {
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
      data: { query: ctx.query },
    });

    try {
      const requestQuery = buildOsagoAgentQuery(ctx.query, ctx.analysisContext);
      const response = await requestOsagoAgentMessage({
        query: requestQuery,
        chatId: ctx.chatSessionId ?? ctx.requestId,
      });

      const explanation = rewriteOsagoChartUrls(response.content, getBasePath());
      const charts = normalizeOsagoChartSpecs(response.metadata?.chart_specs);

      send({
        type: 'result',
        data: {
          sql: '',
          explanation,
          suggestions: [],
          format: 'markdown',
          ...(charts.length > 0 ? { charts } : {}),
          sessionId: response.session_id,
          messageId: response.id,
          metadata: response.metadata ?? null,
        },
      });
    } catch (err) {
      send({
        type: 'error',
        error: `ОСАГО-агент недоступен: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      clearInterval(heartbeat);
    }
  },

  // Unused when run() is defined — required by interface
  buildSystemPrompt: () => '',
  buildUserMessage: (ctx) => ctx.query,
};

export default osagoAnalyst;
