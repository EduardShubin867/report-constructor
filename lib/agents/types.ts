/* ────────────────────────────────────────────────────────────────────
 * Context passed to every sub-agent
 * ──────────────────────────────────────────────────────────────────── */

import type { ModelMessage } from 'ai';
import type { AnalysisContext } from '@/lib/report-history-types';

export interface AgentContext {
  /** Unique id for this agent run — used for log/trace correlation across layers. */
  requestId: string;
  /** Stable UI conversation id for cross-turn context, if the client has one. */
  chatSessionId?: string;
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
   * Compact structured state from previous turns: selected source, filters,
   * last SQL, result columns, metrics and dimensions. Used for short follow-ups.
   */
  analysisContext?: AnalysisContext;
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

  /**
   * Optional: bypass the LLM runner entirely and handle the request directly.
   * If defined, the runner will call this instead of the LLM tool-calling loop.
   * Use for agents that delegate to external services (e.g. OSAGO ML backend).
   */
  run?: (ctx: AgentContext, send: AgentEventSink) => Promise<void>;

  /** Build the system prompt given the current context (unused when run() is defined) */
  buildSystemPrompt(ctx: AgentContext): string;

  /** Build the initial user message from context (unused when run() is defined) */
  buildUserMessage(ctx: AgentContext): string;

}

/* ────────────────────────────────────────────────────────────────────
 * Runner options — passed to the generic agent loop
 * ──────────────────────────────────────────────────────────────────── */

export interface RunnerOptions {
  agent: SubAgentConfig;
  ctx: AgentContext;
  send: AgentEventSink;
}
