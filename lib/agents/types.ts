import type { ToolDefinition } from '@/lib/skills/types';
import type { LLMProvider } from '@/lib/llm/types';

/* ────────────────────────────────────────────────────────────────────
 * Context passed to every sub-agent
 * ──────────────────────────────────────────────────────────────────── */

export interface AgentContext {
  /** Today's date ISO (YYYY-MM-DD) */
  today: string;
  /** User's natural-language query */
  query: string;
  /** Previous SQL (for edits / retries) */
  previousSql?: string;
  /** Error from previous SQL execution (retry mode) */
  retryError?: string;
}

/* ────────────────────────────────────────────────────────────────────
 * SSE events emitted during agent execution
 * ──────────────────────────────────────────────────────────────────── */

export type AgentEvent =
  | { type: 'phase'; phase: string }
  | { type: 'skill'; name: string; args: Record<string, unknown> }
  | { type: 'sub_agent'; name: string }
  | { type: 'result'; data: Record<string, unknown> }
  | { type: 'error'; error: string };

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

  /** Max tool-calling rounds. Default: 5 */
  maxRounds?: number;

  /** Build the system prompt given the current context */
  buildSystemPrompt(ctx: AgentContext): string;

  /** Build the initial user message from context */
  buildUserMessage(ctx: AgentContext): string;

  /** Tool definitions exposed to the LLM */
  tools: ToolDefinition[];

  /** Execute a tool call by name */
  executeSkill(name: string, args: Record<string, unknown>): Promise<string>;

  /**
   * Try to parse a final result from the assistant's text response.
   * Return null if the text is not a valid final answer.
   */
  parseResult(content: string): Record<string, unknown> | null;

  /**
   * Optional: fast routing without LLM.
   *
   * Return a confidence score 0–1:
   * - 1.0 = "this is definitely mine" (e.g. keyword match)
   * - 0.5–0.9 = "likely mine"
   * - 0 = "not mine"
   *
   * If exactly one agent returns ≥ threshold → route directly (no LLM call).
   * If multiple agents match or none match → fallback to LLM routing.
   */
  match?: (ctx: AgentContext) => number;

  /**
   * Optional: message to send when tools are exhausted and we need
   * the model to produce a final answer without tools.
   */
  finalNudge?: string;
}

/* ────────────────────────────────────────────────────────────────────
 * Runner options — passed to the generic agent loop
 * ──────────────────────────────────────────────────────────────────── */

export interface RunnerOptions {
  provider: LLMProvider;
  agent: SubAgentConfig;
  ctx: AgentContext;
  send: AgentEventSink;
}
