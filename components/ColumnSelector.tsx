'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ALL_COLUMNS, type ColumnDef } from '@/lib/report-columns';

interface ColumnSelectorProps {
  selected: string[];
  onChange: (cols: string[]) => void;
  /** Override the column list (e.g. server-filtered visible columns). Defaults to ALL_COLUMNS. */
  columns?: ColumnDef[];
  /** При активной группировке — опция колонки COUNT договоров. */
  groupByActive?: boolean;
  showContractCount?: boolean;
  onShowContractCountChange?: (value: boolean) => void;
}

export default function ColumnSelector({
  selected,
  onChange,
  columns,
  groupByActive = false,
  showContractCount = true,
  onShowContractCountChange,
}: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const cols = columns ?? ALL_COLUMNS;

  const filtered = search.trim()
    ? cols.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || c.key.toLowerCase().includes(search.toLowerCase()))
    : cols;

  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  function handleToggleOpen() {
    if (open) setSearch('');
    setOpen(o => !o);
  }

  return (
    <div className="ui-panel overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={handleToggleOpen}
        className="flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low/70"
      >
        <span>
          Настройка колонок{' '}
          <span className="ml-1 text-xs font-normal text-on-surface-variant">({selected.length} из {cols.length})</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
      </button>

      {open && (
        <div className="border-t border-outline-variant/10 px-5 py-4">
          <div className="mb-3 flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по колонкам..."
              className="h-7 flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-low/60 px-3 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary/50 focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              className="ui-button-ghost rounded-lg px-2 py-1 text-xs font-medium text-primary"
              onClick={() => {
                const keys = filtered.map(c => c.key);
                const allSelected = keys.every(k => selected.includes(k));
                if (allSelected) {
                  onChange(selected.filter(k => !keys.includes(k)));
                } else {
                  onChange([...new Set([...selected, ...keys])]);
                }
              }}
            >
              {filtered.every(c => selected.includes(c.key)) ? 'Снять' : 'Выбрать'}
            </button>
            <button
              type="button"
              className="ui-button-ghost rounded-lg px-2 py-1 text-xs"
              onClick={() => onChange([])}
            >
              Сбросить
            </button>
          </div>
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-on-surface-variant">Ничего не найдено</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map(col => (
                <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-on-surface transition-colors hover:bg-surface-container-low/60 hover:text-primary">
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => toggle(col.key)}
                    className="shrink-0 accent-primary"
                  />
                  <span className="truncate" title={col.label}>{col.label}</span>
                </label>
              ))}
            </div>
          )}
          {groupByActive && onShowContractCountChange ? (
            <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-outline-variant/10 pt-4 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={showContractCount}
                onChange={e => onShowContractCountChange(e.target.checked)}
                className="shrink-0 accent-primary"
              />
              <span>Показывать колонку «Кол-во договоров»</span>
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}
