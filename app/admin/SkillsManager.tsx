'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SkillEditor from '@/components/SkillEditor';
import { BASE_PATH } from '@/lib/constants';
import type { Skill, TextInstructionListItem } from '@/lib/schema/types';

type EditorState =
  | { open: false }
  | { open: true; initial?: TextInstructionListItem };

interface SchemaOption { id: string; name: string; }
interface AgentOption { name: string; description: string; }

function shelfCategory(item: TextInstructionListItem): string {
  if (item.source === 'builtin') return 'Репозиторий';
  return item.category?.trim() || 'Админка · без категории';
}

function itemToSkillForm(item: TextInstructionListItem): Skill {
  return {
    id: item.id,
    name: item.name,
    instruction: item.instruction,
    enabled: item.enabled,
    category: item.category,
    sources: item.sources,
    agents: item.agents,
  };
}

export default function SkillsManager() {
  const [items, setItems] = useState<TextInstructionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableSources, setAvailableSources] = useState<SchemaOption[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AgentOption[]>([]);

  const reloadInstructions = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_PATH}/api/admin/skills`).then(res => res.json());
      setItems(r.instructions ?? []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_PATH}/api/admin/skills`).then(r => r.json()),
      fetch(`${BASE_PATH}/api/admin/schema`).then(r => r.json()),
    ])
      .then(([skillsData, schemaData]) => {
        setItems(skillsData.instructions ?? []);
        setAvailableSources(schemaData.sources ?? []);
        setAvailableAgents(schemaData.agents ?? []);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/admin/skills/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Ошибка удаления');
      await reloadInstructions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить операцию');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(item: TextInstructionListItem) {
    if (item.source === 'builtin' && !item.hasJsonOverride) return;
    setTogglingId(item.id);
    setError(null);
    const updatedSkill: Skill = {
      ...itemToSkillForm(item),
      enabled: !item.enabled,
    };
    try {
      const res = await fetch(`${BASE_PATH}/api/admin/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: updatedSkill }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Ошибка обновления');
      await reloadInstructions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить статус');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSaved(_skill: Skill) {
    await reloadInstructions();
    setEditor({ open: false });
  }

  const editorTitle = !editor.open
    ? ''
    : editor.initial?.source === 'builtin'
      ? (editor.initial.hasJsonOverride
        ? `Встроенная (переопределение): ${editor.initial.name}`
        : `Встроенная инструкция: ${editor.initial.name}`)
      : editor.initial
        ? `Редактировать: ${editor.initial.name}`
        : 'Новая инструкция';

  const itemsByCategory = items.reduce((acc, item) => {
    const cat = shelfCategory(item);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, TextInstructionListItem[]>);

  const allCategories = Object.keys(itemsByCategory).sort();

  return (
    <div className="space-y-6">

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-on-surface">Текстовые инструкции</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Файлы в репозитории можно переопределить из админки (сохраняется в data/skills.json с тем же id). Сброс удаляет только переопределение.
            </p>
          </div>
          {!editor.open && (
            <button
              type="button"
              onClick={() => setEditor({ open: true })}
              className="ui-button-secondary rounded-lg px-3 py-1.5 text-sm flex-shrink-0"
            >
              + Добавить
            </button>
          )}
        </div>

        <AnimatePresence>
          {editor.open && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="ui-panel rounded-2xl p-5 mb-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-on-surface">{editorTitle}</h3>
                <button type="button" onClick={() => setEditor({ open: false })} className="text-on-surface-variant/60 hover:text-on-surface text-lg leading-none">×</button>
              </div>
              <SkillEditor
                initial={editor.open && editor.initial ? itemToSkillForm(editor.initial) : undefined}
                onSaved={handleSaved}
                onCancel={() => setEditor({ open: false })}
                availableSources={availableSources}
                availableAgents={availableAgents}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="text-xs text-red-600 mb-3">{error}</p>
        )}

        <div className="space-y-6">
          {loading ? (
            <div className="border border-outline-variant/15 rounded-xl p-4 text-xs text-on-surface-variant/60">Загрузка...</div>
          ) : items.length === 0 ? (
            <div className="border border-outline-variant/15 rounded-xl p-4 text-xs text-on-surface-variant/60 text-center">Нет инструкций</div>
          ) : (
            allCategories.map(category => (
              <div key={category}>
                <h3 className="text-xs font-medium text-on-surface-variant/60 uppercase tracking-wider mb-2">{category}</h3>
                <div className="border border-outline-variant/15 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container text-on-surface-variant text-xs">
                        <th className="text-left px-4 py-2.5 font-medium">ID</th>
                        <th className="text-left px-4 py-2.5 font-medium">Название</th>
                        <th className="text-center px-4 py-2.5 font-medium">Источник</th>
                        <th className="text-center px-4 py-2.5 font-medium">Статус</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {itemsByCategory[category].map(s => {
                        const isEditing = editor.open && editor.initial?.id === s.id;
                        const isToggling = togglingId === s.id;
                        const isBuiltin = s.source === 'builtin';
                        const sourceLabel = isBuiltin
                          ? (s.hasJsonOverride ? 'репозиторий + оверрайд' : 'репозиторий')
                          : 'админка';
                        return (
                          <tr key={s.id} className={`border-t border-outline-variant/10 hover:bg-surface-container-low/50 ${isEditing ? 'bg-surface-container-low/50' : ''}`}>
                            <td className="px-4 py-2.5 font-mono text-xs text-on-surface">{s.id}</td>
                            <td className="px-4 py-2.5 text-on-surface">{s.name}</td>
                            <td className="px-4 py-2.5 text-center text-xs text-on-surface-variant">
                              {sourceLabel}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {isBuiltin && !s.hasJsonOverride ? (
                                <span className="text-xs px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  из файла
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggle(s)}
                                  disabled={isToggling}
                                  title={s.enabled ? 'Выключить' : 'Включить'}
                                  className={`text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${s.enabled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-surface-container text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-high'
                                  }`}
                                >
                                  {isToggling ? '...' : s.enabled ? 'включен' : 'выключен'}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => setEditor({
                                    open: true,
                                    initial: s,
                                  })}
                                  disabled={editor.open}
                                  className="text-xs text-primary hover:text-primary/70 disabled:opacity-40 transition-colors"
                                >
                                  Изменить
                                </button>
                                {isBuiltin && s.hasJsonOverride ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(s.id)}
                                    disabled={deletingId === s.id}
                                    className="text-xs text-amber-700 hover:text-amber-600 disabled:opacity-40 transition-colors"
                                  >
                                    {deletingId === s.id ? '...' : 'Сбросить'}
                                  </button>
                                ) : !isBuiltin ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(s.id)}
                                    disabled={deletingId === s.id}
                                    className="text-xs text-red-600 hover:text-red-500 disabled:opacity-40 transition-colors"
                                  >
                                    {deletingId === s.id ? 'Удаление...' : 'Удалить'}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="ui-panel rounded-xl p-4 text-xs text-on-surface-variant space-y-1">
        <p className="text-on-surface font-medium text-sm mb-2">Как это работает</p>
        <p>1. Встроенные инструкции лежат в lib/skills/instructions/*.md. Их можно изменить из админки — текст сохранится в data/skills.json с тем же id (переопределение).</p>
        <p>2. «Сбросить» у встроенной инструкции удаляет только переопределение; снова используется файл из репозитория.</p>
        <p>3. Если переопределение выключено (выкл), агент снова видит текст из .md.</p>
        <p>4. Отдельные инструкции только из админки — только в JSON; их можно удалить полностью.</p>
      </section>
    </div>
  );
}
