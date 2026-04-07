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
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';

/** Minimum match() score to route without LLM */
const MATCH_THRESHOLD = 0.5;

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

  /* ── 1. Try match() scoring ─────────────────────────────────────── */
  const matched = tryMatchRouting(agents, ctx);
  if (matched) {
    console.log(`[Orchestrator] Matched by score: ${matched.name}`);
    send({ type: 'sub_agent', name: matched.name });
    await runAgent({ agent: matched, ctx, send });
    return;
  }

  /* ── 2. LLM routing (fallback) ──────────────────────────────────── */
  const chosenName = await routeQueryLLM(ctx, opts.routerModel);
  const agent = getAgent(chosenName);
  if (!agent) {
    console.warn(`[Orchestrator] LLM returned unknown agent "${chosenName}", falling back to ${agents[0].name}`);
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
): SubAgentConfig | null {
  const scored: { agent: SubAgentConfig; score: number }[] = [];

  for (const agent of agents) {
    if (!agent.match) continue;
    try {
      const score = agent.match(ctx);
      if (score >= MATCH_THRESHOLD) {
        scored.push({ agent, score });
      }
    } catch (err) {
      console.warn(`[Orchestrator] match() error for ${agent.name}:`, err);
    }
  }

  if (scored.length === 0) return null;

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // If top two have the same score → ambiguous → let LLM decide
  if (scored.length >= 2 && scored[0].score === scored[1].score) {
    console.log(`[Orchestrator] Ambiguous match (${scored[0].agent.name} vs ${scored[1].agent.name}), falling back to LLM`);
    return null;
  }

  return scored[0].agent;
}

/* ────────────────────────────────────────────────────────────────────
 * Level 3: LLM-based routing
 * ──────────────────────────────────────────────────────────────────── */

async function routeQueryLLM(
  ctx: AgentContext,
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

  const openrouter = createAppOpenRouter();
  const model = openrouter(resolveRouterModel(routerModel));

  try {
    const { text } = await generateText({
      model,
      system,
      messages: [{ role: 'user', content: ctx.query }],
      temperature: 0,
    });

    const name = text.trim();
    console.log(`[Orchestrator] LLM routed to: ${name}`);
    return name;
  } catch (err) {
    console.error('[Orchestrator] LLM routing failed, using first agent:', err);
    return catalog[0].name;
  }
}
