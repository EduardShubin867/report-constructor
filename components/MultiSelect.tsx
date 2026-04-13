'use client';

import { ChevronDown, LoaderCircle } from 'lucide-react';
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  loading?: boolean;
  /** Вызывается при раскрытии (true) и закрытии (false) списка. */
  onOpenChange?: (open: boolean) => void;
}

const ROW_HEIGHT = 36;
const VIEWPORT_MAX_HEIGHT = 288; // matches max-h-72

export default function MultiSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Все',
  label,
  loading,
  onOpenChange,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset search when the dropdown closes so reopening starts fresh.
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  // Lowercase the query once per change and filter the full options list.
  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return options;
    return options.filter(o => o.toLowerCase().includes(query));
  }, [options, deferredSearch]);

  // Fast lookup for "is selected?" so per-row work stays O(1).
  const selectedSet = useMemo(() => new Set(value), [value]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  function toggle(opt: string) {
    if (selectedSet.has(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  function selectAllFiltered() {
    if (filtered.length === 0) return;
    const merged = new Set(value);
    for (const opt of filtered) merged.add(opt);
    onChange(Array.from(merged));
  }

  const displayText = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `Выбрано: ${value.length}`;

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div className={`relative ${open ? 'z-30' : ''}`} ref={ref}>
      {label && <label className="mb-1 block text-sm font-medium text-on-surface">{label}</label>}
      <button
        type="button"
        onClick={() => {
          setOpen(prev => {
            const next = !prev;
            onOpenChange?.(next);
            return next;
          });
        }}
        className={`ui-field flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm focus:outline-none ${
          loading && !open
            ? 'cursor-not-allowed border-outline-variant/10 bg-surface-container-low text-on-surface-variant/60'
            : open
              ? 'border-primary/30'
              : ''
        }`}
      >
        {loading && !open ? (
          <span className="flex items-center gap-2 text-on-surface-variant/70">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
            Загрузка…
          </span>
        ) : (
          <>
            <span className={value.length === 0 ? 'text-on-surface-variant/70' : 'text-on-surface'}>
              {displayText}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
              strokeWidth={2.2}
            />
          </>
        )}
      </button>

      {open && (
        <div className="ui-panel absolute z-[80] mt-2 flex w-full flex-col overflow-hidden rounded-2xl">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-on-surface-variant/70">
              <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Загрузка значений…
            </div>
          ) : (
            <>
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
              <div className="flex items-center justify-between gap-2 border-b border-outline-variant/10 px-2 py-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="ui-button-ghost rounded-lg px-2 py-1 text-xs font-medium text-primary"
                    onClick={selectAllFiltered}
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
                <span className="text-[11px] text-on-surface-variant/70">
                  {filtered.length.toLocaleString('ru-RU')}
                </span>
              </div>
              <div
                ref={listRef}
                className="overflow-y-auto"
                style={{ maxHeight: VIEWPORT_MAX_HEIGHT }}
              >
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-on-surface-variant/70">Ничего не найдено</div>
                ) : (
                  <div style={{ height: totalSize, position: 'relative' }}>
                    {virtualItems.map(virtualRow => {
                      const opt = filtered[virtualRow.index];
                      const checked = selectedSet.has(opt);
                      return (
                        <label
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          className="absolute left-0 top-0 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low/80"
                          style={{ transform: `translateY(${virtualRow.start}px)` }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(opt)}
                            className="shrink-0 accent-primary"
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
