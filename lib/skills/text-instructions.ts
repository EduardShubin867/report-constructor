import { loadSkills } from '@/lib/schema/store';
import type { Skill, TextInstructionListItem } from '@/lib/schema/types';
import {
  listBuiltinInstructionEntries,
  listBuiltinInstructionIds,
  readBuiltinInstructionMarkdown,
} from './instructions-fs';

export interface TextInstructionFilters {
  activeSourceIds?: string[];
  agentName?: string;
}

function dataSkillMatchesFilters(s: Skill, f: TextInstructionFilters): boolean {
  if (!s.enabled) return false;
  if (f.activeSourceIds?.length && s.sources?.length) {
    if (!s.sources.some(id => f.activeSourceIds!.includes(id))) return false;
  }
  if (f.agentName && s.agents?.length) {
    if (!s.agents.includes(f.agentName)) return false;
  }
  return true;
}

function previewFromInstruction(text: string): string {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  return lines.slice(0, 2).join('\n');
}

function skillsById(): Map<string, Skill> {
  return new Map(loadSkills().map(s => [s.id, s]));
}

function builtinIdSet(): Set<string> {
  return new Set(listBuiltinInstructionIds());
}

/**
 * All text instructions for admin: one row per built-in file (merged with JSON override) + pure data rows.
 */
export function listAllTextInstructionsForAdmin(): TextInstructionListItem[] {
  const byId = skillsById();
  const builtinIds = builtinIdSet();

  const mergedBuiltin: TextInstructionListItem[] = listBuiltinInstructionEntries().map(e => {
    const json = byId.get(e.id);
    const effectiveForAgent = json && json.enabled ? json.instruction : e.body;
    const editorBody = json ? json.instruction : e.body;
    return {
      id: e.id,
      name: json?.name?.trim() || e.id,
      preview: previewFromInstruction(effectiveForAgent),
      source: 'builtin' as const,
      enabled: json ? json.enabled : true,
      category: json?.category,
      sources: json?.sources,
      agents: json?.agents,
      instruction: editorBody,
      hasJsonOverride: !!json,
    };
  });

  const dataOnly: TextInstructionListItem[] = loadSkills()
    .filter(s => !builtinIds.has(s.id))
    .map(s => ({
      id: s.id,
      name: s.name,
      preview: previewFromInstruction(s.instruction),
      source: 'data' as const,
      enabled: s.enabled,
      category: s.category,
      sources: s.sources,
      agents: s.agents,
      instruction: s.instruction,
      hasJsonOverride: false,
    }));

  return [...mergedBuiltin, ...dataOnly];
}

/**
 * Instructions visible to the agent for this context (catalog + read tool).
 */
export function listTextInstructionsForAgent(f: TextInstructionFilters): TextInstructionListItem[] {
  const byId = skillsById();

  const fromRepo: TextInstructionListItem[] = listBuiltinInstructionEntries().map(e => {
    const json = byId.get(e.id);
    const useOverride = !!(json && json.enabled && dataSkillMatchesFilters(json, f));
    const instruction = useOverride ? json!.instruction : e.body;
    const usesActiveOverride = useOverride;
    return {
      id: e.id,
      name: useOverride && json!.name?.trim() ? json!.name : e.id,
      preview: previewFromInstruction(instruction),
      source: 'builtin' as const,
      enabled: true,
      category: useOverride ? json!.category : undefined,
      sources: useOverride ? json!.sources : undefined,
      agents: useOverride ? json!.agents : undefined,
      instruction,
      usesActiveOverride,
    };
  });

  const fromData: TextInstructionListItem[] = loadSkills()
    .filter(s => !builtinIdSet().has(s.id) && dataSkillMatchesFilters(s, f))
    .map(s => ({
      id: s.id,
      name: s.name,
      preview: previewFromInstruction(s.instruction),
      source: 'data' as const,
      enabled: true,
      category: s.category,
      sources: s.sources,
      agents: s.agents,
      instruction: s.instruction,
      usesActiveOverride: false,
    }));

  return [...fromRepo, ...fromData];
}

/**
 * Single markdown block for the system prompt (previews only).
 */
export function getTextInstructionsCatalog(f: TextInstructionFilters): string {
  const items = listTextInstructionsForAgent(f);
  if (items.length === 0) return '';

  const header = `## Доступные текстовые инструкции

В системном промпте показаны только превью. Чтобы прочитать полный текст, вызови \`read_instruction\` с параметром \`id\` (тот же id, что в заголовке ниже).

`;
  const entries = items
    .map(item => {
      let origin: string;
      if (item.source === 'data') {
        origin = 'админка';
      } else if (item.usesActiveOverride) {
        origin = 'репозиторий (переопределено)';
      } else {
        origin = 'репозиторий';
      }
      const label = item.source === 'builtin' && !item.usesActiveOverride ? item.id : `${item.id} (${item.name})`;
      return `### ${label} · ${origin}\n${item.preview}`;
    })
    .join('\n\n');

  return header + entries;
}

function formatAvailableIdsForError(): string {
  const builtin = listBuiltinInstructionIds();
  const dataEnabled = loadSkills().filter(s => s.enabled).map(s => s.id);
  const parts: string[] = [];
  if (builtin.length) parts.push(`встроенные: ${builtin.join(', ')}`);
  if (dataEnabled.length) parts.push(`из админки: ${dataEnabled.join(', ')}`);
  return parts.join('; ') || 'нет';
}

/**
 * Resolve full instruction body by id (JSON override vs repo .md vs pure data).
 */
export function readTextInstruction(id: string): string {
  const key = id.trim();
  if (!key) return 'Не указан id инструкции';

  const json = loadSkills().find(s => s.id === key);
  const repoMarkdown = readBuiltinInstructionMarkdown(key);

  if (json) {
    if (json.enabled) {
      return json.instruction.trim();
    }
    if (repoMarkdown !== null) {
      return repoMarkdown;
    }
    return `Инструкция "${key}" выключена в админ-панели`;
  }

  if (repoMarkdown !== null) {
    return repoMarkdown;
  }

  return `Инструкция "${key}" не найдена. Доступные id — ${formatAvailableIdsForError()}.`;
}
