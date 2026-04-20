/**
 * Source router — picks ONE data source for the user query via LLM,
 * before a sub-agent runs. This keeps sub-agent prompts focused on a
 * single schema and avoids the "always ОСАГО" default behaviour.
 */

import { generateText } from 'ai';
import type { AgentContext, AgentEventSink } from './types';
import { getDataSources } from '@/lib/schema';
import { resolveRouterModel } from './registry';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import { AGENT_DEBUG_ENABLED } from '@/lib/constants';
import { logger } from '@/lib/logger';

export interface SourceRoutingResult {
  sourceId: string;
  sourceName: string;
  /** How the decision was made — for debug/telemetry */
  reason: 'single' | 'llm' | 'fallback';
}

/**
 * Pick a data source for this query.
 *
 * - 0 sources registered → throws.
 * - 1 source → returned directly, no LLM call.
 * - N sources → LLM picks by id using (name + whenToUse) catalog.
 *   Unknown id / LLM error → fallback to the first source.
 */
export async function pickDataSource(
  ctx: AgentContext,
  send: AgentEventSink,
  routerModel?: string,
): Promise<SourceRoutingResult> {
  const sources = getDataSources();

  if (sources.length === 0) {
    throw new Error('Нет зарегистрированных источников данных');
  }

  if (sources.length === 1) {
    const only = sources[0];
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'Выбран единственный источник данных',
      data: { sourceId: only.id },
    });
    return { sourceId: only.id, sourceName: only.name, reason: 'single' };
  }

  const catalog = sources
    .map(s => {
      const hint = s.whenToUse?.trim();
      return `- ${s.id} — ${s.name}${hint ? `\n  Когда использовать: ${hint}` : ''}`;
    })
    .join('\n');

  const system = `Ты — маршрутизатор источников данных. По запросу пользователя выбери ОДИН источник из списка.

Доступные источники:
${catalog}

Отвечай ТОЛЬКО идентификатором источника (значение до тире). Никаких пояснений, кавычек или markdown.`;

  const messages = [{ role: 'user' as const, content: ctx.query }];
  const openrouter = createAppOpenRouter();
  const modelId = resolveRouterModel(routerModel);
  const model = openrouter(modelId);

  send({
    type: 'debug',
    scope: 'orchestrator',
    message: 'Запускаю LLM-выбор источника данных',
    data: {
      model: modelId,
      sources: sources.map(s => s.id),
    },
  });

  if (AGENT_DEBUG_ENABLED) {
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM request payload source-router',
      data: { request: { model: modelId, temperature: 0, systemPrompt: system, messages } },
    });
  }

  try {
    const { text } = await generateText({ model, system, messages, temperature: 0 });
    const answer = text.trim().replace(/^['"`]+|['"`]+$/g, '');
    const match = sources.find(s => s.id === answer);
    if (match) {
      send({
        type: 'debug',
        scope: 'orchestrator',
        message: 'Источник выбран LLM',
        data: { sourceId: match.id },
      });
      return { sourceId: match.id, sourceName: match.name, reason: 'llm' };
    }

    logger.warn('source_router', 'LLM returned unknown source, falling back', {
      requestId: ctx.requestId,
      returned: answer,
      fallback: sources[0].id,
    });
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM вернул неизвестный источник, беру fallback',
      level: 'warn',
      data: { returned: answer, fallback: sources[0].id },
    });
    return { sourceId: sources[0].id, sourceName: sources[0].name, reason: 'fallback' };
  } catch (err) {
    logger.error('source_router', 'LLM routing failed, using first source', {
      requestId: ctx.requestId,
      fallback: sources[0].id,
      error: err instanceof Error ? err.message : String(err),
    });
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM source routing упал, использую первый доступный источник',
      level: 'error',
      data: {
        fallback: sources[0].id,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    });
    return { sourceId: sources[0].id, sourceName: sources[0].name, reason: 'fallback' };
  }
}
