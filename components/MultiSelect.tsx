'use client';

import { ChevronDown, LoaderCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  loading?: boolean;
}

export default function MultiSelect({ options = [], value, onChange, placeholder = 'Все', label, loading }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  const displayText = value.length === 0
    ? placeholder
    : value.length === 1
    ? value[0]
    : `Выбрано: ${value.length}`;

  return (
    <div className={`relative ${open ? 'z-30' : ''}`} ref={ref}>
      {label && <label className="mb-1 block text-sm font-medium text-on-surface">{label}</label>}
      <button
        type="button"
        onClick={() => !loading && setOpen(o => !o)}
        disabled={loading}
        className={`ui-field flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm focus:outline-none ${
          loading
            ? 'cursor-not-allowed border-outline-variant/10 bg-surface-container-low text-on-surface-variant/60'
            : open
              ? 'border-primary/30'
              : ''
        }`}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-on-surface-variant/70">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
            Загрузка…
          </span>
        ) : (
          <>
            <span className={value.length === 0 ? 'text-on-surface-variant/70' : 'text-on-surface'}>{displayText}</span>
            <ChevronDown className={`h-4 w-4 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
          </>
        )}
      </button>

      {open && (
        <div className="ui-panel absolute z-[80] mt-2 flex max-h-72 w-full flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-outline-variant/10 p-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="ui-field w-full rounded-xl px-3 py-2 text-sm focus:border-primary/30 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex gap-2 border-b border-outline-variant/10 px-2 py-2">
            <button
              type="button"
              className="ui-button-ghost rounded-lg px-2 py-1 text-xs font-medium text-primary"
              onClick={() => onChange(filtered)}
            >
              Все
            </button>
            <button
              type="button"
              className="ui-button-ghost rounded-lg px-2 py-1 text-xs"
              onClick={() => onChange([])}
            >
              Сбросить
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-on-surface-variant/70">Ничего не найдено</div>
            )}
            {filtered.map(opt => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low/80">
                <input
                  type="checkbox"
                  checked={value.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="shrink-0 accent-primary"
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
