/**
 * Skill registry — registers tool skills and indexes instruction files.
 *
 * ## Adding a new Tool Skill (callable by the agent via function-calling):
 * 1. Create a .ts file in lib/skills/ that default-exports a ToolSkill object
 * 2. Import it below and add to the TOOL_SKILLS array
 *
 * ## Adding a new Instruction (.md file, lazy-loaded by agent on demand):
 * 1. Create a .md file in lib/skills/instructions/
 * 2. First two lines become the preview shown in the system prompt
 * 3. Agent calls `read_instruction` tool to get the full text when needed
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ToolSkill, ToolDefinition } from './types';

// ── Import tool skills ─────────────────────────────────────────────
import lookupDg from './lookup-dg';
import lookupTerritory from './lookup-territory';
import listColumnValues from './list-column-values';
import getKrmKrp from './get-krm-krp';
import validateQuery from './validate-query';
import readInstruction from './read-instruction';

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

// ── Index instruction .md files (preview only) ─────────────────────
// Use process.cwd() because __dirname is unreliable in bundled Next.js
const INSTRUCTIONS_DIR = join(process.cwd(), 'lib', 'skills', 'instructions');

interface InstructionEntry {
  /** Filename without .md */
  name: string;
  /** First two non-empty lines — shown in system prompt as a preview */
  preview: string;
}

function indexInstructions(): InstructionEntry[] {
  try {
    const files = readdirSync(INSTRUCTIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .sort();

    return files.map(f => {
      const content = readFileSync(join(INSTRUCTIONS_DIR, f), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      const preview = lines.slice(0, 2).join('\n');
      return {
        name: f.replace(/\.md$/, ''),
        preview,
      };
    });
  } catch {
    return [];
  }
}

// Cache at module load
const _instructionIndex = indexInstructions();

// ── Public API ─────────────────────────────────────────────────────

/** OpenAI function-calling tool definitions */
export const AGENT_TOOLS: ToolDefinition[] = TOOL_SKILLS.map(s => ({
  type: 'function' as const,
  function: {
    name: s.name,
    description: s.description,
    parameters: s.parameters,
  },
}));

/** Execute a tool skill by name */
export async function executeSkill(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const skill = toolMap.get(name);
  if (!skill) return `Неизвестный скилл: ${name}`;
  return skill.execute(args);
}

/**
 * Get the instruction catalog for the system prompt.
 * Shows only name + first 2 lines of each .md file.
 * Agent calls `read_instruction` to get full text.
 */
export function getInstructionsBlock(): string {
  if (_instructionIndex.length === 0) return '';

  const header = `## Доступные инструкции

У тебя есть дополнительные инструкции. В системном промпте показаны только превью.
Чтобы прочитать полный текст, вызови \`read_instruction\` с нужным именем.

`;
  const entries = _instructionIndex
    .map(e => `### ${e.name}\n${e.preview}`)
    .join('\n\n');

  return header + entries;
}

/** Get list of all registered tool skill names (for debugging) */
export function getSkillNames(): string[] {
  return TOOL_SKILLS.map(s => s.name);
}
