import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CONTRACT_COUNT_COLUMN_KEY, type ColumnDef } from '@/lib/report-columns';
import type { AggregationFn } from '@/lib/query-builder';
import type { SourceFilterOptions } from '@/lib/report-filters-data';
import { BASE_PATH } from '@/lib/constants';

import { AGG_LABELS, emptyBootstrap, initialManualSort, SOURCE_QUERY_PARAM } from './constants';
import type { AppliedReportSnapshot, ManualReportRouteProps, ManualSortState, ReportResult } from './types';
import {
  cloneFilters,
  coerceBootstrapMap,
  fallbackGroupByColumns,
  mergeGroupByColumnsPayload,
  normalizeFilterOptions,
} from './utils';

export function useManualReportRoute({
  initialSourceId = '',
  sources = [],
  initialBootstrapBySourceId,
}: ManualReportRouteProps) {
  const searchParams = useSearchParams();
  const bootstrapById = coerceBootstrapMap(initialBootstrapBySourceId);
  const defaultSourceId = sources[0]?.id ?? '';
  const normalizedInitialSourceId = sources.some(s => s.id === initialSourceId) ? initialSourceId : defaultSourceId;
  const boot0 = bootstrapById[normalizedInitialSourceId] ?? emptyBootstrap;

  const [selectedSourceId, setSelectedSourceId] = useState(normalizedInitialSourceId);
  const [filterOptions, setFilterOptions] = useState<SourceFilterOptions>(() => normalizeFilterOptions(boot0.filterOptions));
  const [genericFilters, setGenericFilters] = useState<Record<string, string[]>>({});
  const [periodFilters, setPeriodFilters] = useState<Record<string, { from: string; to: string }>>({});
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef[]>(boot0.columns);
  const [groupByColumns, setGroupByColumns] = useState<ColumnDef[]>(() => mergeGroupByColumnsPayload(boot0));

  const [manualError, setManualError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [showContractCount, setShowContractCount] = useState(true);
  const [columnAggregations, setColumnAggregations] = useState<Record<string, AggregationFn>>({});
  const [manualSort, setManualSort] = useState<ManualSortState>(initialManualSort);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [appliedSnapshot, setAppliedSnapshot] = useState<AppliedReportSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [lazyFilterOptions, setLazyFilterOptions] = useState<Record<string, string[]>>({});
  const [lazyFilterLoading, setLazyFilterLoading] = useState<Record<string, boolean>>({});

  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);

  const [columnSearch, setColumnSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['__main']));
  const [filtersBlockOpen, setFiltersBlockOpen] = useState(true);
  const [groupingBlockOpen, setGroupingBlockOpen] = useState(true);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const lazyFilterLoadedRef = useRef<Set<string>>(new Set());
  const isFirstSourceChange = useRef(true);
  const lastInitialSourceIdRef = useRef(normalizedInitialSourceId);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectedSource = useMemo(() => sources.find(s => s.id === selectedSourceId) ?? null, [sources, selectedSourceId]);

  const activeFilterCount = useMemo(
    () =>
      filterOptions.filterDefs.filter(fd => (genericFilters[fd.key]?.length ?? 0) > 0).length +
      Object.values(periodFilters).filter(p => p.from || p.to).length,
    [periodFilters, filterOptions.filterDefs, genericFilters],
  );

  const canSubmitDraft = selectedColumns.length > 0 && !loading;

  const filterDefsSignature = useMemo(
    () => filterOptions.filterDefs.map(f => `${f.key}:${f.tier}`).join('|'),
    [filterOptions.filterDefs],
  );

  const columnGroups = useMemo(() => {
    const mainCols = visibleColumns.filter(c => !c.joinKey);
    const fkMap = new Map<string, { name: string; cols: ColumnDef[] }>();
    for (const col of visibleColumns) {
      if (!col.joinKey) continue;
      const name = col.groupLabel ?? col.joinKey.toUpperCase();
      if (!fkMap.has(col.joinKey)) fkMap.set(col.joinKey, { name, cols: [] });
      fkMap.get(col.joinKey)!.cols.push(col);
    }
    const groups: { id: string; name: string; columns: ColumnDef[] }[] = [];
    if (mainCols.length > 0) groups.push({ id: '__main', name: 'Основная таблица', columns: mainCols });
    for (const [id, { name, cols }] of fkMap) groups.push({ id, name, columns: cols });
    return groups;
  }, [visibleColumns]);

  useEffect(() => {
    if (selectedSourceId && sources.some(source => source.id === selectedSourceId)) return;
    if (!selectedSourceId && !defaultSourceId) return;
    setSelectedSourceId(defaultSourceId);
  }, [defaultSourceId, selectedSourceId, sources]);

  useEffect(() => {
    if (lastInitialSourceIdRef.current === normalizedInitialSourceId) return;
    lastInitialSourceIdRef.current = normalizedInitialSourceId;
    setSelectedSourceId(normalizedInitialSourceId);
  }, [normalizedInitialSourceId]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentPath = window.location.pathname;
    if (selectedSourceId && selectedSourceId !== defaultSourceId) {
      params.set(SOURCE_QUERY_PARAM, selectedSourceId);
    } else {
      params.delete(SOURCE_QUERY_PARAM);
    }
    const nextUrl = params.toString() ? `${currentPath}?${params.toString()}` : currentPath;
    const currentUrl = searchParams.toString() ? `${currentPath}?${searchParams.toString()}` : currentPath;
    if (nextUrl !== currentUrl) window.history.replaceState(null, '', nextUrl);
  }, [defaultSourceId, searchParams, selectedSourceId]);

  useEffect(() => {
    if (isFirstSourceChange.current) { isFirstSourceChange.current = false; return; }
    setGenericFilters({});
    setPeriodFilters({});
    setGroupBy([]);
    setShowContractCount(true);
    setManualSort({ col: null, dir: null });
    setResult(null);
    setAppliedSnapshot(null);
    setHasSearched(false);
    setPage(1);
    setColumnSearch('');
    setOpenGroups(new Set(['__main']));
    setPreviewData(null);
    setPreviewTotal(null);
    setColumnAggregations({});
    const p = bootstrapById[selectedSourceId];
    if (p) {
      setVisibleColumns(p.columns);
      setGroupByColumns(mergeGroupByColumnsPayload(p));
      setFilterOptions(normalizeFilterOptions(p.filterOptions));
      setSelectedColumns(prev => prev.filter(k => p.columns.some(c => c.key === k)));
      setFiltersLoading(false);
    } else {
      setFiltersLoading(true);
      setVisibleColumns([]);
      setGroupByColumns([]);
      setFilterOptions(normalizeFilterOptions({ filterDefs: [], options: {}, periodFilterCols: [] }));
      setSelectedColumns([]);
    }
  }, [selectedSourceId, bootstrapById]);

  useEffect(() => {
    const boot = bootstrapById[selectedSourceId];
    if (boot && boot.columns.length > 0) {
      setVisibleColumns(boot.columns);
      setGroupByColumns(mergeGroupByColumnsPayload(boot));
      setFilterOptions(normalizeFilterOptions(boot.filterOptions));
      setFiltersLoading(false);
      setSelectedColumns(prev => prev.filter(k => boot.columns.some(c => c.key === k)));
      return;
    }
    let cancelled = false;
    setFiltersLoading(true);
    const needFilters = !boot;
    const needCols = !boot || boot.columns.length === 0;
    void Promise.all([
      needFilters ? fetch(`${BASE_PATH}/api/report/filters?sourceId=${selectedSourceId}`).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
      needCols ? fetch(`${BASE_PATH}/api/report/columns?sourceId=${selectedSourceId}`).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
    ]).then(([fo, co]) => {
      if (cancelled) return;
      if (fo) setFilterOptions(normalizeFilterOptions(fo as SourceFilterOptions));
      const cols = co as { columns: ColumnDef[]; groupByColumns?: ColumnDef[] } | null;
      if (cols?.columns?.length) {
        setVisibleColumns(cols.columns);
        setGroupByColumns(cols.groupByColumns?.length ? cols.groupByColumns : fallbackGroupByColumns(cols.columns));
        setSelectedColumns(prev => prev.filter(k => cols.columns.some(c => c.key === k)));
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setFiltersLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSourceId, bootstrapById]);

  useEffect(() => {
    lazyFilterLoadedRef.current.clear();
    setLazyFilterOptions({});
    setLazyFilterLoading({});
  }, [selectedSourceId, filterDefsSignature]);

  const mergedFilterOptions = useMemo(
    () => ({ ...filterOptions.options, ...lazyFilterOptions }),
    [filterOptions.options, lazyFilterOptions],
  );

  const serverSortForTable = appliedSnapshot !== null && hasSearched ? appliedSnapshot.sort : manualSort;

  const tableColumns = useMemo(() => {
    const activeSpec = appliedSnapshot !== null && hasSearched ? appliedSnapshot : null;
    const colKeys = activeSpec?.columns ?? selectedColumns;
    const gb = activeSpec?.groupBy ?? groupBy;
    const showCnt = activeSpec?.showContractCount ?? showContractCount;
    const resolve = (key: string) => visibleColumns.find(c => c.key === key) ?? groupByColumns.find(c => c.key === key);
    if (gb.length > 0) {
      return [
        ...colKeys.filter(k => gb.includes(k)).map(k => resolve(k)).filter((c): c is ColumnDef => c != null).map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer })),
        ...colKeys.filter(k => !gb.includes(k)).map(k => visibleColumns.find(c => c.key === k)).filter((c): c is ColumnDef => c != null && c.type === 'number').map(c => ({ key: c.key, label: `${c.label}, ${AGG_LABELS[columnAggregations[c.key] ?? 'sum']}`, type: c.type, integer: c.integer })),
        ...(showCnt ? [{ key: CONTRACT_COUNT_COLUMN_KEY, label: 'Кол-во договоров', type: 'number' as const, integer: true }] : []),
      ];
    }
    return colKeys.map(key => visibleColumns.find(c => c.key === key)).filter((c): c is ColumnDef => c != null).map(c => ({ key: c.key, label: c.label, type: c.type, integer: c.integer }));
  }, [appliedSnapshot, hasSearched, selectedColumns, groupBy, showContractCount, visibleColumns, groupByColumns, columnAggregations]);

  const onLazyFilterOpen = useCallback(async (key: string) => {
    const fd = filterOptions.filterDefs.find(f => f.key === key);
    if (!fd || lazyFilterLoadedRef.current.has(key) || lazyFilterLoading[key]) return;
    lazyFilterLoadedRef.current.add(key);
    setLazyFilterLoading(prev => ({ ...prev, [key]: true }));
    try {
      const r = await fetch(`${BASE_PATH}/api/report/filter-options?sourceId=${encodeURIComponent(selectedSourceId)}&key=${encodeURIComponent(key)}`);
      const data = (await r.json()) as { values?: string[] };
      if (r.ok && Array.isArray(data.values)) {
        setLazyFilterOptions(prev => ({ ...prev, [key]: data.values! }));
      } else {
        lazyFilterLoadedRef.current.delete(key);
      }
    } catch {
      lazyFilterLoadedRef.current.delete(key);
    } finally {
      setLazyFilterLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [filterOptions.filterDefs, lazyFilterLoading, selectedSourceId]);

  useEffect(() => {
    if (selectedColumns.length === 0) {
      previewAbortRef.current?.abort();
      setPreviewData(null);
      setPreviewTotal(null);
      setPreviewLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      previewAbortRef.current?.abort();
      const ctrl = new AbortController();
      previewAbortRef.current = ctrl;
      setPreviewLoading(true);
      try {
        const activePf = Object.fromEntries(
          Object.entries(periodFilters).filter(([, p]) => p.from || p.to),
        );
        const payload: Record<string, unknown> = {
          sourceId: selectedSourceId,
          columns: selectedColumns,
          filters: genericFilters,
          periodFilters: Object.keys(activePf).length > 0 ? activePf : undefined,
          groupBy,
          page: 1,
          pageSize: 5,
          preview: true,
        };
        if (groupBy.length > 0 && !showContractCount) payload.includeContractCount = false;
        if (groupBy.length > 0 && Object.keys(columnAggregations).length > 0) payload.columnAggregations = columnAggregations;
        const res = await fetch(`${BASE_PATH}/api/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) { setPreviewData(null); setPreviewTotal(null); return; }
        const json = (await res.json()) as ReportResult;
        setPreviewData(json.data);
        setPreviewTotal(json.total);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setPreviewData(null); setPreviewTotal(null); }
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumns, genericFilters, periodFilters, groupBy, showContractCount, selectedSourceId]);

  const fetchReport = useCallback(async (
    nextPage: number,
    nextPageSize: number,
    nextFilters: Record<string, string[]>,
    nextPeriodFilters: Record<string, { from: string; to: string }>,
    columns: string[],
    nextGroupBy: string[],
    sourceId: string,
    overrides?: Partial<{ sort: ManualSortState; includeContractCount: boolean }>,
  ) => {
    if (columns.length === 0) { setManualError('Выберите хотя бы одну колонку'); return; }
    setLoading(true);
    setManualError(null);
    const sortState = overrides?.sort ?? manualSort;
    const includeContractCountFlag = overrides?.includeContractCount ?? showContractCount;
    const activePeriodFilters = Object.fromEntries(Object.entries(nextPeriodFilters).filter(([, p]) => p.from || p.to));
    const payload: Record<string, unknown> = {
      sourceId,
      columns,
      filters: nextFilters,
      periodFilters: Object.keys(activePeriodFilters).length > 0 ? activePeriodFilters : undefined,
      groupBy: nextGroupBy,
      page: nextPage,
      pageSize: nextPageSize,
    };
    if (nextGroupBy.length > 0 && !includeContractCountFlag) payload.includeContractCount = false;
    if (nextGroupBy.length > 0 && Object.keys(columnAggregations).length > 0) payload.columnAggregations = columnAggregations;
    if (sortState.col && sortState.dir) { payload.sortColumn = sortState.col; payload.sortDirection = sortState.dir; }
    try {
      const res = await fetch(`${BASE_PATH}/api/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка сервера');
      const json = (await res.json()) as ReportResult;
      setResult(json);
      setHasSearched(true);
      setAppliedSnapshot({ columns: [...columns], groupBy: [...nextGroupBy], filters: cloneFilters(nextFilters), periodFilters: { ...nextPeriodFilters }, showContractCount: includeContractCountFlag, sort: { col: sortState.col, dir: sortState.dir } });
      setManualSort({ col: sortState.col, dir: sortState.dir });
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [manualSort, showContractCount, columnAggregations]);

  const handleServerSort = useCallback((key: string) => {
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
    void fetchReport(1, pageSize, snap.filters, snap.periodFilters, snap.columns, snap.groupBy, selectedSourceId, { sort: next, includeContractCount: snap.showContractCount });
  }, [appliedSnapshot, hasSearched, pageSize, selectedSourceId, fetchReport]);

  const handleSubmit = useCallback(() => {
    setPage(1);
    void fetchReport(1, pageSize, genericFilters, periodFilters, selectedColumns, groupBy, selectedSourceId);
  }, [periodFilters, fetchReport, genericFilters, groupBy, pageSize, selectedColumns, selectedSourceId]);

  const handlePageChange = (nextPage: number) => {
    const snap = appliedSnapshot;
    setPage(nextPage);
    if (snap) void fetchReport(nextPage, pageSize, snap.filters, snap.periodFilters, snap.columns, snap.groupBy, selectedSourceId, { sort: snap.sort, includeContractCount: snap.showContractCount });
    else void fetchReport(nextPage, pageSize, genericFilters, periodFilters, selectedColumns, groupBy, selectedSourceId);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    const snap = appliedSnapshot;
    setPageSize(nextPageSize);
    setPage(1);
    if (snap) void fetchReport(1, nextPageSize, snap.filters, snap.periodFilters, snap.columns, snap.groupBy, selectedSourceId, { sort: snap.sort, includeContractCount: snap.showContractCount });
    else void fetchReport(1, nextPageSize, genericFilters, periodFilters, selectedColumns, groupBy, selectedSourceId);
  };

  async function handleExportManual() {
    setExporting(true);
    setManualError(null);
    try {
      const snap = appliedSnapshot;
      const cols = snap?.columns ?? selectedColumns;
      const gb = snap?.groupBy ?? groupBy;
      const flt = snap?.filters ?? genericFilters;
      const pf = snap?.periodFilters ?? periodFilters;
      const showCnt = snap?.showContractCount ?? showContractCount;
      const sort = snap?.sort ?? manualSort;
      const activePf = Object.fromEntries(Object.entries(pf).filter(([, p]) => p.from || p.to));
      const exportPayload: Record<string, unknown> = { sourceId: selectedSourceId, columns: cols, filters: flt, periodFilters: Object.keys(activePf).length > 0 ? activePf : undefined, groupBy: gb };
      if (gb.length > 0 && !showCnt) exportPayload.includeContractCount = false;
      if (gb.length > 0 && Object.keys(columnAggregations).length > 0) exportPayload.columnAggregations = columnAggregations;
      if (sort.col && sort.dir) { exportPayload.sortColumn = sort.col; exportPayload.sortDirection = sort.dir; }
      const res = await fetch(`${BASE_PATH}/api/report/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exportPayload) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка экспорта');
      const url = URL.createObjectURL(await res.blob());
      const anchor = Object.assign(document.createElement('a'), { href: url, download: `report_${new Date().toISOString().slice(0, 10)}.xlsx` });
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

  function removeColumn(key: string) {
    setSelectedColumns(prev => prev.filter(k => k !== key));
    setGroupBy(prev => prev.filter(k => k !== key));
  }

  const onCreateReport = useCallback(() => {
    setHasSearched(false);
    setResult(null);
    setAppliedSnapshot(null);
    setManualError(null);
    setPage(1);
    setSelectedColumns([]);
    setGroupBy([]);
    setGenericFilters({});
    setPeriodFilters({});
    setPreviewData(null);
    setPreviewTotal(null);
    setColumnAggregations({});
  }, []);

  return {
    onCreateReport,
    selectedSource,
    visibleColumns,
    groupByColumns,
    columnSearch,
    setColumnSearch,
    columnGroups,
    filtersLoading,
    openGroups,
    setOpenGroups,
    selectedColumns,
    setSelectedColumns,
    sources,
    selectedSourceId,
    setSelectedSourceId,
    removeColumn,
    activeFilterCount,
    groupBy,
    setGroupBy,
    showContractCount,
    setShowContractCount,
    columnAggregations,
    setColumnAggregations,
    manualError,
    filterOptions,
    mergedFilterOptions,
    genericFilters,
    setGenericFilters,
    periodFilters,
    setPeriodFilters,
    onLazyFilterOpen,
    lazyFilterLoading,
    filtersBlockOpen,
    setFiltersBlockOpen,
    groupingBlockOpen,
    setGroupingBlockOpen,
    hasSearched,
    previewLoading,
    previewData,
    previewTotal,
    result,
    loading,
    exporting,
    canSubmitDraft,
    handleSubmit,
    tableColumns,
    page,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    serverSortForTable,
    handleServerSort,
    handleExportManual,
    fullscreenOpen,
    setFullscreenOpen,
    dragIndexRef,
    dragOverIndex,
    setDragOverIndex,
    appliedSnapshot,
    fetchReport,
    manualSort,
    setManualSort,
    setPage,
  };
}
