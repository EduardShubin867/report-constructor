/**
 * Sub-agent registry.
 *
 * ## Adding a new sub-agent
 * 1. Create a file in lib/agents/ that default-exports a SubAgentConfig
 * 2. Import it here and add to the SUB_AGENTS array
 *
 * ## Model resolution
 *
 * Router (orchestrator):
 *   primary: opts.routerModel → OPENROUTER_ROUTER_MODEL → OPENROUTER_MODEL → FALLBACK
 *   retry: OPENROUTER_ROUTER_FALLBACK_MODEL → ROUTER_FALLBACK_MODEL
 *
 * Sub-agent:
 *   primary: agent.model → OPENROUTER_AGENT_MODEL → OPENROUTER_MODEL → FALLBACK
 *   retry: OPENROUTER_AGENT_FALLBACK_MODEL → AGENT_FALLBACK_MODEL
 */

import type { SubAgentConfig } from './types';
import sqlAnalyst from './sql-analyst';
import trendAnalyst from './trend-analyst';
import claimsAnalyst from './claims-analyst';
import explainAnalyst from './explain-analyst';
import osagoAnalyst from './osago-analyst';

// ── Hardcoded fallback (last resort) ─────────────────────────────────
const FALLBACK_MODEL = 'google/gemini-2.0-flash-001';
const AGENT_FALLBACK_MODEL = 'openai/gpt-4.1-mini';
const ROUTER_FALLBACK_MODEL = 'openai/gpt-4.1-mini';

// ── Register sub-agents ──────────────────────────────────────────────
const SUB_AGENTS: SubAgentConfig[] = [
  osagoAnalyst,  // before sql-analyst — handles OSAGO ML analytical queries
  trendAnalyst,
  claimsAnalyst,
  explainAnalyst,
  sqlAnalyst,   // last — general fallback
];

// ── Lookup map ───────────────────────────────────────────────────────
const agentMap = new Map<string, SubAgentConfig>();
for (const agent of SUB_AGENTS) {
  if (agentMap.has(agent.name)) {
    throw new Error(`Duplicate sub-agent name: ${agent.name}`);
  }
  agentMap.set(agent.name, agent);
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Resolve model for a sub-agent.
 * Priority: agent.model → OPENROUTER_AGENT_MODEL → OPENROUTER_MODEL → FALLBACK
 */
export function resolveAgentModel(override?: string): string {
  return override
    || process.env.OPENROUTER_AGENT_MODEL
    || process.env.OPENROUTER_MODEL
    || FALLBACK_MODEL;
}

/**
 * Resolve sub-agent model candidates for retry.
 * Primary model comes from the normal sub-agent resolution chain.
 * Fallback model is dedicated for runner-level retries when the primary LLM call fails.
 */
export function resolveAgentModelCandidates(override?: string): string[] {
  const primary = resolveAgentModel(override);
  const fallback = process.env.OPENROUTER_AGENT_FALLBACK_MODEL || AGENT_FALLBACK_MODEL;
  return [...new Set([primary, fallback])];
}

/**
 * Resolve model for the orchestrator's router.
 * Priority: opts.routerModel → OPENROUTER_ROUTER_MODEL → OPENROUTER_MODEL → FALLBACK
 */
export function resolveRouterModel(override?: string): string {
  return override
    || process.env.OPENROUTER_ROUTER_MODEL
    || process.env.OPENROUTER_MODEL
    || FALLBACK_MODEL;
}

/**
 * Resolve router model candidates for retry.
 * Primary model comes from the normal router resolution chain.
 * Fallback model is dedicated for structured-output-safe routing retries.
 */
export function resolveRouterModelCandidates(override?: string): string[] {
  const primary = resolveRouterModel(override);
  const fallback = process.env.OPENROUTER_ROUTER_FALLBACK_MODEL || ROUTER_FALLBACK_MODEL;
  return [...new Set([primary, fallback])];
}

/**
 * Resolve model for the `whenToUse` text generator (admin UI helper).
 * Priority: override → OPENROUTER_WHEN_TO_USE_MODEL → OPENROUTER_MODEL → FALLBACK
 */
export function resolveWhenToUseGeneratorModel(override?: string): string {
  return override
    || process.env.OPENROUTER_WHEN_TO_USE_MODEL
    || process.env.OPENROUTER_MODEL
    || FALLBACK_MODEL;
}

/** Get a sub-agent by name */
export function getAgent(name: string): SubAgentConfig | undefined {
  return agentMap.get(name);
}

/** Get all registered sub-agents */
export function getAllAgents(): SubAgentConfig[] {
  return SUB_AGENTS;
}

/** Get agent names + descriptions (for orchestrator routing prompt) */
export function getAgentCatalog(): { name: string; description: string }[] {
  return SUB_AGENTS.map(a => ({ name: a.name, description: a.description }));
}
