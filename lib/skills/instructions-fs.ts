import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/** Repo-backed instruction files (lazy text for the agent). */
export const INSTRUCTIONS_DIR = join(process.cwd(), 'lib', 'skills', 'instructions');

export function listBuiltinInstructionIds(): string[] {
  try {
    return readdirSync(INSTRUCTIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))
      .sort();
  } catch {
    return [];
  }
}

export function readBuiltinInstructionMarkdown(id: string): string | null {
  const safe = id.trim();
  if (!safe || safe.includes('/') || safe.includes('\\') || safe.includes('..')) return null;
  if (!listBuiltinInstructionIds().includes(safe)) return null;
  try {
    return readFileSync(join(INSTRUCTIONS_DIR, `${safe}.md`), 'utf-8').trim();
  } catch {
    return null;
  }
}

export function listBuiltinInstructionSummaries(): { id: string; preview: string }[] {
  return listBuiltinInstructionEntries().map(({ id, preview }) => ({ id, preview }));
}

/** Single disk read per file — use for admin list and agent catalog. */
export function listBuiltinInstructionEntries(): { id: string; preview: string; body: string }[] {
  try {
    const files = readdirSync(INSTRUCTIONS_DIR).filter(f => f.endsWith('.md')).sort();
    return files.map(f => {
      const id = f.replace(/\.md$/, '');
      const content = readFileSync(join(INSTRUCTIONS_DIR, f), 'utf-8');
      const body = content.trim();
      const lines = content.split('\n').filter(l => l.trim() !== '');
      const preview = lines.slice(0, 2).join('\n');
      return { id, preview, body };
    });
  } catch {
    return [];
  }
}
