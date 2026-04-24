'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { BASE_PATH } from '@/lib/constants';
import type { LinkedReportRequest, LinkedReportResponse } from '@/lib/linked-report';
import { emptyBootstrap } from './constants';
import { buildDefaultColumns } from './helpers';
import { configReducer, makeInitialConfig } from './configReducer';
import type { FiltersMap, LinkedReportRouteProps, Side } from './types';

export interface LinkedReportWorkspaceProps extends LinkedReportRouteProps {
  onNewSession: () => void;
}

export function useLinkedReportWorkspace({
  links,
  sourceNamesById,
  bootstrapBySourceId,
  linkedReportAllowUnlimited = false,
}: LinkedReportWorkspaceProps) {
  const [selectedLinkId, setSelectedLinkId] = useState(links[0]?.id ?? '');
  const activeLink = links.find(l => l.id === selectedLinkId) ?? null;

  const leftBootstrap  = activeLink ? bootstrapBySourceId[activeLink.leftSourceId]  ?? emptyBootstrap : emptyBootstrap;
  const rightBootstrap = activeLink ? bootstrapBySourceId[activeLink.rightSourceId] ?? emptyBootstrap : emptyBootstrap;

  const [config, dispatch] = useReducer(
    configReducer,
    null,
    () => activeLink
      ? makeInitialConfig(
          buildDefaultColumns(leftBootstrap, activeLink.leftJoinField),
          buildDefaultColumns(rightBootstrap, activeLink.rightJoinField),
        )
      : makeInitialConfig([], []),
  );

  const [result,   setResult]   = useState<LinkedReportResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [modal,         setModal]         = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<LinkedReportResponse | null>(null);
  const [previewLoading,  setPreviewLoading]  = useState(false);

  const lazyLoadedRef   = useRef<Record<Side, Set<string>>>({ left: new Set(), right: new Set() });
  const previewAbortRef = useRef<AbortController | null>(null);

  // Keep selectedLinkId in sync when the links list changes
  useEffect(() => {
    if (links.length === 0) {
      if (selectedLinkId) setSelectedLinkId('');
      return;
    }
    if (!links.some(link => link.id === selectedLinkId)) {
      setSelectedLinkId(links[0].id);
    }
  }, [links, selectedLinkId]);

  // Reset all config when the active link changes
  useEffect(() => {
    if (!activeLink) return;
    dispatch({
      type: 'RESET',
      leftColumns:  buildDefaultColumns(leftBootstrap,  activeLink.leftJoinField),
      rightColumns: buildDefaultColumns(rightBootstrap, activeLink.rightJoinField),
    });
    setResult(null);
    setPreviewSnapshot(null);
    setError(null);
    lazyLoadedRef.current.left  = new Set();
    lazyLoadedRef.current.right = new Set();
  }, [activeLink, leftBootstrap, rightBootstrap]);

  // Clear aggregate key when its column is deselected
  useEffect(() => {
    const allowed = new Set([
      '',
      '__matchKey',
      ...config.leftColumns.map(k => `left__${k}`),
      ...config.rightColumns.map(k => `right__${k}`),
    ]);
    if (config.aggregateByColumnKey && !allowed.has(config.aggregateByColumnKey)) {
      dispatch({ type: 'SET_AGGREGATE_KEY', key: '' });
    }
  }, [config.aggregateByColumnKey, config.leftColumns, config.rightColumns]);

  // Debounced preview fetch
  useEffect(() => {
    if (!activeLink || (config.leftColumns.length === 0 && config.rightColumns.length === 0)) {
      previewAbortRef.current?.abort();
      setPreviewSnapshot(null);
      setPreviewLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      previewAbortRef.current?.abort();
      const ctrl = new AbortController();
      previewAbortRef.current = ctrl;
      setPreviewLoading(true);
      try {
        const body = buildPreviewBody();
        if (!body) { setPreviewSnapshot(null); return; }
        const res = await fetch(`${BASE_PATH}/api/report/linked`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) { setPreviewSnapshot(null); return; }
        setPreviewSnapshot((await res.json()) as LinkedReportResponse);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setPreviewSnapshot(null);
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLink?.id, config.leftColumns, config.rightColumns, config.leftFilters, config.rightFilters, config.sharedPeriod.from, config.sharedPeriod.to]);

  function buildPreviewBody(): LinkedReportRequest | null {
    if (!activeLink) return null;
    if (config.leftColumns.length === 0 && config.rightColumns.length === 0) return null;
    return {
      linkId: activeLink.id,
      leftColumns:  config.leftColumns,
      rightColumns: config.rightColumns,
      leftFilters:  config.leftFilters,
      rightFilters: config.rightFilters,
      ...(activeLink.sharedPeriodLink && (config.sharedPeriod.from || config.sharedPeriod.to)
        ? { sharedPeriodValue: config.sharedPeriod }
        : {}),
      preview: true,
    };
  }

  function buildRequestBody() {
    if (!activeLink) return null;
    const base = {
      linkId: activeLink.id,
      leftColumns:  config.leftColumns,
      rightColumns: config.rightColumns,
      leftFilters:  config.leftFilters,
      rightFilters: config.rightFilters,
      ...(activeLink.sharedPeriodLink && (config.sharedPeriod.from || config.sharedPeriod.to)
        ? { sharedPeriodValue: config.sharedPeriod }
        : {}),
      ...(config.aggregateByColumnKey ? { aggregateByColumnKey: config.aggregateByColumnKey } : {}),
    };
    if (linkedReportAllowUnlimited && config.fullyUnlimitedRows) {
      return { ...base, mergedRowLimit: -1, sourceRowLimit: -1 };
    }
    return {
      ...base,
      ...(config.raiseMergedRowLimit ? { mergedRowLimit: null } : {}),
      ...(config.raiseSourceRowLimit ? { sourceRowLimit: null } : {}),
    };
  }

  async function handleLazyOpen(side: Side, sourceId: string, key: string) {
    if (lazyLoadedRef.current[side].has(key) || config.lazyLoading[side][key]) return;
    dispatch({ type: 'LAZY_START', side, key });
    try {
      const res = await fetch(
        `${BASE_PATH}/api/report/filter-options?sourceId=${encodeURIComponent(sourceId)}&key=${encodeURIComponent(key)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка загрузки значений');
      dispatch({ type: 'LAZY_DONE', side, key, values: data.values ?? [] });
      lazyLoadedRef.current[side].add(key);
    } catch (cause) {
      dispatch({ type: 'LAZY_FAIL', side, key });
      setError(cause instanceof Error ? cause.message : 'Ошибка загрузки значений фильтра');
    }
  }

  async function handleSubmit() {
    if (!activeLink) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/report/linked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка построения сводного отчёта');
      setResult(data as LinkedReportResponse);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Ошибка построения сводного отчёта');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportLinked() {
    if (!activeLink) return;
    setExporting(true);
    setError(null);
    try {
      const body = buildRequestBody();
      if (!body) return;
      const res = await fetch(`${BASE_PATH}/api/report/linked/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Ошибка экспорта');
      }
      const url = URL.createObjectURL(await res.blob());
      const anchor = Object.assign(document.createElement('a'), {
        href: url,
        download: `linked_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  }

  // Derived values
  const canRun = config.leftColumns.length > 0 || config.rightColumns.length > 0;
  const leftSourceName  = sourceNamesById[activeLink?.leftSourceId  ?? ''] ?? (activeLink?.leftSourceId  ?? '');
  const rightSourceName = sourceNamesById[activeLink?.rightSourceId ?? ''] ?? (activeLink?.rightSourceId ?? '');
  const leftOptions  = { ...leftBootstrap.filterOptions.options,  ...config.lazyOptions.left  };
  const rightOptions = { ...rightBootstrap.filterOptions.options, ...config.lazyOptions.right };

  return {
    activeLink,
    selectedLinkId,
    setSelectedLinkId,
    leftBootstrap,
    rightBootstrap,
    // config state (spread for ergonomic access in view)
    leftColumns:          config.leftColumns,
    rightColumns:         config.rightColumns,
    leftFilters:          config.leftFilters,
    rightFilters:         config.rightFilters,
    sharedPeriod:         config.sharedPeriod,
    aggregateByColumnKey: config.aggregateByColumnKey,
    raiseMergedRowLimit:  config.raiseMergedRowLimit,
    raiseSourceRowLimit:  config.raiseSourceRowLimit,
    fullyUnlimitedRows:   config.fullyUnlimitedRows,
    lazyLoading:          config.lazyLoading,
    // config setters
    setLeftColumns:          (columns: string[])                    => dispatch({ type: 'SET_LEFT_COLUMNS',  columns }),
    setRightColumns:         (columns: string[])                    => dispatch({ type: 'SET_RIGHT_COLUMNS', columns }),
    setLeftFilters:          (filters: FiltersMap)                  => dispatch({ type: 'SET_LEFT_FILTERS',  filters }),
    setRightFilters:         (filters: FiltersMap)                  => dispatch({ type: 'SET_RIGHT_FILTERS', filters }),
    setSharedPeriod:         (period: { from: string; to: string }) => dispatch({ type: 'SET_SHARED_PERIOD', period }),
    setAggregateByColumnKey: (key: string)                          => dispatch({ type: 'SET_AGGREGATE_KEY', key }),
    setRaiseMergedRowLimit:  (value: boolean)                       => dispatch({ type: 'SET_RAISE_MERGED',  value }),
    setRaiseSourceRowLimit:  (value: boolean)                       => dispatch({ type: 'SET_RAISE_SOURCE',  value }),
    setFullyUnlimitedRows:   (value: boolean)                       => dispatch({ type: 'SET_FULLY_UNLIMITED', value }),
    // async state
    result,
    loading,
    error,
    exporting,
    // ui state
    modal,
    setModal,
    fullscreenOpen,
    setFullscreenOpen,
    // preview
    previewSnapshot,
    previewLoading,
    // derived
    canRun,
    leftSourceName,
    rightSourceName,
    leftOptions,
    rightOptions,
    // handlers
    handleSubmit,
    handleExportLinked,
    handleLazyOpen,
  };
}
