/**
 * Generic agent runner — Vercel AI SDK generateText + tools + structured output.
 */

import { generateText, NoObjectGeneratedError, Output, stepCountIs } from 'ai';
import type { RunnerOptions } from './types';
import { resolveAgentModel } from './registry';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import { AGENT_DEBUG_ENABLED } from '@/lib/constants';
import { buildAgentToolSet } from '@/lib/skills/registry';
import { logger } from '@/lib/logger';
import {
  agentResponseSchema,
  filterTechnicalExplanation,
  tryParseAgentResponseFromText,
} from './agent-response-schema';

const DEFAULT_MAX_ROUNDS = 5;

/** Extra steps beyond tool rounds for the structured-output final step (+ buffer). */
const STRUCTURED_OUTPUT_STEP_BUFFER = 4;

function toolCallArgs(tc: { input?: unknown }): Record<string, unknown> {
  const input = tc.input;
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

export async function runAgent(opts: RunnerOptions): Promise<void> {
  const { agent, ctx, send } = opts;
  const openrouter = createAppOpenRouter();
  const modelId = resolveAgentModel(agent.model);
  const model = openrouter(modelId);
  const tools = buildAgentToolSet(
    ctx.skipAutoRowLimit ? { skipAutoRowLimit: true } : undefined,
  );
  const systemPrompt = agent.buildSystemPrompt(ctx);
  const userMessage = agent.buildUserMessage(ctx);
  const history = ctx.history ?? [];
  const messages = [...history, { role: 'user' as const, content: userMessage }];
  const maxRounds = agent.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const stepBudget = maxRounds + STRUCTURED_OUTPUT_STEP_BUFFER;

  const startTime = Date.now();
  logger.info('runner.start', 'Sub-agent started', {
    requestId: ctx.requestId,
    agent: agent.name,
    model: modelId,
  });
  send({
    type: 'debug',
    scope: 'runner',
    message: 'Запускаю суб-агента',
    data: {
      agent: agent.name,
      model: modelId,
      maxRounds,
      stepBudget,
      historyLength: history.length,
    },
  });

  let skillRounds = 0;
  send({ type: 'phase', phase: 'thinking' });

  if (AGENT_DEBUG_ENABLED) {
    send({
      type: 'debug',
      scope: 'runner',
      message: 'LLM request payload суб-агента',
      data: {
        agent: agent.name,
        request: {
          model: modelId,
          temperature: 0.1,
          stepBudget,
          toolNames: Object.keys(tools),
          systemPrompt,
          messages,
        },
      },
    });
  }

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      temperature: 0.1,
      stopWhen: stepCountIs(stepBudget),
      output: Output.object({ schema: agentResponseSchema }),
      onStepFinish: step => {
        if (step.toolCalls.length > 0) skillRounds++;
        for (const tc of step.toolCalls) {
          const name = 'toolName' in tc ? String(tc.toolName) : 'unknown';
          logger.info('runner.skill', 'Skill invoked', {
            requestId: ctx.requestId,
            agent: agent.name,
            skill: name,
            args: toolCallArgs(tc),
          });
          send({ type: 'skill', name, args: toolCallArgs(tc) });
        }
      },
    });

    send({ type: 'phase', phase: 'finalizing' });

    const output = result.output;
    const cleanedExplanation = filterTechnicalExplanation(output.sql, output.explanation);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('runner.end', 'Sub-agent finished', {
      requestId: ctx.requestId,
      agent: agent.name,
      durationMs: Date.now() - startTime,
      skillRounds,
      hasSql: Boolean(output.sql?.trim()),
    });
    send({
      type: 'debug',
      scope: 'runner',
      message: 'Суб-агент завершил работу',
      data: {
        agent: agent.name,
        durationSec: Number(elapsed),
        skillRounds,
        hasSql: Boolean(output.sql?.trim()),
      },
    });
    send({
      type: 'result',
      data: { ...output, explanation: cleanedExplanation, _skillRounds: skillRounds },
    });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      const fallback = tryParseAgentResponseFromText(err.text ?? '');
      if (fallback) {
        send({
          type: 'debug',
          scope: 'runner',
          message: 'Не удалось получить structured output, использую текстовый fallback',
          level: 'warn',
          data: {
            agent: agent.name,
          },
        });
        send({ type: 'phase', phase: 'finalizing' });
        const exp = filterTechnicalExplanation(fallback.sql, fallback.explanation);
        send({
          type: 'result',
          data: { ...fallback, explanation: exp, _skillRounds: skillRounds },
        });
        return;
      }
    }
    logger.error('runner.error', 'Sub-agent failed', {
      requestId: ctx.requestId,
      agent: agent.name,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка агента';
    send({
      type: 'debug',
      scope: 'runner',
      message: 'Суб-агент завершился с ошибкой',
      level: 'error',
      data: {
        agent: agent.name,
        error: message,
      },
    });
    send({ type: 'error', error: message });
  }
}
