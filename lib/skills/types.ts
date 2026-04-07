/**
 * Standard interfaces for agent skills.
 *
 * Two types of skills:
 * 1. ToolSkill  — .ts file, callable via function-calling (Zod inputSchema + execute)
 * 2. Instruction — .md file in lib/skills/instructions/, injected into system prompt
 */

import type { ZodType } from 'zod';

/** Skill that becomes a callable tool via Vercel AI SDK / function-calling */
export interface ToolSkill {
  kind: 'tool';
  /** Unique name used as tool id */
  name: string;
  /** Description shown to the LLM so it knows when to use the skill */
  description: string;
  /** Zod schema for tool arguments (single source of truth) */
  inputSchema: ZodType<Record<string, unknown>>;
  /** Execute the skill with parsed arguments. Returns a string result for the LLM. */
  execute(args: Record<string, unknown>): Promise<string>;
}
