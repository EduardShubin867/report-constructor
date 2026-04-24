# Agent Runner Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fallback model path for generic AI sub-agents so AI analytics can still return an answer when the primary model call fails.

**Architecture:** Extend the existing registry-based model resolution with an agent fallback candidate list, then teach the generic runner to try candidates sequentially while preserving the current SSE/result contract. Keep the change isolated to registry and runner logic plus a focused unit test.

**Tech Stack:** Next.js 16 route handlers, Vercel AI SDK, Jest, TypeScript

---

### Task 1: Add the failing runner test

**Files:**
- Create: `tests/unit/runner.test.ts`
- Modify: none
- Test: `tests/unit/runner.test.ts`

- [ ] **Step 1: Write the failing test**

Write a test that mocks:
- `resolveAgentModelCandidates()` to return `['primary/agent-model', 'fallback/agent-model']`
- `generateText()` to throw on the first call and succeed on the second call
- `createAppOpenRouter()` so each model ID is visible in the assertion

Expected behavior:
- `generateText()` is called twice
- first attempt uses `primary/agent-model`
- second attempt uses `fallback/agent-model`
- emitted events include a `result`
- emitted events do not end with `error`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/runner.test.ts --runInBand`
Expected: FAIL because the runner currently only tries one model.

### Task 2: Implement fallback candidates

**Files:**
- Modify: `lib/agents/registry.ts`
- Test: `tests/unit/runner.test.ts`

- [ ] **Step 1: Add candidate resolution**

Expose `resolveAgentModelCandidates(override?: string): string[]` with:
- primary candidate from existing `resolveAgentModel()`
- fallback candidate from `OPENROUTER_AGENT_FALLBACK_MODEL` or a hardcoded default
- deduped output

- [ ] **Step 2: Run test to confirm it still fails for the right reason**

Run: `npx jest tests/unit/runner.test.ts --runInBand`
Expected: still FAIL because the runner loop has not been updated yet.

### Task 3: Teach the runner to retry on fallback model

**Files:**
- Modify: `lib/agents/runner.ts`
- Test: `tests/unit/runner.test.ts`

- [ ] **Step 1: Replace single-model execution with candidate loop**

Try candidates sequentially:
- reuse the same prompt, tools, and messages
- send a warn-level debug event before trying fallback
- preserve per-attempt `NoObjectGeneratedError` text fallback behavior
- emit final `error` only after all models fail

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest tests/unit/runner.test.ts --runInBand`
Expected: PASS

### Task 4: Regression check

**Files:**
- Modify: none
- Test: `tests/unit/orchestrator.test.ts`, `tests/unit/runner.test.ts`

- [ ] **Step 1: Run focused regression suite**

Run: `npx jest tests/unit/runner.test.ts tests/unit/orchestrator.test.ts --runInBand`
Expected: PASS
