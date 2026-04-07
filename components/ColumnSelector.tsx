'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ALL_COLUMNS } from '@/lib/report-columns';

interface ColumnSelectorProps {
  selected: string[];
  onChange: (cols: string[]) => void;
}

export default function ColumnSelector({ selected, onChange }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);

  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div className="ui-panel overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low/70"
      >
        <span>
          Настройка колонок{' '}
          <span className="ml-1 text-xs font-normal text-on-surface-variant">({selected.length} из {ALL_COLUMNS.length})</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
      </button>

      {open && (
        <div className="border-t border-outline-variant/10 px-5 py-4">
          <div className="mb-3 flex gap-3">
            <button
              type="button"
              className="ui-button-ghost rounded-lg px-2 py-1 text-xs font-medium text-primary"
              onClick={() => onChange(ALL_COLUMNS.map(c => c.key))}
            >
              Выбрать все
            </button>
            <button
              type="button"
              className="ui-button-ghost rounded-lg px-2 py-1 text-xs"
              onClick={() => onChange([])}
            >
              Снять все
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {ALL_COLUMNS.map(col => (
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
        </div>
      )}
    </div>
  );
}
