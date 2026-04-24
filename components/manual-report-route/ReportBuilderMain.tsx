import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical, X } from 'lucide-react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import GenericReportFilters from '@/components/GenericReportFilters';
import GroupBySelector from '@/components/GroupBySelector';
import { CONTRACT_COUNT_COLUMN_KEY, type ColumnDef } from '@/lib/report-columns';
import type { AggregationFn } from '@/lib/query-builder';
import type { SourceFilterOptions } from '@/lib/report-filters-data';

import { AGG_LABELS } from './constants';
import { CanvasBlock } from './CanvasBlock';
import { TypeBadge } from './TypeBadge';
import type { AppliedReportSnapshot, ManualSortState } from './types';

type ReportBuilderMainProps = {
  selectedColumns: string[];
  setSelectedColumns: Dispatch<SetStateAction<string[]>>;
  visibleColumns: ColumnDef[];
  groupByColumns: ColumnDef[];
  removeColumn: (key: string) => void;
  groupBy: string[];
  setGroupBy: Dispatch<SetStateAction<string[]>>;
  showContractCount: boolean;
  setShowContractCount: (v: boolean) => void;
  columnAggregations: Record<string, AggregationFn>;
  setColumnAggregations: Dispatch<SetStateAction<Record<string, AggregationFn>>>;
  activeFilterCount: number;
  manualError: string | null;
  filterOptions: SourceFilterOptions;
  mergedFilterOptions: Record<string, string[]>;
  genericFilters: Record<string, string[]>;
  setGenericFilters: Dispatch<SetStateAction<Record<string, string[]>>>;
  periodFilters: Record<string, { from: string; to: string }>;
  setPeriodFilters: Dispatch<SetStateAction<Record<string, { from: string; to: string }>>>;
  filtersLoading: boolean;
  onLazyFilterOpen: (key: string) => void;
  lazyFilterLoading: Record<string, boolean>;
  filtersBlockOpen: boolean;
  setFiltersBlockOpen: Dispatch<SetStateAction<boolean>>;
  groupingBlockOpen: boolean;
  setGroupingBlockOpen: Dispatch<SetStateAction<boolean>>;
  appliedSnapshot: AppliedReportSnapshot | null;
  hasSearched: boolean;
  pageSize: number;
  selectedSourceId: string;
  fetchReport: (
    nextPage: number,
    nextPageSize: number,
    nextFilters: Record<string, string[]>,
    nextPeriodFilters: Record<string, { from: string; to: string }>,
    columns: string[],
    nextGroupBy: string[],
    sourceId: string,
    overrides?: Partial<{ sort: ManualSortState; includeContractCount: boolean }>,
  ) => void;
  setManualSort: (v: ManualSortState) => void;
  setPage: (n: number) => void;
  dragIndexRef: MutableRefObject<number | null>;
  dragOverIndex: number | null;
  setDragOverIndex: (v: number | null) => void;
};

export function ReportBuilderMain({
  selectedColumns,
  setSelectedColumns,
  visibleColumns,
  groupByColumns,
  removeColumn,
  groupBy,
  setGroupBy,
  showContractCount,
  setShowContractCount,
  columnAggregations,
  setColumnAggregations,
  activeFilterCount,
  manualError,
  filterOptions,
  mergedFilterOptions,
  genericFilters,
  setGenericFilters,
  periodFilters,
  setPeriodFilters,
  filtersLoading,
  onLazyFilterOpen,
  lazyFilterLoading,
  filtersBlockOpen,
  setFiltersBlockOpen,
  groupingBlockOpen,
  setGroupingBlockOpen,
  appliedSnapshot,
  hasSearched,
  pageSize,
  selectedSourceId,
  fetchReport,
  setManualSort,
  setPage,
  dragIndexRef,
  dragOverIndex,
  setDragOverIndex,
}: ReportBuilderMainProps) {
  const measureCols = selectedColumns
    .map(k => visibleColumns.find(c => c.key === k))
    .filter((c): c is ColumnDef => c != null && c.type === 'number' && !groupBy.includes(c.key));
  const AGG_OPTIONS = (Object.entries(AGG_LABELS) as [AggregationFn, string][]);

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-surface-container-lowest/40 px-5 py-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-on-surface">Новый отчёт</h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Собирайте отчёт блоками — каждый шаг влияет на результат справа.
          </p>
        </div>
      </div>

      <CanvasBlock
        step={1}
        title="Колонки отчёта"
        subtitle="Что показать в таблице. Кликните колонки слева — перетащите, чтобы изменить порядок."
        badge={selectedColumns.length > 0 ? `${selectedColumns.length} выбрано` : undefined}
      >
        {selectedColumns.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low/25 py-5 text-sm text-on-surface-variant">
            Пусто.{' '}
            <span className="ml-1 font-medium text-on-surface">Кликните колонки слева</span>
            &nbsp;или воспользуйтесь поиском.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedColumns.map((key, idx) => {
              const col = visibleColumns.find(c => c.key === key) ?? groupByColumns.find(c => c.key === key);
              if (!col) return null;
              const isDragOver = dragOverIndex === idx;
              return (
                <span
                  key={key}
                  draggable
                  onDragStart={() => { dragIndexRef.current = idx; }}
                  onDragOver={e => { e.preventDefault(); setDragOverIndex(idx); }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={e => {
                    e.preventDefault();
                    const from = dragIndexRef.current;
                    setDragOverIndex(null);
                    if (from === null || from === idx) return;
                    setSelectedColumns(prev => {
                      const next = [...prev];
                      const [item] = next.splice(from, 1);
                      next.splice(idx, 0, item);
                      return next;
                    });
                    dragIndexRef.current = null;
                  }}
                  onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                  className={`inline-flex cursor-grab items-center gap-1.5 rounded-full border border-primary/20 bg-primary-fixed/25 px-2.5 py-1 text-[12.5px] text-primary transition-colors active:cursor-grabbing ${isDragOver ? 'ring-2 ring-primary/30' : ''}`}
                >
                  <GripVertical className="h-3 w-3 flex-shrink-0 opacity-40" />
                  <TypeBadge type={col.type} />
                  <span>
                    {col.label}
                    {groupBy.length > 0 && col.type === 'number' && !groupBy.includes(key) && (
                      <span className="ml-1 text-on-surface-variant/60">
                        · {AGG_LABELS[columnAggregations[key] ?? 'sum']}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeColumn(key)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-surface-container-low/80"
                  >
                    <X className="h-2.5 w-2.5 text-on-surface-variant" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </CanvasBlock>

      <CanvasBlock
        step={2}
        title="Фильтры"
        subtitle="Какие строки попадут в отчёт."
        badge={activeFilterCount > 0 ? String(activeFilterCount) : undefined}
        collapsible
        open={filtersBlockOpen}
        onToggle={() => { setFiltersBlockOpen(o => !o); }}
      >
        <GenericReportFilters
          compact
          filterDefs={filterOptions.filterDefs}
          options={mergedFilterOptions}
          values={genericFilters}
          periodFilterCols={filterOptions.periodFilterCols}
          periodFilters={periodFilters}
          filtersLoading={filtersLoading}
          onLazyFilterOpen={onLazyFilterOpen}
          lazyFilterLoading={lazyFilterLoading}
          onFiltersChange={setGenericFilters}
          onPeriodChange={(key, from, to) => setPeriodFilters(prev => ({ ...prev, [key]: { from, to } }))}
        />
      </CanvasBlock>

      <CanvasBlock
        step={3}
        title="Группировка и расчёты"
        subtitle="Сверните строки по общим значениям и посчитайте итоги."
        badge={groupBy.length > 0 ? `${groupBy.length} полей` : undefined}
        optional
        collapsible
        open={groupingBlockOpen}
        onToggle={() => { setGroupingBlockOpen(o => !o); }}
      >
        <GroupBySelector
          compact
          groupBy={groupBy}
          displayColumns={selectedColumns}
          onChange={newGroupBy => {
            setSelectedColumns(prev => {
              const missing = newGroupBy.filter(k => !prev.includes(k));
              return missing.length > 0 ? [...prev, ...missing] : prev;
            });
            setGroupBy(newGroupBy);
          }}
          availableColumns={groupByColumns}
          showContractCount={showContractCount}
          onShowContractCountChange={v => {
            setShowContractCount(v);
            const snap = appliedSnapshot;
            if (!hasSearched || !snap || snap.groupBy.length === 0) return;
            const prevSort = snap.sort;
            const nextSort = !v && prevSort.col === CONTRACT_COUNT_COLUMN_KEY ? { col: null, dir: null } : prevSort;
            setManualSort(nextSort);
            setPage(1);
            void fetchReport(1, pageSize, snap.filters, snap.periodFilters, snap.columns, snap.groupBy, selectedSourceId, { includeContractCount: v, sort: nextSort });
          }}
        />
      </CanvasBlock>

      {groupBy.length > 0 && measureCols.length > 0 && (
        <CanvasBlock
          step={4}
          title="Считать"
          subtitle="Как агрегировать числовые показатели внутри каждой группы."
        >
          <div className="divide-y divide-outline-variant/10">
            {measureCols.map(col => {
              const current = columnAggregations[col.key] ?? 'sum';
              return (
                <div key={col.key} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <TypeBadge type={col.type} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-on-surface" title={col.label}>
                    {col.label}
                  </span>
                  <div className="flex gap-0.5">
                    {AGG_OPTIONS.map(([fn, label]) => (
                      <button
                        key={fn}
                        type="button"
                        onClick={() => setColumnAggregations(prev => ({ ...prev, [col.key]: fn }))}
                        className={`rounded px-2 py-[3px] text-[11px] font-medium transition-colors ${
                          current === fn
                            ? 'bg-primary text-white'
                            : 'text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CanvasBlock>
      )}

      <AnimatePresence>
        {manualError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
          >
            {manualError}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
