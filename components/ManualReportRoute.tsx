'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ColumnSelector from '@/components/ColumnSelector';
import GroupBySelector from '@/components/GroupBySelector';
import GenericReportFilters from '@/components/GenericReportFilters';
import ReportsChrome from '@/components/ReportsChrome';
import UnifiedReportTable from '@/components/UnifiedReportTable';
import { CONTRACT_COUNT_COLUMN_KEY, type ColumnDef } from '@/lib/report-columns';
import type { ManualReportSourcePayload, SourceFilterOptions } from '@/lib/report-filters-data';
import { BASE_PATH } from '@/lib/constants';
type ManualSortState = { col: string | null; dir: 'asc' | 'desc' | null };

interface ReportResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

interface ManualReportRouteProps {
  initialSourceId?: string;
  sources?: { id: string; name: string }[];
  /**
   * Per-source data from the server: visible columns (incl. groupable), filter defs + option lists.
   * Switching the source dropdown uses this map — no extra round-trips unless `filterError` triggers a retry.
   * May be absent on the first client pass while the RSC payload is streaming.
   */
  initialBootstrapBySourceId?: Record<string, ManualReportSourcePayload> | null;
}

const emptyBootstrap: ManualReportSourcePayload = {
  columns: [],
  filterOptions: { filterDefs: [], options: {}, dateFilterCol: null },
  filterError: true,
};

/** Stable fallback when the prop is missing (RSC edge / stale client chunk). */
const emptyBootstrapBySourceId: Record<string, ManualReportSourcePayload> = {};

function coerceBootstrapMap(
  value: Record<string, ManualReportSourcePayload> | null | undefined,
): Record<string, ManualReportSourcePayload> {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) return value;
  return emptyBootstrapBySourceId;
}

export default function ManualReportRoute({
  initialSourceId = '',
  sources = [],
  initialBootstrapBySourceId,
}: ManualReportRouteProps) {
  const bootstrapById = coerceBootstrapMap(initialBootstrapBySourceId);
  const boot0 = bootstrapById[initialSourceId] ?? emptyBootstrap;
  const [selectedSourceId, setSelectedSourceId] = useState(initialSourceId);
  const [filterOptions, setFilterOptions] = useState<SourceFilterOptions>(boot0.filterOptions);
  const [genericFilters, setGenericFilters] = useState<Record<string, string[]>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersLoading, setFiltersLoading] = useState(boot0.filterError);
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef[]>(boot0.columns);
  const [manualError, setManualError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [showContractCount, setShowContractCount] = useState(true);
  const [manualSort, setManualSort] = useState<ManualSortState>({ col: null, dir: null });
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const isFirstSourceChange = useRef(true);

  // Reset form state when source changes; apply server-prefetched columns + filters from props.
  useEffect(() => {
    if (isFirstSourceChange.current) {
      isFirstSourceChange.current = false;
      return;
    }
    setGenericFilters({});
    setDateFrom('');
    setDateTo('');
    setGroupBy([]);
    setShowContractCount(true);
    setManualSort({ col: null, dir: null });
    setResult(null);
    setHasSearched(false);
    setPage(1);
    const p = bootstrapById[selectedSourceId];
    if (p) {
      setVisibleColumns(p.columns);
      setFilterOptions(p.filterOptions);
      setSelectedColumns(prev => prev.filter(k => p.columns.some(c => c.key === k)));
      setFiltersLoading(p.filterError);
    } else {
      setFiltersLoading(true);
      setVisibleColumns([]);
      setFilterOptions({ filterDefs: [], options: {}, dateFilterCol: null });
      setSelectedColumns([]);
    }
  }, [selectedSourceId, bootstrapById]);

  /**
   * Fill or repair filter/column metadata over HTTP when props lack a usable bundle
   * (missing key, filter prefetch failed, or columns empty).
   */
  useEffect(() => {
    const boot = bootstrapById[selectedSourceId];
    if (boot && !boot.filterError && boot.columns.length > 0) {
      // Props may arrive after the first client paint (streaming); keep state in sync without waiting on fetch.
      setVisibleColumns(boot.columns);
      setFilterOptions(boot.filterOptions);
      setFiltersLoading(false);
      setSelectedColumns(prev => prev.filter(k => boot.columns.some(c => c.key === k)));
      return;
    }

    let cancelled = false;
    setFiltersLoading(true);
    const needFilters = !boot || boot.filterError;
    const needCols = !boot || boot.columns.length === 0;

    void Promise.all([
      needFilters
        ? fetch(`${BASE_PATH}/api/report/filters?sourceId=${selectedSourceId}`).then(r => (r.ok ? r.json() : null))
        : Promise.resolve(null),
      needCols
        ? fetch(`${BASE_PATH}/api/report/columns?sourceId=${selectedSourceId}`).then(r => (r.ok ? r.json() : null))
        : Promise.resolve(null),
    ])
      .then(([fo, co]) => {
        if (cancelled) return;
        if (fo) setFilterOptions(fo as SourceFilterOptions);
        const cols = co as { columns: ColumnDef[] } | null;
        if (cols?.columns?.length) {
          setVisibleColumns(cols.columns);
          setSelectedColumns(prev => prev.filter(k => cols.columns.some(c => c.key === k)));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFiltersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSourceId, bootstrapById]);

  useEffect(() => {
    setManualSort({ col: null, dir: null });
  }, [selectedSourceId, selectedColumns.join('|'), groupBy.join('|')]);

  const fetchReport = useCallback(async (
    nextPage: number,
    nextPageSize: number,
    nextFilters: Record<string, string[]>,
    nextDateFrom: string,
    nextDateTo: string,
    columns: string[],
    nextGroupBy: string[],
    sourceId: string,
    overrides?: Partial<{ sort: ManualSortState; includeContractCount: boolean }>,
  ) => {
    if (columns.length === 0) {
      setManualError('Выберите хотя бы одну колонку');
      return;
    }

    setLoading(true);
    setManualError(null);

    const sortState = overrides?.sort ?? manualSort;
    const includeContractCountFlag = overrides?.includeContractCount ?? showContractCount;
    const payload: Record<string, unknown> = {
      sourceId,
      columns,
      filters: nextFilters,
      dateFrom: nextDateFrom || undefined,
      dateTo: nextDateTo || undefined,
      groupBy: nextGroupBy,
      page: nextPage,
      pageSize: nextPageSize,
    };
    if (nextGroupBy.length > 0 && !includeContractCountFlag) {
      payload.includeContractCount = false;
    }
    if (sortState.col && sortState.dir) {
      payload.sortColumn = sortState.col;
      payload.sortDirection = sortState.dir;
    }

    try {
      const res = await fetch(`${BASE_PATH}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка сервера');
      setResult(await res.json());
      setHasSearched(true);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [manualSort, showContractCount]);

  const handleServerSort = useCallback(
    (key: string) => {
      if (selectedColumns.length === 0 || !hasSearched) return;
      let next: ManualSortState = { col: null, dir: null };
      setManualSort(prev => {
        if (prev.col !== key) next = { col: key, dir: 'asc' };
        else if (prev.dir === 'asc') next = { col: key, dir: 'desc' };
        else if (prev.dir === 'desc') next = { col: null, dir: null };
        else next = { col: key, dir: 'asc' };
        return next;
      });
      setPage(1);
      void fetchReport(1, pageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId, {
        sort: next,
      });
    },
    [
      hasSearched,
      pageSize,
      genericFilters,
      dateFrom,
      dateTo,
      selectedColumns,
      groupBy,
      selectedSourceId,
      fetchReport,
    ],
  );

  const handleSubmit = () => {
    setPage(1);
    void fetchReport(1, pageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    void fetchReport(nextPage, pageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
    void fetchReport(1, nextPageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId);
  };

  async function handleExportManual() {
    setExporting(true);
    setManualError(null);
    try {
      const exportPayload: Record<string, unknown> = {
        sourceId: selectedSourceId,
        columns: selectedColumns,
        filters: genericFilters,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        groupBy,
      };
      if (groupBy.length > 0 && !showContractCount) {
        exportPayload.includeContractCount = false;
      }
      if (manualSort.col && manualSort.dir) {
        exportPayload.sortColumn = manualSort.col;
        exportPayload.sortDirection = manualSort.dir;
      }
      const res = await fetch(`${BASE_PATH}/api/report/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportPayload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка экспорта');
      const url = URL.createObjectURL(await res.blob());
      const anchor = Object.assign(document.createElement('a'), {
        href: url,
        download: `report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setExporting(false);
    }
  }

  // All visible columns marked groupable — not limited to current selection.
  // Picking a group-by column auto-adds it to the column selection.
  const availableGroupByColumns = visibleColumns.filter(c => c.groupable === true);

  // Table column definitions: in grouped mode show dimensions + measures + count
  const tableColumns = groupBy.length > 0
    ? [
        ...selectedColumns
          .filter(k => groupBy.includes(k))
          .map(k => visibleColumns.find(c => c.key === k))
          .filter((c): c is ColumnDef => c != null)
          .map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer })),
        ...selectedColumns
          .filter(k => !groupBy.includes(k))
          .map(k => visibleColumns.find(c => c.key === k))
          .filter((c): c is ColumnDef => c != null && c.type === 'number')
          .map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer })),
        ...(showContractCount
          ? [{ key: CONTRACT_COUNT_COLUMN_KEY, label: 'Кол-во договоров', type: 'number' as const, integer: true }]
          : []),
      ]
    : selectedColumns
        .map(key => visibleColumns.find(column => column.key === key))
        .filter((c): c is ColumnDef => c != null)
        .map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer }));

  const headerActions = hasSearched && result ? (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="hidden sm:flex">
      <ExportButton loading={exporting} onClick={handleExportManual} />
    </motion.div>
  ) : null;

  return (
    <ReportsChrome
      onCreateReport={() => {
        setHasSearched(false);
        setResult(null);
        setManualError(null);
        setPage(1);
      }}
      headerActions={headerActions}
    >
      <motion.div {...fadeSlide} className="flex flex-col gap-5">
        <header>
          <h1 className="mb-2 font-headline text-3xl font-bold tracking-tight text-on-surface">
            Ручной отчёт
          </h1>
          <p className="max-w-2xl leading-7 text-on-surface-variant">
            Выберите фильтры и колонки — таблица сформируется по правилам ручного конструктора.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          {sources.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-on-surface-variant">Источник:</span>
              <select
                value={selectedSourceId}
                onChange={e => setSelectedSourceId(e.target.value)}
                className="ui-field rounded-xl px-3 py-2 text-sm"
              >
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <GenericReportFilters
            filterDefs={filterOptions.filterDefs}
            options={filterOptions.options}
            values={genericFilters}
            dateFilterCol={filterOptions.dateFilterCol}
            dateFrom={dateFrom}
            dateTo={dateTo}
            loading={loading}
            filtersLoading={filtersLoading}
            onFiltersChange={setGenericFilters}
            onDateChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onSubmit={handleSubmit}
          />
          <ColumnSelector
            selected={selectedColumns}
            onChange={(cols) => {
              setSelectedColumns(cols);
              setGroupBy(prev => prev.filter(k => cols.includes(k)));
            }}
            columns={visibleColumns}
            groupByActive={groupBy.length > 0}
            showContractCount={showContractCount}
            onShowContractCountChange={v => {
              const needClearSort = !v && manualSort.col === CONTRACT_COUNT_COLUMN_KEY;
              const nextSort = needClearSort ? { col: null, dir: null } : manualSort;
              setShowContractCount(v);
              if (needClearSort) setManualSort({ col: null, dir: null });
              if (hasSearched && selectedColumns.length > 0 && groupBy.length > 0) {
                setPage(1);
                void fetchReport(1, pageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId, {
                  includeContractCount: v,
                  sort: nextSort,
                });
              }
            }}
          />
          <GroupBySelector
            groupBy={groupBy}
            onChange={(newGroupBy) => {
              // Auto-add newly picked groupBy columns to column selection
              setSelectedColumns(prev => {
                const missing = newGroupBy.filter(k => !prev.includes(k));
                return missing.length > 0 ? [...prev, ...missing] : prev;
              });
              setGroupBy(newGroupBy);
            }}
            availableColumns={availableGroupByColumns}
          />
        </div>

        <AnimatePresence>
          {manualError ? (
            <motion.div {...fadeSlide}>
              <InlineError message={manualError} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {hasSearched || loading ? (
          <UnifiedReportTable
            data={result?.data ?? []}
            columns={tableColumns}
            total={result?.total ?? 0}
            page={page}
            pageSize={pageSize}
            loading={loading}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            mode="server"
            serverSortColumn={manualSort.col}
            serverSortDirection={manualSort.dir}
            onServerSortClick={handleServerSort}
          />
        ) : null}

        {!hasSearched && !loading ? (
          <EmptyState
            title="Настройте фильтры и нажмите «Сформировать отчёт»"
            subtitle="Выберите агентов, регионы, даты и другие параметры"
          />
        ) : null}

        {hasSearched && result ? (
          <div className="flex justify-end pb-4 sm:hidden">
            <ExportButton loading={exporting} onClick={handleExportManual} />
          </div>
        ) : null}
      </motion.div>
    </ReportsChrome>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-error">
      {message}
    </div>
  );
}

function ExportButton({ loading, onClick }: { loading: boolean; onClick: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={loading}
      className="ui-button-secondary flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <FileSpreadsheet className="h-4 w-4 text-primary" strokeWidth={2.1} />
      {loading ? 'Экспорт…' : 'Excel'}
    </button>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      {...fadeSlide}
      className="ui-panel-muted rounded-2xl border border-dashed border-outline-variant/30 p-8 text-left sm:p-10"
    >
      <FileText className="mb-4 block h-10 w-10 text-on-surface-variant/40" strokeWidth={1.8} />
      <p className="text-sm font-medium text-on-surface">{title}</p>
      <p className="mt-2 text-xs text-on-surface-variant">{subtitle}</p>
    </motion.div>
  );
}
