/**
 * Orchestrator — routes user queries to the appropriate sub-agent.
 *
 * Routing priority:
 * 1. match() scoring → if exactly one agent scores ≥ MATCH_THRESHOLD, use it
 * 2. LLM routing → ask LLM to pick from agent catalog (fallback)
 */

import { generateText } from 'ai';
import type { AgentContext, AgentEventSink, SubAgentConfig } from './types';
import { getAllAgents, getAgent, resolveRouterModel, getAgentCatalog } from './registry';
import { runAgent } from './runner';
import { AGENT_DEBUG_ENABLED } from '@/lib/constants';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import { pickDataSource } from './source-router';
import { logger } from '@/lib/logger';

/** Minimum match() score to route without LLM */
const MATCH_THRESHOLD = 0.5;

interface MatchRoutingCandidate {
  agent: SubAgentConfig;
  score: number;
}

interface MatchRoutingResult {
  selected: SubAgentConfig | null;
  candidates: MatchRoutingCandidate[];
  reason: 'matched' | 'ambiguous' | 'no_match';
}

export interface OrchestratorOptions {
  ctx: AgentContext;
  send: AgentEventSink;
  /**
   * Model override for the orchestrator's routing decision.
   * Uses env/default if not specified.
   */
  routerModel?: string;
}

/**
 * Run the orchestrator.
 */
export async function orchestrate(opts: OrchestratorOptions): Promise<void> {
  const { ctx, send } = opts;
  const agents = getAllAgents();

  if (agents.length === 0) {
    send({ type: 'error', error: 'Нет зарегистрированных агентов' });
    return;
  }

  /* ── 0. Pick data source ───────────────────────────────────────── */
  try {
    const picked = await pickDataSource(ctx, send, opts.routerModel);
    ctx.selectedSourceId = picked.sourceId;
    send({ type: 'source_selected', sourceId: picked.sourceId, sourceName: picked.sourceName });
  } catch (err) {
    logger.error('orchestrator.source_routing', 'Source routing failed', {
      requestId: ctx.requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    send({
      type: 'error',
      error: err instanceof Error ? err.message : 'Не удалось выбрать источник данных',
    });
    return;
  }

  /* ── 1. Try match() scoring ─────────────────────────────────────── */
  const matched = tryMatchRouting(agents, ctx);
  send({
    type: 'debug',
    scope: 'orchestrator',
    message: 'Проверяю fast-match маршрутизацию',
    data: {
      threshold: MATCH_THRESHOLD,
      candidates: matched.candidates.map(({ agent, score }) => ({
        name: agent.name,
        score: Number(score.toFixed(3)),
      })),
    },
  });

  if (matched.selected) {
    logger.info('orchestrator.match', 'Matched by score', {
      requestId: ctx.requestId,
      agent: matched.selected.name,
      score: matched.candidates[0]?.score,
    });
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'Маршрут выбран без LLM',
      data: {
        reason: matched.reason,
        agent: matched.selected.name,
      },
    });
    send({ type: 'sub_agent', name: matched.selected.name });
    await runAgent({ agent: matched.selected, ctx, send });
    return;
  }

  send({
    type: 'debug',
    scope: 'orchestrator',
    message: matched.reason === 'ambiguous'
      ? 'Fast-match дал неоднозначный результат, переключаюсь на LLM routing'
      : 'Fast-match не нашёл уверенного кандидата, переключаюсь на LLM routing',
    level: matched.reason === 'ambiguous' ? 'warn' : 'info',
  });

  /* ── 2. LLM routing (fallback) ──────────────────────────────────── */
  const chosenName = await routeQueryLLM(ctx, send, opts.routerModel);
  const agent = getAgent(chosenName);
  if (!agent) {
    logger.warn('orchestrator.llm_routing', 'LLM returned unknown agent, falling back', {
      requestId: ctx.requestId,
      returned: chosenName,
      fallback: agents[0].name,
    });
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM вернул неизвестного агента, беру fallback',
      level: 'warn',
      data: {
        returned: chosenName,
        fallback: agents[0].name,
      },
    });
    send({ type: 'sub_agent', name: agents[0].name });
    await runAgent({ agent: agents[0], ctx, send });
    return;
  }

  send({ type: 'sub_agent', name: agent.name });
  await runAgent({ agent, ctx, send });
}

/* ────────────────────────────────────────────────────────────────────
 * Level 2: match() scoring
 * ──────────────────────────────────────────────────────────────────── */

function tryMatchRouting(
  agents: SubAgentConfig[],
  ctx: AgentContext,
): MatchRoutingResult {
  const scored: MatchRoutingCandidate[] = [];

  for (const agent of agents) {
    if (!agent.match) continue;
    try {
      const score = agent.match(ctx);
      if (score >= MATCH_THRESHOLD) {
        scored.push({ agent, score });
      }
    } catch (err) {
      logger.warn('orchestrator.match', 'match() threw', {
        requestId: ctx.requestId,
        agent: agent.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (scored.length === 0) {
    return { selected: null, candidates: [], reason: 'no_match' };
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // If top two have the same score → ambiguous → let LLM decide
  if (scored.length >= 2 && scored[0].score === scored[1].score) {
    logger.info('orchestrator.match', 'Ambiguous match — falling back to LLM', {
      requestId: ctx.requestId,
      candidates: scored.slice(0, 2).map(c => c.agent.name),
      score: scored[0].score,
    });
    return { selected: null, candidates: scored, reason: 'ambiguous' };
  }

  return { selected: scored[0].agent, candidates: scored, reason: 'matched' };
}

/* ────────────────────────────────────────────────────────────────────
 * Level 3: LLM-based routing
 * ──────────────────────────────────────────────────────────────────── */

async function routeQueryLLM(
  ctx: AgentContext,
  send: AgentEventSink,
  routerModel?: string,
): Promise<string> {
  const catalog = getAgentCatalog();
  const agentList = catalog
    .map(a => `- **${a.name}**: ${a.description}`)
    .join('\n');

  const system = `Ты — маршрутизатор запросов. Твоя задача — определить, какой суб-агент лучше всего подходит для обработки запроса пользователя.

Доступные суб-агенты:
${agentList}

Ответь ТОЛЬКО именем суб-агента (одно слово/slug). Ничего больше.`;
  const messages = [{ role: 'user' as const, content: ctx.query }];

  const openrouter = createAppOpenRouter();
  const modelId = resolveRouterModel(routerModel);
  const model = openrouter(modelId);

  send({
    type: 'debug',
    scope: 'orchestrator',
    message: 'Запускаю LLM routing',
    data: {
      model: modelId,
      agents: catalog.map(agent => agent.name),
    },
  });

  if (AGENT_DEBUG_ENABLED) {
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM request payload маршрутизатора',
      data: {
        request: {
          model: modelId,
          temperature: 0,
          systemPrompt: system,
          messages,
        },
      },
    });
  }

  try {
    const { text } = await generateText({
      model,
      system,
      messages,
      temperature: 0,
    });

    const name = text.trim();
    logger.info('orchestrator.llm_routing', 'LLM routed', {
      requestId: ctx.requestId,
      agent: name,
      model: modelId,
    });
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM routing завершён',
      data: { agent: name },
    });
    return name;
  } catch (err) {
    logger.error('orchestrator.llm_routing', 'LLM routing failed, using first agent', {
      requestId: ctx.requestId,
      fallback: catalog[0].name,
      error: err instanceof Error ? err.message : String(err),
    });
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM routing упал, использую первый доступный агент',
      level: 'error',
      data: {
        fallback: catalog[0].name,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    });
    return catalog[0].name;
  }
}
