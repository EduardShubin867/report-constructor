'use client';

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
      >
        <span>
          Настройка колонок{' '}
          <span className="ml-1 text-xs font-normal text-gray-400">({selected.length} из {ALL_COLUMNS.length})</span>
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex gap-3 mb-3">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => onChange(ALL_COLUMNS.map(c => c.key))}
            >
              Выбрать все
            </button>
            <button
              type="button"
              className="text-xs text-gray-500 hover:underline"
              onClick={() => onChange([])}
            >
              Снять все
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-2">
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={selected.includes(col.key)}
                  onChange={() => toggle(col.key)}
                  className="accent-blue-600 shrink-0"
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
