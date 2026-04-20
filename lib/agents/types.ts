/* ────────────────────────────────────────────────────────────────────
 * Context passed to every sub-agent
 * ──────────────────────────────────────────────────────────────────── */

import type { ModelMessage } from 'ai';

export interface AgentContext {
  /** Unique id for this agent run — used for log/trace correlation across layers. */
  requestId: string;
  /** Today's date ISO (YYYY-MM-DD) */
  today: string;
  /** User's natural-language query (latest turn) */
  query: string;
  /** Previous SQL (for edits / retries) */
  previousSql?: string;
  /** Error from previous SQL execution (retry mode) */
  retryError?: string;
  /** When true, SQL validator does not inject TOP/LIMIT for AI tools and follow-up query. */
  skipAutoRowLimit?: boolean;
  /**
   * Prior conversation turns (everything BEFORE the current user query).
   * The runner prepends these to the messages it sends to the LLM so the
   * model can see what was already discussed in this chat.
   */
  history?: ModelMessage[];
  /**
   * Data source chosen by the source-router before the sub-agent runs.
   * If omitted, agents fall back to using all registered sources.
   */
  selectedSourceId?: string;
}

/* ────────────────────────────────────────────────────────────────────
 * SSE events emitted during agent execution
 * ──────────────────────────────────────────────────────────────────── */

export type AgentDebugLevel = 'info' | 'warn' | 'error';

export type AgentEventVariant =
  | { type: 'phase'; phase: string }
  | { type: 'skill'; name: string; args: Record<string, unknown> }
  | { type: 'sub_agent'; name: string }
  | { type: 'source_selected'; sourceId: string; sourceName: string }
  | {
      type: 'debug';
      scope: 'orchestrator' | 'runner';
      message: string;
      level?: AgentDebugLevel;
      data?: Record<string, unknown>;
    }
  | {
      type: 'trace';
      scope: string;
      message: string;
      durationMs?: number;
      data?: Record<string, unknown>;
    }
  | { type: 'result'; data: Record<string, unknown> }
  | { type: 'error'; error: string };

/**
 * Optional event id for client-side deduplication of SSE messages.
 * Server attaches one automatically in `app/api/agent/route.ts`.
 */
export type AgentEvent = AgentEventVariant & { id?: string };

export type AgentEventSink = (event: AgentEvent) => void;

/* ────────────────────────────────────────────────────────────────────
 * Sub-agent definition
 * ──────────────────────────────────────────────────────────────────── */

export interface SubAgentConfig {
  /** Unique identifier, e.g. 'sql-analyst' */
  name: string;

  /** Short description — used by orchestrator to decide routing */
  description: string;

  /**
   * Model override for this sub-agent.
   * Resolution order: config.model → env OPENROUTER_MODEL → DEFAULT_MODEL
   */
  model?: string;

  /** Max tool-calling rounds (hint for stopWhen budget). Default: 5 */
  maxRounds?: number;

  /** Build the system prompt given the current context */
  buildSystemPrompt(ctx: AgentContext): string;

  /** Build the initial user message from context */
  buildUserMessage(ctx: AgentContext): string;

  /**
   * Optional: fast routing without LLM.
   *
   * Return a confidence score 0–1:
   * - 1.0 = "this is definitely mine" (e.g. keyword match)
   * - 0.5–0.9 = "likely mine"
   * - 0 = "not mine"
   *
   * If exactly one agent returns ≥ threshold → route directly (no LLM).
   * If multiple agents match or none match → fallback to LLM routing.
   */
  match?: (ctx: AgentContext) => number;
}

/* ────────────────────────────────────────────────────────────────────
 * Runner options — passed to the generic agent loop
 * ──────────────────────────────────────────────────────────────────── */

export interface RunnerOptions {
  agent: SubAgentConfig;
  ctx: AgentContext;
  send: AgentEventSink;
}
