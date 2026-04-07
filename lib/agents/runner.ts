/**
 * Generic agent runner — Vercel AI SDK generateText + tools + structured output.
 */

import { generateText, NoObjectGeneratedError, Output, stepCountIs } from 'ai';
import type { RunnerOptions } from './types';
import { resolveAgentModel } from './registry';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import { buildAgentToolSet } from '@/lib/skills/registry';
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
  const tools = buildAgentToolSet();
  const maxRounds = agent.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const stepBudget = maxRounds + STRUCTURED_OUTPUT_STEP_BUFFER;

  const startTime = Date.now();
  console.log(`[Agent:${agent.name}] started, model=${modelId}`);

  let skillRounds = 0;
  send({ type: 'phase', phase: 'thinking' });

  try {
    const result = await generateText({
      model,
      system: agent.buildSystemPrompt(ctx),
      messages: [{ role: 'user', content: agent.buildUserMessage(ctx) }],
      tools,
      temperature: 0.1,
      stopWhen: stepCountIs(stepBudget),
      output: Output.object({ schema: agentResponseSchema }),
      onStepFinish: step => {
        if (step.toolCalls.length > 0) skillRounds++;
        for (const tc of step.toolCalls) {
          const name = 'toolName' in tc ? String(tc.toolName) : 'unknown';
          console.log(`[Agent:${agent.name}] Skill: ${name}(${JSON.stringify(toolCallArgs(tc))})`);
          send({ type: 'skill', name, args: toolCallArgs(tc) });
        }
      },
    });

    send({ type: 'phase', phase: 'finalizing' });

    const output = result.output;
    const cleanedExplanation = filterTechnicalExplanation(output.sql, output.explanation);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Agent:${agent.name}] Done in ${elapsed}s, skillRounds=${skillRounds}`);
    send({
      type: 'result',
      data: { ...output, explanation: cleanedExplanation, _skillRounds: skillRounds },
    });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      const fallback = tryParseAgentResponseFromText(err.text ?? '');
      if (fallback) {
        send({ type: 'phase', phase: 'finalizing' });
        const exp = filterTechnicalExplanation(fallback.sql, fallback.explanation);
        send({
          type: 'result',
          data: { ...fallback, explanation: exp, _skillRounds: skillRounds },
        });
        return;
      }
    }
    console.error(`[Agent:${agent.name}]`, err);
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка агента';
    send({ type: 'error', error: message });
  }
}
