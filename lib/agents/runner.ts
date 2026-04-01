/**
 * Generic agent runner — executes a sub-agent's tool-calling loop.
 *
 * Extracted from the original route.ts so every sub-agent reuses
 * the same multi-turn loop logic without duplication.
 */

import type { LLMMessage } from '@/lib/llm/types';
import type { RunnerOptions } from './types';
import { resolveAgentModel } from './registry';

const DEFAULT_MAX_ROUNDS = 5;

export async function runAgent(opts: RunnerOptions): Promise<void> {
  const { provider, agent, ctx, send } = opts;
  const model = resolveAgentModel(agent.model);
  const maxRounds = agent.maxRounds ?? DEFAULT_MAX_ROUNDS;

  const startTime = Date.now();
  console.log(`[Agent:${agent.name}] started, model=${model}`);

  const messages: LLMMessage[] = [
    { role: 'system', content: agent.buildSystemPrompt(ctx) },
    { role: 'user', content: agent.buildUserMessage(ctx) },
  ];

  let skillRounds = 0;
  send({ type: 'phase', phase: 'thinking' });

  /* ── Tool-calling loop ───────────────────────────────────────────── */
  for (let round = 0; round < maxRounds; round++) {
    const { message: assistantMsg, finishReason } = await provider.call({
      model,
      messages,
      tools: agent.tools.length > 0 ? agent.tools : undefined,
      toolChoice: agent.tools.length > 0 ? 'auto' : undefined,
    });

    // Handle tool calls
    if (assistantMsg.tool_calls?.length) {
      skillRounds++;
      messages.push(assistantMsg);

      for (const tc of assistantMsg.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* noop */ }

        console.log(`[Agent:${agent.name}] Skill: ${tc.function.name}(${JSON.stringify(args)})`);
        send({ type: 'skill', name: tc.function.name, args });

        const result = await agent.executeSkill(tc.function.name, args);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
      continue;
    }

    // Try to parse a final result from content
    if (assistantMsg.content) {
      const parsed = agent.parseResult(assistantMsg.content);
      if (parsed) {
        parsed._skillRounds = skillRounds;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Agent:${agent.name}] Done in ${elapsed}s, rounds=${skillRounds}`);
        send({ type: 'result', data: parsed });
        return;
      }
    }

    if (finishReason === 'stop') break;
  }

  /* ── Final call without tools ────────────────────────────────────── */
  console.log(`[Agent:${agent.name}] Final call (no tools), rounds=${skillRounds}`);
  send({ type: 'phase', phase: 'finalizing' });

  if (agent.finalNudge) {
    messages.push({ role: 'user', content: agent.finalNudge });
  }

  const { message: finalMsg } = await provider.call({
    model,
    messages,
    responseFormat: { type: 'json_object' },
  });

  if (!finalMsg.content) {
    send({ type: 'error', error: 'Пустой ответ от модели' });
    return;
  }

  const parsed = agent.parseResult(finalMsg.content);
  if (!parsed) {
    // Последний шанс: отдаём сырой текст как объяснение вместо ошибки
    console.error(`[Agent:${agent.name}] Failed to parse final:`, finalMsg.content);
    send({ type: 'result', data: { sql: '', explanation: finalMsg.content || 'Не удалось сформировать ответ', suggestions: [], canRetry: false } });
    return;
  }

  parsed._skillRounds = skillRounds;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Agent:${agent.name}] Done (final) in ${elapsed}s, rounds=${skillRounds}`);
  send({ type: 'result', data: parsed });
}
