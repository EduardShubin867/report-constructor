import { Check, ChevronDown, Network, Sparkles } from 'lucide-react';
import { useState } from 'react';
import GenericReportFilters from '@/components/GenericReportFilters';
import type { ManualReportSourcePayload } from '@/lib/report-filters-data';
import { ColPicker } from './ColPicker';
import type { FiltersMap, Side } from './types';

export function SourcePane({
  side,
  sourceName,
  joinFieldLabel,
  bootstrap,
  columns,
  onColumnsChange,
  filters,
  onFiltersChange,
  options,
  lazyLoading,
  onLazyOpen,
  onChangeLink,
}: {
  side: Side;
  sourceName: string;
  joinFieldLabel: string;
  bootstrap: ManualReportSourcePayload;
  columns: string[];
  onColumnsChange: (cols: string[]) => void;
  filters: FiltersMap;
  onFiltersChange: (v: FiltersMap) => void;
  options: Record<string, string[]>;
  lazyLoading: Record<string, boolean>;
  onLazyOpen: (key: string) => void;
  onChangeLink: () => void;
}) {
  const isLeft = side === 'left';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = bootstrap.filterOptions.filterDefs.length > 0;
  const activeFilterCount = Object.values(filters).filter(v => v.length > 0).length;

  function toggleCol(key: string) {
    if (columns.includes(key)) {
      onColumnsChange(columns.filter(k => k !== key));
    } else {
      onColumnsChange([...columns, key]);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-outline-variant/12 p-3">
        <div className="mb-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isLeft
                ? 'bg-primary-fixed/60 text-primary'
                : 'bg-tertiary-fixed/60 text-tertiary'
            }`}
          >
            Таблица {isLeft ? 'А' : 'Б'}
          </span>
        </div>
        <div
          className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 ${
            isLeft
              ? 'border-primary/20 bg-primary-fixed/25'
              : 'border-tertiary/20 bg-tertiary-fixed/25'
          }`}
        >
          <div
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white ${
              isLeft ? 'bg-primary' : 'bg-tertiary'
            }`}
          >
            {isLeft ? (
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Network className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-on-surface">{sourceName}</p>
            <p className="truncate text-[11px] text-on-surface-variant">
              Поле связи:{' '}
              <span className="font-medium text-on-surface">{joinFieldLabel}</span>
            </p>
          </div>
          <button
            type="button"
            className="flex-shrink-0 text-[11px] text-on-surface-variant underline underline-offset-2 hover:text-primary"
            onClick={onChangeLink}
          >
            сменить
          </button>
        </div>
      </div>

      <div
        className={`flex flex-shrink-0 items-center justify-between border-b border-outline-variant/10 px-3 py-1.5 ${
          isLeft ? 'bg-primary-fixed/10' : 'bg-tertiary-fixed/10'
        }`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Колонки · {columns.length} выбрано
        </span>
        {columns.length > 0 && (
          <button
            type="button"
            className="text-[10px] text-on-surface-variant/50 hover:text-on-surface"
            onClick={() => onColumnsChange([])}
          >
            Сбросить
          </button>
        )}
      </div>

      <ColPicker
        columns={bootstrap.columns}
        selected={columns}
        onToggle={toggleCol}
        side={side}
      />

      {hasFilters && (
        <div className="flex-shrink-0 border-t border-outline-variant/12">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-surface-container-low/40"
            onClick={() => setFiltersOpen(o => !o)}
          >
            <span className="flex items-center gap-1.5 font-medium text-on-surface-variant">
              Фильтры
              {activeFilterCount > 0 && (
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isLeft ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'
                  }`}
                >
                  {activeFilterCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-on-surface-variant transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              strokeWidth={2.2}
            />
          </button>
          {filtersOpen && (
            <div className="max-h-[50vh] overflow-y-auto border-t border-outline-variant/10 px-2 py-2">
              <GenericReportFilters
                filterDefs={bootstrap.filterOptions.filterDefs}
                options={options}
                values={filters}
                periodFilterCols={[]}
                periodFilters={{}}
                lazyFilterLoading={lazyLoading}
                onLazyFilterOpen={onLazyOpen}
                onFiltersChange={onFiltersChange}
                onPeriodChange={() => {}}
                compact
              />
            </div>
          )}
        </div>
      )}

      <div className="flex-shrink-0 border-t border-outline-variant/12 px-3 py-1.5">
        <span className="text-[11px] text-on-surface-variant">
          <Check className="mr-1 inline h-3 w-3" strokeWidth={2.5} />
          {columns.length} из {bootstrap.columns.length} колонок выбрано
        </span>
      </div>
    </div>
  );
}
