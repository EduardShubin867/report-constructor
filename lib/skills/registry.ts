/**
 * Skill registry — registers tool skills and indexes instruction files.
 *
 * ## Adding a new Tool Skill (callable by the agent via function-calling):
 * 1. Create a .ts file in lib/skills/ that default-exports a ToolSkill object
 * 2. Import it below and add to the TOOL_SKILLS array
 *
 * ## Text instructions (single entity, hybrid storage):
 * - Built-in: lib/skills/instructions/*.md (git)
 * - Admin: data/skills.json (loadSkills / saveSkill)
 * Catalog + lazy read: getTextInstructionsCatalog(), tool read_instruction
 *
 * ## Adding / overriding text via Admin UI:
 * 1. Go to /admin → Skills tab
 * 2. New id → JSON-only instruction; same id as a repo `.md` → override file (stored in JSON)
 * 3. Enabled rows appear in the agent catalog; full text via read_instruction
 */

import { tool, type ToolSet } from 'ai';
import type { ToolSkill } from './types';
import lookupDg from './lookup-dg';
import lookupTerritory from './lookup-territory';
import listColumnValues from './list-column-values';
import getKrmKrp from './get-krm-krp';
import validateQuery from './validate-query';
import readInstruction from './read-instruction';

export {
  listAllTextInstructionsForAdmin,
  listTextInstructionsForAgent,
  getTextInstructionsCatalog,
  readTextInstruction,
  type TextInstructionFilters,
} from './text-instructions';

// ── Register tool skills ───────────────────────────────────────────
const TOOL_SKILLS: ToolSkill[] = [
  lookupDg,
  lookupTerritory,
  listColumnValues,
  getKrmKrp,
  validateQuery,
  readInstruction,
];

// ── Build tool lookup map ──────────────────────────────────────────
const toolMap = new Map<string, ToolSkill>();
for (const skill of TOOL_SKILLS) {
  if (toolMap.has(skill.name)) {
    throw new Error(`Duplicate tool skill name: ${skill.name}`);
  }
  toolMap.set(skill.name, skill);
}

// ── Public API ─────────────────────────────────────────────────────

/** Vercel AI SDK tool set for sub-agents (single source: Zod + execute). */
export function buildAgentToolSet(): ToolSet {
  const entries = TOOL_SKILLS.map(s => [
    s.name,
    tool({
      description: s.description,
      inputSchema: s.inputSchema,
      execute: async (input: Record<string, unknown>) => s.execute(input),
    }),
  ]);
  return Object.fromEntries(entries) as ToolSet;
}

/** Execute a tool skill by name (tests / admin / debugging). */
export async function executeSkill(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const skill = toolMap.get(name);
  if (!skill) return `Неизвестный скилл: ${name}`;
  return skill.execute(args);
}

/** Get list of all registered tool skill names (for debugging) */
export function getSkillNames(): string[] {
  return TOOL_SKILLS.map(s => s.name);
}
