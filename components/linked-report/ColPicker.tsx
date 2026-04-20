import { Check, Search } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@/lib/report-columns';
import type { Side } from './types';
import { TypeBadge } from './TypeBadge';

export function ColPicker({
  columns,
  selected,
  onToggle,
  side,
}: {
  columns: ColumnDef[];
  selected: string[];
  onToggle: (key: string) => void;
  side: Side;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q
    ? columns.filter(c => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q))
    : columns;
  const isLeft = side === 'left';

  return (
    <>
      <div className="flex-shrink-0 border-b border-outline-variant/10 px-3 py-2">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-on-surface-variant/40"
            strokeWidth={2}
          />
          <input
            className="w-full rounded-lg border border-outline-variant/15 bg-surface-container-lowest py-1.5 pl-8 pr-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:outline-none"
            placeholder={`Поиск в ${columns.length} колонках…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {filtered.map(col => {
          const on = selected.includes(col.key);
          return (
            <div
              key={col.key}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                on
                  ? isLeft
                    ? 'bg-primary-fixed/35 text-on-surface'
                    : 'bg-tertiary-fixed/35 text-on-surface'
                  : 'text-on-surface hover:bg-surface-container-low/50'
              }`}
              onClick={() => onToggle(col.key)}
            >
              <div
                className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
                  on
                    ? isLeft
                      ? 'border-primary bg-primary text-white'
                      : 'border-tertiary bg-tertiary text-white'
                    : 'border-outline-variant/40 bg-surface'
                }`}
              >
                {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </div>
              <TypeBadge type={col.type} />
              <span className="flex-1 truncate" title={col.label}>
                {col.label}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-on-surface-variant/50">
            Ничего не найдено
          </p>
        )}
      </div>
    </>
  );
}
