'use client';

import { useState, useRef, useEffect } from 'react';
import { BASE_PATH } from '@/lib/constants';
import type { Skill } from '@/lib/schema/types';

interface SourceOption { id: string; name: string; }
interface AgentOption { name: string; description: string; }

interface Props {
  initial?: Skill;
  /** Built-in repo instructions: view only, no save. */
  readOnly?: boolean;
  onSaved: (skill: Skill) => void;
  onCancel: () => void;
  availableSources?: SourceOption[];
  availableAgents?: AgentOption[];
}

function TagSelector({
  label,
  hint,
  options,
  selected,
  getKey,
  getLabel,
  onToggle,
  disabled = false,
}: {
  label: string;
  hint: string;
  options: string[];
  selected: string[];
  getKey: (o: string) => string;
  getLabel: (o: string) => string;
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <label className="block text-xs text-on-surface-variant mb-1">
        {label}
        <span className="ml-1 text-on-surface-variant/60">(опционально)</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const key = getKey(o);
          const active = selected.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              disabled={disabled}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                active
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/30 hover:text-on-surface'
              }`}
            >
              {getLabel(o)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-on-surface-variant/60 mt-1">{hint}</p>
    </div>
  );
}

export default function SkillEditor({
  initial,
  readOnly = false,
  onSaved,
  onCancel,
  availableSources = [],
  availableAgents = [],
}: Props) {
  const [id, setId] = useState(initial?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [selectedSources, setSelectedSources] = useState<string[]>(initial?.sources ?? []);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(initial?.agents ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [instruction]);

  function toggleItem(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  }

  function generateIdFromName() {
    if (!name.trim()) return;
    const generated = name
      .toLowerCase()
      .replace(/[^а-яa-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    setId(generated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!id.trim() || !name.trim() || !instruction.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }

    setSaving(true);
    setError(null);

    const skill: Skill = {
      id: id.trim(),
      name: name.trim(),
      instruction: instruction.trim(),
      enabled,
      category: category.trim() || undefined,
      sources: selectedSources.length ? selectedSources : undefined,
      agents: selectedAgents.length ? selectedAgents : undefined,
    };

    try {
      const res = await fetch(`${BASE_PATH}/api/admin/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Ошибка сохранения');
        return;
      }
      onSaved(skill);
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-on-surface-variant mb-1">ID <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={id}
            onChange={e => setId(e.target.value)}
            onBlur={() => !id && generateIdFromName()}
            className="w-full border border-outline-variant/20 bg-white rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/30 disabled:opacity-60 disabled:bg-surface-container"
            placeholder="krm-krp-analysis"
            disabled={!!initial || readOnly}
          />
        </div>
        <div>
          <label className="block text-xs text-on-surface-variant mb-1">Название <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-outline-variant/20 bg-white rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/30 disabled:opacity-60 disabled:bg-surface-container"
            placeholder="Анализ КРМ/КРП"
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-on-surface-variant mb-1">Категория</label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border border-outline-variant/20 bg-white rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/30 disabled:opacity-60 disabled:bg-surface-container"
            placeholder="analytics"
            disabled={readOnly}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-outline-variant/20 text-primary focus:ring-primary/30 disabled:opacity-60"
              disabled={readOnly}
            />
            Включен
          </label>
        </div>
      </div>

      <TagSelector
        label="Источники данных"
        hint="Пусто — скилл применяется ко всем источникам"
        options={availableSources.map(s => s.id)}
        selected={selectedSources}
        getKey={id => id}
        getLabel={id => availableSources.find(s => s.id === id)?.name ?? id}
        onToggle={key => toggleItem(selectedSources, setSelectedSources, key)}
        disabled={readOnly}
      />

      <TagSelector
        label="Агенты"
        hint="Пусто — скилл применяется ко всем агентам"
        options={availableAgents.map(a => a.name)}
        selected={selectedAgents}
        getKey={name => name}
        getLabel={name => name}
        onToggle={key => toggleItem(selectedAgents, setSelectedAgents, key)}
        disabled={readOnly}
      />

      <div>
        <label className="block text-xs text-on-surface-variant mb-1">Инструкция <span className="text-red-500">*</span></label>
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          rows={6}
          className="w-full border border-outline-variant/20 bg-white rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/30 resize-none font-mono disabled:opacity-60 disabled:bg-surface-container"
          placeholder="Опишите здесь инструкцию для агента..."
          disabled={readOnly}
          readOnly={readOnly}
        />
        <p className="text-xs text-on-surface-variant/60 mt-1">Используйте Markdown для форматирования</p>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          disabled={saving}
        >
          {readOnly ? 'Закрыть' : 'Отмена'}
        </button>
        {!readOnly && (
          <button
            type="submit"
            disabled={saving}
            className="ui-button-secondary rounded-lg px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        )}
      </div>
    </form>
  );
}
