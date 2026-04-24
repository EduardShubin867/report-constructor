/**
 * Generic agent runner — Vercel AI SDK generateText + tools + structured output.
 */

import { generateText, NoObjectGeneratedError, Output, stepCountIs } from 'ai';
import type { RunnerOptions } from './types';
import { resolveAgentModelCandidates } from './registry';
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

function normalizeSqlForComparison(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ');
}

function toolCallArgs(tc: { input?: unknown }): Record<string, unknown> {
  const input = tc.input;
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function assertSqlWasValidated(
  sql: string,
  validatedSqlInputs: string[],
): void {
  const normalizedSql = normalizeSqlForComparison(sql);
  if (!normalizedSql) return;

  if (validatedSqlInputs.length === 0) {
    throw new Error('Guardrail: sub-agent returned SQL without validate_query');
  }

  const hasMatchingValidation = validatedSqlInputs.some(
    candidate => normalizeSqlForComparison(candidate) === normalizedSql,
  );
  if (!hasMatchingValidation) {
    throw new Error('Guardrail: sub-agent returned SQL that was not validated via validate_query');
  }
}

export async function runAgent(opts: RunnerOptions): Promise<void> {
  const { agent, ctx, send } = opts;

  if (agent.run) {
    await agent.run(ctx, send);
    return;
  }

  const openrouter = createAppOpenRouter();
  const modelIds = resolveAgentModelCandidates(agent.model);
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
    model: modelIds[0],
    fallbackModels: modelIds.slice(1),
  });
  send({
    type: 'debug',
    scope: 'runner',
    message: 'Запускаю суб-агента',
    data: {
      agent: agent.name,
      model: modelIds[0],
      fallbackModels: modelIds.slice(1),
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
          model: modelIds[0],
          fallbackModels: modelIds.slice(1),
          temperature: 0.1,
          stepBudget,
          toolNames: Object.keys(tools),
          systemPrompt,
          messages,
        },
      },
    });
  }

  let lastError: unknown = null;
  try {
    for (let index = 0; index < modelIds.length; index++) {
      const modelId = modelIds[index];
      const model = openrouter(modelId);
      const validatedSqlInputs: string[] = [];

      if (index > 0) {
        send({
          type: 'debug',
          scope: 'runner',
          message: 'Основная agent-model недоступна, пробую fallback model',
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
              const args = toolCallArgs(tc);
              if (name === 'validate_query' && typeof args.sql === 'string' && args.sql.trim()) {
                validatedSqlInputs.push(args.sql);
              }
              logger.info('runner.skill', 'Skill invoked', {
                requestId: ctx.requestId,
                agent: agent.name,
                skill: name,
                args,
              });
              send({ type: 'skill', name, args });
            }
          },
        });

        send({ type: 'phase', phase: 'finalizing' });

        const output = result.output;
        assertSqlWasValidated(output.sql, validatedSqlInputs);
        const cleanedExplanation = filterTechnicalExplanation(output.sql, output.explanation);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info('runner.end', 'Sub-agent finished', {
          requestId: ctx.requestId,
          agent: agent.name,
          durationMs: Date.now() - startTime,
          skillRounds,
          hasSql: Boolean(output.sql?.trim()),
          model: modelId,
          attempts: index + 1,
        });
        send({
          type: 'debug',
          scope: 'runner',
          message: 'Суб-агент завершил работу',
          data: {
            agent: agent.name,
            model: modelId,
            attempt: index + 1,
            durationSec: Number(elapsed),
            skillRounds,
            hasSql: Boolean(output.sql?.trim()),
          },
        });
        send({
          type: 'result',
          data: { ...output, explanation: cleanedExplanation, _skillRounds: skillRounds },
        });
        return;
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
                model: modelId,
                attempt: index + 1,
              },
            });
            send({ type: 'phase', phase: 'finalizing' });
            assertSqlWasValidated(fallback.sql, validatedSqlInputs);
            const exp = filterTechnicalExplanation(fallback.sql, fallback.explanation);
            send({
              type: 'result',
              data: { ...fallback, explanation: exp, _skillRounds: skillRounds },
            });
            return;
          }
        }

        lastError = err;
        if (index < modelIds.length - 1) {
          logger.warn('runner.error', 'Sub-agent model failed, retrying fallback model', {
            requestId: ctx.requestId,
            agent: agent.name,
            model: modelId,
            fallbackModel: modelIds[index + 1],
            error: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }
    }
  } catch (err) {
    logger.error('runner.error', 'Sub-agent failed', {
      requestId: ctx.requestId,
      agent: agent.name,
      durationMs: Date.now() - startTime,
      attemptedModels: modelIds,
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
        attemptedModels: modelIds,
        error: message,
      },
    });
    send({ type: 'error', error: message });
    return;
  }

  const finalError = lastError;
  logger.error('runner.error', 'All sub-agent models failed', {
    requestId: ctx.requestId,
    agent: agent.name,
    durationMs: Date.now() - startTime,
    attemptedModels: modelIds,
    error: finalError instanceof Error ? finalError.message : String(finalError),
  });
  const message = finalError instanceof Error ? finalError.message : 'Внутренняя ошибка агента';
  send({
    type: 'debug',
    scope: 'runner',
    message: 'Все agent-model недоступны, суб-агент завершился с ошибкой',
    level: 'error',
    data: {
      agent: agent.name,
      attemptedModels: modelIds,
      error: message,
    },
  });
  send({ type: 'error', error: message });
}
