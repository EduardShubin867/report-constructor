'use client';

import { BarChart2, ChevronRight, Download, Eye, Expand, GripVertical, Loader2, Play, Plus, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GenericReportFilters from '@/components/GenericReportFilters';
import GroupBySelector from '@/components/GroupBySelector';
import ReportsChrome from '@/components/ReportsChrome';
import ReportPreviewTable from '@/components/ReportPreviewTable';
import UnifiedReportTable from '@/components/UnifiedReportTable';
import { CONTRACT_COUNT_COLUMN_KEY, type ColumnDef } from '@/lib/report-columns';
import type { AggregationFn } from '@/lib/query-builder';
import type { FilterDef, ManualReportSourcePayload, SourceFilterOptions } from '@/lib/report-filters-data';
import { BASE_PATH } from '@/lib/constants';

type ManualSortState = { col: string | null; dir: 'asc' | 'desc' | null };
const SOURCE_QUERY_PARAM = 'sourceId';

type AppliedReportSnapshot = {
  columns: string[];
  groupBy: string[];
  filters: Record<string, string[]>;
  periodFilters: Record<string, { from: string; to: string }>;
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

interface ManualReportRouteProps {
  initialSourceId?: string;
  sources?: { id: string; name: string }[];
  initialBootstrapBySourceId?: Record<string, ManualReportSourcePayload> | null;
}

const emptyBootstrap: ManualReportSourcePayload = {
  columns: [],
  groupByColumns: [],
  filterOptions: { filterDefs: [], options: {}, periodFilterCols: [] },
};
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

// ── Inline helpers ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    string:  { label: 'abc', cls: 'bg-[#eef1f4] text-[#506577]' },
    number:  { label: '123', cls: 'bg-[#eef3ee] text-[#476a52]' },
    date:    { label: 'дт',  cls: 'bg-[#f2ecef] text-[#7a4460]' },
    boolean: { label: '0/1', cls: 'bg-[#eef1f4] text-[#506577]' },
  };
  const { label, cls } = map[type] ?? { label: '?', cls: 'bg-[#f5f5f4] text-[#75726e]' };
  return (
    <span className={`inline-flex h-[14px] w-[26px] flex-shrink-0 items-center justify-center rounded text-[9px] font-mono font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function CanvasBlock({
  step,
  title,
  subtitle,
  badge,
  optional,
  collapsible,
  open,
  onToggle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  badge?: string;
  optional?: boolean;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const showBody = !collapsible || open;
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface">
      <div className="flex items-center gap-2.5 border-b border-outline-variant/12 px-3.5 py-2.5">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-low font-mono text-[11px] font-semibold text-on-surface-variant">
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            {title}
            {optional && (
              <span className="rounded-full border border-outline-variant/15 px-1.5 py-px text-[10.5px] font-normal text-on-surface-variant">
                необязательно
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-on-surface-variant">{subtitle}</div>
        </div>
        {badge && (
          <span className="rounded-full border border-outline-variant/15 bg-surface-container-low/50 px-2 py-0.5 text-xs text-on-surface-variant">
            {badge}
          </span>
        )}
        {collapsible && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded px-1.5 py-0.5 text-xs text-on-surface-variant hover:text-on-surface"
          >
            {open ? 'Свернуть' : 'Развернуть'}
          </button>
        )}
      </div>
      {showBody && <div className="px-3.5 py-3">{children}</div>}
    </div>
  );
}

const AGG_LABELS: Record<string, string> = {
  sum: 'сумма',
  avg: 'сред.',
  count: 'кол-во',
  min: 'мин',
  max: 'макс',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ManualReportRoute({
  initialSourceId = '',
  sources = [],
  initialBootstrapBySourceId,
}: ManualReportRouteProps) {
  const searchParams = useSearchParams();
  const bootstrapById = coerceBootstrapMap(initialBootstrapBySourceId);
  const defaultSourceId = sources[0]?.id ?? '';
  const normalizedInitialSourceId = sources.some(s => s.id === initialSourceId) ? initialSourceId : defaultSourceId;
  const boot0 = bootstrapById[normalizedInitialSourceId] ?? emptyBootstrap;

  // ── Source & column state ──────────────────────────────────────────────────
  const [selectedSourceId, setSelectedSourceId] = useState(normalizedInitialSourceId);
  const [filterOptions, setFilterOptions] = useState<SourceFilterOptions>(() => normalizeFilterOptions(boot0.filterOptions));
  const [genericFilters, setGenericFilters] = useState<Record<string, string[]>>({});
  const [periodFilters, setPeriodFilters] = useState<Record<string, { from: string; to: string }>>({});
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef[]>(boot0.columns);
  const [groupByColumns, setGroupByColumns] = useState<ColumnDef[]>(() => mergeGroupByColumnsPayload(boot0));

  // ── Report state ───────────────────────────────────────────────────────────
  const [manualError, setManualError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [showContractCount, setShowContractCount] = useState(true);
  const [columnAggregations, setColumnAggregations] = useState<Record<string, AggregationFn>>({});
  const [manualSort, setManualSort] = useState<ManualSortState>({ col: null, dir: null });
  const [result, setResult] = useState<ReportResult | null>(null);
  const [appliedSnapshot, setAppliedSnapshot] = useState<AppliedReportSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [lazyFilterOptions, setLazyFilterOptions] = useState<Record<string, string[]>>({});
  const [lazyFilterLoading, setLazyFilterLoading] = useState<Record<string, boolean>>({});

  // ── Live preview state ─────────────────────────────────────────────────────
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);

  // ── UI state (new for 3-pane layout) ──────────────────────────────────────
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

  // ── Column tree grouping ───────────────────────────────────────────────────
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

  // ── Source change effects ──────────────────────────────────────────────────
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

  // ── Merged filter options ──────────────────────────────────────────────────
  const mergedFilterOptions = useMemo(
    () => ({ ...filterOptions.options, ...lazyFilterOptions }),
    [filterOptions.options, lazyFilterOptions],
  );

  // ── Table columns (resolved) ───────────────────────────────────────────────
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

  // ── Lazy filter loader ─────────────────────────────────────────────────────
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

  // ── Debounced live preview ─────────────────────────────────────────────────
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

  // ── Fetch / export ─────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ReportsChrome
      fullHeight
      onCreateReport={() => {
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
      }}
    >
      <div className="flex h-full overflow-hidden">

        {/* ── LEFT PANE: Column tree ───────────────────────────────────────── */}
        <aside className="flex w-80 flex-shrink-0 flex-col overflow-hidden border-r border-outline-variant/12 bg-surface">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-outline-variant/12 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-on-surface">
              {selectedSource?.name ?? 'Источник'}
              <span className="ml-2 text-[11.5px] font-normal text-on-surface-variant">
                · {visibleColumns.length} колонок
              </span>
            </span>
          </div>

          {/* Search */}
          <div className="flex-shrink-0 border-b border-outline-variant/10 p-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 flex-shrink-0 text-on-surface-variant/40" strokeWidth={2} />
              <input
                type="text"
                value={columnSearch}
                onChange={e => setColumnSearch(e.target.value)}
                placeholder={`Поиск по ${visibleColumns.length} колонкам…`}
                className="flex-1 bg-transparent text-[12.5px] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-0"
              />
              {columnSearch ? (
                <button type="button" onClick={() => setColumnSearch('')}>
                  <X className="h-3 w-3 text-on-surface-variant/40 hover:text-on-surface-variant" />
                </button>
              ) : (
                <span className="ml-auto rounded border border-outline-variant/15 border-b-2 bg-surface-container-low px-1 py-px font-mono text-[10.5px] leading-none text-on-surface-variant/60">
                  ⌘K
                </span>
              )}
            </div>
          </div>

          {/* Tree */}
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
            {!columnSearch && (
              <div className="mx-1 mb-2 flex gap-2 rounded-lg border border-dashed border-outline-variant/20 bg-surface-container-low/30 p-2.5 text-[11.5px] text-on-surface-variant">
                <span className="mt-px flex-shrink-0 text-amber-500">💡</span>
                Разверните группу и кликните по колонкам, чтобы добавить их в отчёт.
              </div>
            )}

            {filtersLoading && visibleColumns.length === 0 && (
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
                        onClick={() => {
                          if (isAdded) removeColumn(col.key);
                          else setSelectedColumns(prev => [...prev, col.key]);
                        }}
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

          {/* Source switcher (if multiple sources) */}
          {sources.length > 1 && (
            <div className="flex-shrink-0 border-t border-outline-variant/12 p-2">
              <div className="flex gap-0.5 rounded-lg bg-surface-container-low/60 p-0.5">
                {sources.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSourceId(s.id)}
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

        {/* ── CENTER PANE: Canvas ──────────────────────────────────────────── */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-surface-container-lowest/40 px-5 py-4">
          {/* Toolbar */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-on-surface">Новый отчёт</h1>
              <p className="mt-0.5 text-sm text-on-surface-variant">
                Собирайте отчёт блоками — каждый шаг влияет на результат справа.
              </p>
            </div>
          </div>

          {/* Block 1: Columns */}
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

          {/* Block 2: Filters */}
          <CanvasBlock
            step={2}
            title="Фильтры"
            subtitle="Какие строки попадут в отчёт."
            badge={activeFilterCount > 0 ? String(activeFilterCount) : undefined}
            collapsible
            open={filtersBlockOpen}
            onToggle={() => setFiltersBlockOpen(o => !o)}
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

          {/* Block 3: Grouping */}
          <CanvasBlock
            step={3}
            title="Группировка и расчёты"
            subtitle="Сверните строки по общим значениям и посчитайте итоги."
            badge={groupBy.length > 0 ? `${groupBy.length} полей` : undefined}
            optional
            collapsible
            open={groupingBlockOpen}
            onToggle={() => setGroupingBlockOpen(o => !o)}
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
                setManualSort(nextSort as ManualSortState);
                setPage(1);
                void fetchReport(1, pageSize, snap.filters, snap.periodFilters, snap.columns, snap.groupBy, selectedSourceId, { includeContractCount: v, sort: nextSort as ManualSortState });
              }}
            />
          </CanvasBlock>

          {/* Block 4: Aggregations (visible only when groupBy is active and numeric measures exist) */}
          {(() => {
            const measureCols = selectedColumns
              .map(k => visibleColumns.find(c => c.key === k))
              .filter((c): c is ColumnDef => c != null && c.type === 'number' && !groupBy.includes(c.key));
            if (groupBy.length === 0 || measureCols.length === 0) return null;
            const AGG_OPTIONS = (Object.entries(AGG_LABELS) as [AggregationFn, string][]);
            return (
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
            );
          })()}

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

        {/* ── RIGHT PANE: Preview ──────────────────────────────────────────── */}
        <aside className="flex w-[420px] flex-shrink-0 flex-col overflow-hidden border-l border-outline-variant/12 bg-surface">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-outline-variant/12 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-on-surface-variant" strokeWidth={2} />
              <span className="text-sm font-semibold text-on-surface">
                {hasSearched ? 'Результат' : 'Превью'}
              </span>
              {!hasSearched && (
                <span className="rounded-full border border-outline-variant/15 bg-surface-container-low/50 px-2 py-px text-[11px] font-medium text-on-surface-variant">
                  {previewLoading ? 'обновление…' : previewData !== null ? '5 строк' : 'ожидание'}
                </span>
              )}
            </div>
            {hasSearched && (
              <button
                type="button"
                onClick={() => setFullscreenOpen(true)}
                title="На весь экран"
                className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low/60 hover:text-on-surface"
              >
                <Expand className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmitDraft}
              className="ui-button-primary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Play className="h-3.5 w-3.5" strokeWidth={2.2} />
              )}
              {loading ? 'Строим…' : 'Выполнить'}
            </button>
          </div>

          {/* Meta bar */}
          <div className="flex flex-shrink-0 items-center gap-3.5 border-b border-outline-variant/10 bg-surface-container-low/30 px-3.5 py-1.5 text-[11.5px] text-on-surface-variant">
            <span>
              Строк:{' '}
              <strong className="font-semibold tabular-nums text-on-surface">
                {hasSearched
                  ? (result?.total.toLocaleString('ru-RU') ?? '—')
                  : previewTotal !== null && previewTotal > 5
                    ? previewTotal.toLocaleString('ru-RU')
                    : previewTotal !== null && previewData !== null
                      ? `${previewData.length}+`
                      : '—'}
              </strong>
            </span>
            <span>
              Колонок: <strong className="font-semibold tabular-nums text-on-surface">{tableColumns.length}</strong>
            </span>
            <span className="ml-auto">
              {hasSearched ? (
                <span className="font-medium text-primary">результат</span>
              ) : previewLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-on-surface-variant/50" />
              ) : (
                <span className={`font-medium ${selectedColumns.length > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {selectedColumns.length > 0 ? 'можно запускать' : 'добавьте колонки'}
                </span>
              )}
            </span>
          </div>

          {/* Table area */}
          <div className="min-h-0 flex-1 overflow-auto">
            {hasSearched ? (
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
            ) : previewLoading && previewData === null ? (
              <div className="flex h-full items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant/40" />
              </div>
            ) : previewData !== null && previewData.length > 0 ? (
              <div className="flex flex-col">
                <ReportPreviewTable data={previewData} columns={tableColumns} />
                <div className="border-t border-outline-variant/12 px-3.5 py-2 text-[11px] text-on-surface-variant/50">
                  Показаны первые 5 строк · нажмите «Выполнить» для полного результата
                </div>
              </div>
            ) : previewData !== null && previewData.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <BarChart2 className="mx-auto mb-3 h-9 w-9 text-on-surface-variant/40" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-on-surface">Нет строк</p>
                  <p className="mt-1 text-xs text-on-surface-variant">С текущими фильтрами данных нет</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <BarChart2 className="mx-auto mb-3 h-9 w-9 text-on-surface-variant/40" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-on-surface">Здесь появится превью</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Добавьте колонки — превью обновится автоматически
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-shrink-0 items-center justify-between border-t border-outline-variant/12 px-3.5 py-2">
            <span className="text-[11.5px] text-on-surface-variant">
              {result
                ? `Стр. ${page} · ${result.total.toLocaleString('ru-RU')} строк`
                : 'Нет данных'}
            </span>
            <button
              type="button"
              onClick={() => void handleExportManual()}
              disabled={!hasSearched || exporting}
              className="ui-button-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
              {exporting ? 'Экспорт…' : 'Excel'}
            </button>
          </div>
        </aside>

      </div>

      {/* Fullscreen report dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          showClose
          className="h-[90vh] w-[95vw] max-w-[95vw] overflow-hidden rounded-2xl border border-outline-variant/20"
        >
          <DialogHeader className="flex-shrink-0 border-b border-outline-variant/12 pb-3">
            <DialogTitle>
              {selectedSource?.name ?? 'Отчёт'}
              {result && (
                <span className="ml-2 text-sm font-normal text-on-surface-variant">
                  · {result.total.toLocaleString('ru-RU')} строк
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <UnifiedReportTable
              fillHeight
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
          </div>
          <div className="flex flex-shrink-0 items-center justify-between border-t border-outline-variant/12 px-4 py-2.5">
            <span className="text-xs text-on-surface-variant">
              Стр. {page} · {result?.total.toLocaleString('ru-RU') ?? 0} строк
            </span>
            <button
              type="button"
              onClick={() => void handleExportManual()}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-md border border-outline-variant/20 bg-surface-container-low/50 px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-40"
            >
              <Download className="h-3 w-3 text-primary" strokeWidth={2.2} />
              {exporting ? 'Экспорт…' : 'Excel'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </ReportsChrome>
  );
}
