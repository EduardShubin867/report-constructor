'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ColumnSelector from '@/components/ColumnSelector';
import GroupBySelector from '@/components/GroupBySelector';
import GenericReportFilters from '@/components/GenericReportFilters';
import ReportsChrome from '@/components/ReportsChrome';
import UnifiedReportTable from '@/components/UnifiedReportTable';
import { CONTRACT_COUNT_COLUMN_KEY, type ColumnDef } from '@/lib/report-columns';
import type { FilterDef, ManualReportSourcePayload, SourceFilterOptions } from '@/lib/report-filters-data';
import { BASE_PATH } from '@/lib/constants';

type ManualSortState = { col: string | null; dir: 'asc' | 'desc' | null };

/** Снимок последнего успешного запроса: таблица и пагинация не следуют за черновиком формы. */
type AppliedReportSnapshot = {
  columns: string[];
  groupBy: string[];
  filters: Record<string, string[]>;
  dateFrom: string;
  dateTo: string;
  showContractCount: boolean;
  sort: ManualSortState;
};

function cloneFilters(f: Record<string, string[]>): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const k of Object.keys(f)) o[k] = [...(f[k] ?? [])];
  return o;
}

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
  groupByColumns: [],
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

function normalizeFilterOptions(fo: SourceFilterOptions): SourceFilterOptions {
  return {
    ...fo,
    filterDefs: fo.filterDefs.map((fd: FilterDef & { tier?: 'primary' | 'secondary' }) => ({
      ...fd,
      tier: fd.tier ?? 'primary',
    })),
  };
}

function fallbackGroupByColumns(columns: ColumnDef[]): ColumnDef[] {
  return columns.filter(c => c.type === 'string' || c.type === 'date' || c.type === 'boolean');
}

function mergeGroupByColumnsPayload(boot: ManualReportSourcePayload): ColumnDef[] {
  if (boot.groupByColumns !== undefined) return boot.groupByColumns;
  return fallbackGroupByColumns(boot.columns);
}

export default function ManualReportRoute({
  initialSourceId = '',
  sources = [],
  initialBootstrapBySourceId,
}: ManualReportRouteProps) {
  const bootstrapById = coerceBootstrapMap(initialBootstrapBySourceId);
  const boot0 = bootstrapById[initialSourceId] ?? emptyBootstrap;
  const [selectedSourceId, setSelectedSourceId] = useState(initialSourceId);
  const [filterOptions, setFilterOptions] = useState<SourceFilterOptions>(() =>
    normalizeFilterOptions(boot0.filterOptions),
  );
  const [genericFilters, setGenericFilters] = useState<Record<string, string[]>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersLoading, setFiltersLoading] = useState(boot0.filterError);
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef[]>(boot0.columns);
  const [groupByColumns, setGroupByColumns] = useState<ColumnDef[]>(() =>
    mergeGroupByColumnsPayload(boot0),
  );
  const [manualError, setManualError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [showContractCount, setShowContractCount] = useState(true);
  const [manualSort, setManualSort] = useState<ManualSortState>({ col: null, dir: null });
  const [result, setResult] = useState<ReportResult | null>(null);
  /** После успешного запроса: колонки/фильтры для таблицы и пагинации (черновик формы отдельно). */
  const [appliedSnapshot, setAppliedSnapshot] = useState<AppliedReportSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [lazyFilterOptions, setLazyFilterOptions] = useState<Record<string, string[]>>({});
  const [lazyFilterLoading, setLazyFilterLoading] = useState<Record<string, boolean>>({});
  const lazyFilterLoadedRef = useRef<Set<string>>(new Set());

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
    setAppliedSnapshot(null);
    setHasSearched(false);
    setPage(1);
    const p = bootstrapById[selectedSourceId];
    if (p) {
      setVisibleColumns(p.columns);
      setGroupByColumns(mergeGroupByColumnsPayload(p));
      setFilterOptions(normalizeFilterOptions(p.filterOptions));
      setSelectedColumns(prev => prev.filter(k => p.columns.some(c => c.key === k)));
      setFiltersLoading(p.filterError);
    } else {
      setFiltersLoading(true);
      setVisibleColumns([]);
      setGroupByColumns([]);
      setFilterOptions(normalizeFilterOptions({ filterDefs: [], options: {}, dateFilterCol: null }));
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
      setGroupByColumns(mergeGroupByColumnsPayload(boot));
      setFilterOptions(normalizeFilterOptions(boot.filterOptions));
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
        if (fo) setFilterOptions(normalizeFilterOptions(fo as SourceFilterOptions));
        const cols = co as { columns: ColumnDef[]; groupByColumns?: ColumnDef[] } | null;
        if (cols?.columns?.length) {
          setVisibleColumns(cols.columns);
          setGroupByColumns(
            cols.groupByColumns?.length
              ? cols.groupByColumns
              : fallbackGroupByColumns(cols.columns),
          );
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
    lazyFilterLoadedRef.current.clear();
    setLazyFilterOptions({});
    setLazyFilterLoading({});
  }, [selectedSourceId, filterOptions.filterDefs.map(f => `${f.key}:${f.tier}`).join('|')]);

  const mergedFilterOptions = useMemo(
    () => ({ ...filterOptions.options, ...lazyFilterOptions }),
    [filterOptions.options, lazyFilterOptions],
  );

  const serverSortForTable =
    appliedSnapshot !== null && hasSearched ? appliedSnapshot.sort : manualSort;

  const tableColumns = useMemo(() => {
    const activeSpec = appliedSnapshot !== null && hasSearched ? appliedSnapshot : null;
    const colKeys = activeSpec?.columns ?? selectedColumns;
    const gb = activeSpec?.groupBy ?? groupBy;
    const showCnt = activeSpec?.showContractCount ?? showContractCount;

    const resolve = (key: string) =>
      visibleColumns.find(c => c.key === key) ?? groupByColumns.find(c => c.key === key);

    if (gb.length > 0) {
      return [
        ...colKeys
          .filter(k => gb.includes(k))
          .map(k => resolve(k))
          .filter((c): c is ColumnDef => c != null)
          .map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer })),
        ...colKeys
          .filter(k => !gb.includes(k))
          .map(k => visibleColumns.find(c => c.key === k))
          .filter((c): c is ColumnDef => c != null && c.type === 'number')
          .map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer })),
        ...(showCnt
          ? [{ key: CONTRACT_COUNT_COLUMN_KEY, label: 'Кол-во договоров', type: 'number' as const, integer: true }]
          : []),
      ];
    }
    return colKeys
      .map(key => visibleColumns.find(column => column.key === key))
      .filter((c): c is ColumnDef => c != null)
      .map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer }));
  }, [
    appliedSnapshot,
    hasSearched,
    selectedColumns,
    groupBy,
    showContractCount,
    visibleColumns,
    groupByColumns,
  ]);

  const onLazyFilterOpen = useCallback(
    async (key: string) => {
      const fd = filterOptions.filterDefs.find(f => f.key === key);
      if (!fd || fd.tier !== 'secondary') return;
      if (lazyFilterLoadedRef.current.has(key)) return;
      lazyFilterLoadedRef.current.add(key);
      setLazyFilterLoading(prev => ({ ...prev, [key]: true }));
      try {
        const r = await fetch(
          `${BASE_PATH}/api/report/filter-options?sourceId=${encodeURIComponent(selectedSourceId)}&key=${encodeURIComponent(key)}`,
        );
        const data = (await r.json()) as { values?: string[] };
        if (r.ok && Array.isArray(data.values)) {
          const vals = data.values;
          setLazyFilterOptions(prev => ({ ...prev, [key]: vals }));
        } else {
          lazyFilterLoadedRef.current.delete(key);
        }
      } catch {
        lazyFilterLoadedRef.current.delete(key);
      } finally {
        setLazyFilterLoading(prev => ({ ...prev, [key]: false }));
      }
    },
    [filterOptions.filterDefs, selectedSourceId],
  );

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
      const json = (await res.json()) as ReportResult;
      setResult(json);
      setHasSearched(true);
      setAppliedSnapshot({
        columns: [...columns],
        groupBy: [...nextGroupBy],
        filters: cloneFilters(nextFilters),
        dateFrom: nextDateFrom,
        dateTo: nextDateTo,
        showContractCount: includeContractCountFlag,
        sort: { col: sortState.col, dir: sortState.dir },
      });
      setManualSort({ col: sortState.col, dir: sortState.dir });
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [manualSort, showContractCount]);

  const handleServerSort = useCallback(
    (key: string) => {
      if (!hasSearched) return;
      const snap = appliedSnapshot;
      if (!snap || snap.columns.length === 0) return;
      const basis = snap.sort;
      let next: ManualSortState;
      if (basis.col !== key) next = { col: key, dir: 'asc' };
      else if (basis.dir === 'asc') next = { col: key, dir: 'desc' };
      else if (basis.dir === 'desc') next = { col: null, dir: null };
      else next = { col: key, dir: 'asc' };
      setManualSort(next);
      setPage(1);
      void fetchReport(1, pageSize, snap.filters, snap.dateFrom, snap.dateTo, snap.columns, snap.groupBy, selectedSourceId, {
        sort: next,
        includeContractCount: snap.showContractCount,
      });
    },
    [appliedSnapshot, hasSearched, pageSize, selectedSourceId, fetchReport],
  );

  const handleSubmit = () => {
    setPage(1);
    void fetchReport(1, pageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId);
  };

  const handlePageChange = (nextPage: number) => {
    const snap = appliedSnapshot;
    setPage(nextPage);
    if (snap) {
      void fetchReport(nextPage, pageSize, snap.filters, snap.dateFrom, snap.dateTo, snap.columns, snap.groupBy, selectedSourceId, {
        sort: snap.sort,
        includeContractCount: snap.showContractCount,
      });
    } else {
      void fetchReport(nextPage, pageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId);
    }
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    const snap = appliedSnapshot;
    setPageSize(nextPageSize);
    setPage(1);
    if (snap) {
      void fetchReport(1, nextPageSize, snap.filters, snap.dateFrom, snap.dateTo, snap.columns, snap.groupBy, selectedSourceId, {
        sort: snap.sort,
        includeContractCount: snap.showContractCount,
      });
    } else {
      void fetchReport(1, nextPageSize, genericFilters, dateFrom, dateTo, selectedColumns, groupBy, selectedSourceId);
    }
  };

  async function handleExportManual() {
    setExporting(true);
    setManualError(null);
    try {
      const snap = appliedSnapshot;
      const cols = snap?.columns ?? selectedColumns;
      const gb = snap?.groupBy ?? groupBy;
      const flt = snap?.filters ?? genericFilters;
      const dFrom = snap?.dateFrom ?? dateFrom;
      const dTo = snap?.dateTo ?? dateTo;
      const showCnt = snap?.showContractCount ?? showContractCount;
      const sort = snap?.sort ?? manualSort;

      const exportPayload: Record<string, unknown> = {
        sourceId: selectedSourceId,
        columns: cols,
        filters: flt,
        dateFrom: dFrom || undefined,
        dateTo: dTo || undefined,
        groupBy: gb,
      };
      if (gb.length > 0 && !showCnt) {
        exportPayload.includeContractCount = false;
      }
      if (sort.col && sort.dir) {
        exportPayload.sortColumn = sort.col;
        exportPayload.sortDirection = sort.dir;
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
        setAppliedSnapshot(null);
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
            options={mergedFilterOptions}
            values={genericFilters}
            dateFilterCol={filterOptions.dateFilterCol}
            dateFrom={dateFrom}
            dateTo={dateTo}
            loading={loading}
            filtersLoading={filtersLoading}
            onLazyFilterOpen={onLazyFilterOpen}
            lazyFilterLoading={lazyFilterLoading}
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
              setShowContractCount(v);
              const snap = appliedSnapshot;
              if (!hasSearched || !snap || snap.groupBy.length === 0) return;
              const prevSort = snap.sort;
              const nextSort =
                !v && prevSort.col === CONTRACT_COUNT_COLUMN_KEY ? { col: null, dir: null } : prevSort;
              setManualSort(nextSort);
              setPage(1);
              void fetchReport(1, pageSize, snap.filters, snap.dateFrom, snap.dateTo, snap.columns, snap.groupBy, selectedSourceId, {
                includeContractCount: v,
                sort: nextSort,
              });
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
            availableColumns={groupByColumns}
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
            serverSortColumn={serverSortForTable.col}
            serverSortDirection={serverSortForTable.dir}
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
