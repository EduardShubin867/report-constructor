/**
 * Orchestrator — routes user queries to the appropriate sub-agent.
 *
 * Routing priority:
 * 1. LLM routing → ask the router model to select a sub-agent from the catalog
 * 2. Fallback → if the router fails or returns an unknown agent, use the first agent
 */

import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { AgentContext, AgentEventSink } from './types';
import { getAllAgents, getAgent, resolveRouterModelCandidates, getAgentCatalog } from './registry';
import { runAgent } from './runner';
import { AGENT_DEBUG_ENABLED } from '@/lib/constants';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import { pickDataSource } from './source-router';
import { logger } from '@/lib/logger';
import { buildAnalysisContextSummary, isLikelyContextFollowUpQuery } from '@/lib/analysis-context';

const routerDecisionSchema = z.object({
  agent: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().trim().min(1).optional(),
});

type RouterDecision = z.infer<typeof routerDecisionSchema>;

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

  /* ── 1. LLM routing ─────────────────────────────────────────────── */
  const decision = await routeQueryLLM(ctx, send, opts.routerModel);
  const agent = getAgent(decision.agent);
  if (!agent) {
    logger.warn('orchestrator.llm_routing', 'LLM returned unknown agent, falling back', {
      requestId: ctx.requestId,
      returned: decision.agent,
      fallback: agents[0].name,
    });
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM вернул неизвестного агента, беру fallback',
      level: 'warn',
      data: {
        returned: decision.agent,
        fallback: agents[0].name,
        ...(decision.confidence !== undefined ? { confidence: decision.confidence } : {}),
        ...(decision.reason ? { reason: decision.reason } : {}),
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
 * LLM-based routing
 * ──────────────────────────────────────────────────────────────────── */

async function routeQueryLLM(
  ctx: AgentContext,
  send: AgentEventSink,
  routerModel?: string,
): Promise<RouterDecision> {
  const catalog = getAgentCatalog();
  const history = ctx.history ?? [];
  const agentList = catalog
    .map(a => `- **${a.name}**: ${a.description}`)
    .join('\n');
  const analysisContextSummary = buildAnalysisContextSummary(ctx.analysisContext);
  const followUpNote = isLikelyContextFollowUpQuery(ctx.query)
    ? `

Правило follow-up:
- Если текущий запрос выглядит как короткое продолжение предыдущего анализа, сохраняй тему, метрики и выбранного специалиста, если пользователь явно не переключил задачу.
- Формулировки вроде "а по москве?", "а за 2024?", "по ним", "разбери глубже" считай продолжением текущей аналитической ветки.`
    : '';

  const system = `Ты — маршрутизатор запросов. Твоя задача — определить, какой суб-агент лучше всего подходит для обработки запроса пользователя.

Доступные суб-агенты:
${agentList}

${analysisContextSummary ? `${analysisContextSummary}\n` : ''}${followUpNote}

Выбери ровно одного суб-агента и верни structured output.
- agent: slug выбранного суб-агента из списка выше
- confidence: уверенность от 0 до 1
- reason: короткая причина выбора на русском

Не придумывай новых имён агентов и не оставляй поля пустыми.`;
  const messages = [...history, { role: 'user' as const, content: ctx.query }];

  const openrouter = createAppOpenRouter();
  const modelIds = resolveRouterModelCandidates(routerModel);

  send({
    type: 'debug',
    scope: 'orchestrator',
    message: 'Запускаю LLM routing',
    data: {
      model: modelIds[0],
      fallbackModels: modelIds.slice(1),
      agents: catalog.map(agent => agent.name),
      historyLength: history.length,
      hasAnalysisContext: Boolean(analysisContextSummary),
    },
  });

  if (AGENT_DEBUG_ENABLED) {
    send({
      type: 'debug',
      scope: 'orchestrator',
      message: 'LLM request payload маршрутизатора',
      data: {
        request: {
          model: modelIds[0],
          fallbackModels: modelIds.slice(1),
          temperature: 0,
          systemPrompt: system,
          messages,
        },
      },
    });
  }

  let lastError: unknown = null;

  for (let index = 0; index < modelIds.length; index++) {
    const modelId = modelIds[index];
    const model = openrouter(modelId);

    if (index > 0) {
      send({
        type: 'debug',
        scope: 'orchestrator',
        message: 'Основная router-model недоступна, пробую fallback model',
        level: 'warn',
        data: {
          attempt: index + 1,
          model: modelId,
          previousModel: modelIds[index - 1],
          error: lastError instanceof Error ? lastError.message : String(lastError),
        },
      });
    }

    try {
      const result = await generateText({
        model,
        system,
        messages,
        temperature: 0,
        output: Output.object({ schema: routerDecisionSchema }),
      });
      const output = result.output;
      if (!output) {
        throw new Error('Router did not return structured output');
      }
      logger.info('orchestrator.llm_routing', 'LLM routed', {
        requestId: ctx.requestId,
        agent: output.agent,
        confidence: output.confidence,
        reason: output.reason,
        model: modelId,
      });
      send({
        type: 'debug',
        scope: 'orchestrator',
        message: 'LLM routing завершён',
        data: {
          model: modelId,
          attempt: index + 1,
          agent: output.agent,
          ...(output.confidence !== undefined ? { confidence: output.confidence } : {}),
          ...(output.reason ? { reason: output.reason } : {}),
        },
      });
      return output;
    } catch (err) {
      lastError = err;
      if (index < modelIds.length - 1) {
        logger.warn('orchestrator.llm_routing', 'Router model failed, retrying fallback model', {
          requestId: ctx.requestId,
          model: modelId,
          fallbackModel: modelIds[index + 1],
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }
  }

  logger.error('orchestrator.llm_routing', 'All router models failed, using first agent', {
    requestId: ctx.requestId,
    attemptedModels: modelIds,
    fallback: catalog[0].name,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  send({
    type: 'debug',
    scope: 'orchestrator',
    message: 'Все router-model недоступны, использую первый доступный агент',
    level: 'error',
    data: {
      attemptedModels: modelIds,
      fallback: catalog[0].name,
      error: lastError instanceof Error ? lastError.message : 'Unknown error',
    },
  });
  return {
    agent: catalog[0].name,
    confidence: 0,
    reason: 'fallback after router model exhaustion',
  };
}
