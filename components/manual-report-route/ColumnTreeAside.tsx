import { ChevronRight, Plus, Search, X } from 'lucide-react';
import { SetStateAction } from 'react';

import type { ColumnGroup } from './types';
import { TypeBadge } from './TypeBadge';

type ColumnTreeAsideProps = {
  selectedSource: { name: string } | null;
  visibleColumnCount: number;
  columnSearch: string;
  onColumnSearchChange: (q: string) => void;
  columnGroups: ColumnGroup[];
  filtersLoading: boolean;
  openGroups: Set<string>;
  setOpenGroups: (value: SetStateAction<Set<string>>) => void;
  selectedColumns: string[];
  onToggleColumn: (key: string, isAdded: boolean) => void;
  sources: { id: string; name: string }[];
  selectedSourceId: string;
  onSelectSource: (id: string) => void;
};

export function ColumnTreeAside({
  selectedSource,
  visibleColumnCount,
  columnSearch,
  onColumnSearchChange,
  columnGroups,
  filtersLoading,
  openGroups,
  setOpenGroups,
  selectedColumns,
  onToggleColumn,
  sources,
  selectedSourceId,
  onSelectSource,
}: ColumnTreeAsideProps) {
  return (
    <aside className="flex w-80 flex-shrink-0 flex-col overflow-hidden border-r border-outline-variant/12 bg-surface">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-outline-variant/12 px-3.5 py-2.5">
        <span className="text-sm font-semibold text-on-surface">
          {selectedSource?.name ?? 'Источник'}
          <span className="ml-2 text-[11.5px] font-normal text-on-surface-variant">
            · {visibleColumnCount} колонок
          </span>
        </span>
      </div>

      <div className="flex-shrink-0 border-b border-outline-variant/10 p-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-on-surface-variant/40" strokeWidth={2} />
          <input
            type="text"
            value={columnSearch}
            onChange={e => onColumnSearchChange(e.target.value)}
            placeholder={`Поиск по ${visibleColumnCount} колонкам…`}
            className="flex-1 bg-transparent text-[12.5px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-0"
          />
          {columnSearch ? (
            <button type="button" onClick={() => onColumnSearchChange('')}>
              <X className="h-3 w-3 text-on-surface-variant/40 hover:text-on-surface-variant" />
            </button>
          ) : (
            <span className="ml-auto rounded border border-outline-variant/15 border-b-2 bg-surface-container-low px-1 py-px font-mono text-[10.5px] leading-none text-on-surface-variant/60">
              ⌘K
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {!columnSearch && (
          <div className="mx-1 mb-2 flex gap-2 rounded-lg border border-dashed border-outline-variant/20 bg-surface-container-low/30 p-2.5 text-[11.5px] text-on-surface-variant">
            <span className="mt-px flex-shrink-0 text-amber-500">💡</span>
            Разверните группу и кликните по колонкам, чтобы добавить их в отчёт.
          </div>
        )}

        {filtersLoading && visibleColumnCount === 0 && (
          <div className="px-2 py-3 text-xs text-on-surface-variant/50">Загрузка колонок…</div>
        )}

        {columnGroups.map(group => {
          const filteredCols = columnSearch
            ? group.columns.filter(c =>
                c.label.toLowerCase().includes(columnSearch.toLowerCase()) ||
                c.key.toLowerCase().includes(columnSearch.toLowerCase()),
              )
            : group.columns;
          if (columnSearch && filteredCols.length === 0) return null;
          const isOpen = !!columnSearch || openGroups.has(group.id);

          return (
            <div key={group.id} className="mb-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-[7px] text-left hover:bg-surface-container-low/50"
                onClick={() => {
                  if (columnSearch) return;
                  setOpenGroups(prev => {
                    const next = new Set(prev);
                    if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                    return next;
                  });
                }}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 flex-shrink-0 text-on-surface-variant/50 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                />
                <span className="flex-1 truncate text-[12.5px] font-medium text-on-surface">{group.name}</span>
                <span className="font-mono text-[11px] text-on-surface-variant/50">{group.columns.length}</span>
              </button>

              {isOpen && filteredCols.map(col => {
                const isAdded = selectedColumns.includes(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    className={`group flex w-full items-center gap-2 rounded-md py-[5px] pl-7 pr-2 text-left text-[12.5px] transition-colors ${
                      isAdded
                        ? 'bg-primary-fixed/35 text-on-surface hover:bg-primary-fixed/45'
                        : 'text-on-surface hover:bg-surface-container-low/50'
                    }`}
                    onClick={() => onToggleColumn(col.key, isAdded)}
                    title={col.key}
                  >
                    <TypeBadge type={col.type} />
                    <span className="flex-1 truncate">{col.label}</span>
                    {isAdded
                      ? <span className="flex-shrink-0 text-[10px] text-primary">✓</span>
                      : <Plus className="h-3 w-3 flex-shrink-0 text-on-surface-variant/40 opacity-0 group-hover:opacity-100" />
                    }
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {sources.length > 1 && (
        <div className="flex-shrink-0 border-t border-outline-variant/12 p-2">
          <div className="flex gap-0.5 rounded-lg bg-surface-container-low/60 p-0.5">
            {sources.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSource(s.id)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  s.id === selectedSourceId
                    ? 'bg-surface text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
