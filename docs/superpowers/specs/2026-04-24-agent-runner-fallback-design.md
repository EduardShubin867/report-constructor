# Agent Runner Fallback Design

## Goal

Make AI analytics return an LLM answer even when the primary sub-agent model fails, by retrying the same sub-agent request on a fallback model before surfacing an SSE error to the client.

## Scope

This change applies only to the generic sub-agent runner in `lib/agents/runner.ts`.

It does not retry:
- SQL execution failures
- schema or validator failures after the model already returned SQL
- the whole `/api/agent` request
- custom agents that bypass the generic runner through `agent.run`

## Approach

1. Add agent model candidate resolution in `lib/agents/registry.ts`.
2. Keep the first candidate as the existing primary model resolution chain.
3. Add a dedicated fallback candidate from `OPENROUTER_AGENT_FALLBACK_MODEL`, with a hardcoded last-resort default.
4. In `lib/agents/runner.ts`, try `generateText()` sequentially across model candidates.
5. Preserve the existing text fallback for `NoObjectGeneratedError` on each attempt.
6. Emit debug events when the runner switches from the failed primary model to the fallback model.
7. Return a normal `result` event as soon as any candidate succeeds; emit `error` only after all candidates fail.

## UX / Telemetry

- The client should continue to receive the same SSE contract.
- Debug output should clearly show which model started, which one failed, and when the runner switched to fallback.
- Successful fallback should still look like a normal agent answer to the end user.

## Testing

- Add a unit test for the runner path where the first `generateText()` call throws and the second succeeds.
- Verify the fallback model is selected and a normal `result` event is emitted.
- Keep existing orchestrator fallback behavior unchanged.
