'use client';

import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ReportsChrome from '@/components/ReportsChrome';
import UnifiedReportTable from '@/components/UnifiedReportTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BASE_PATH } from '@/lib/constants';
import type { LinkedReportRequest, LinkedReportResponse } from '@/lib/linked-report';
import { emptyBootstrap, NO_AGGREGATION_VALUE } from './constants';
import { buildDefaultColumns, getColumnLabel } from './helpers';
import { LinkPickerModal } from './LinkPickerModal';
import { LinkedExportButton } from './LinkedExportButton';
import { PreviewPane } from './PreviewPane';
import { SettingsBar } from './SettingsBar';
import { SourcePane } from './SourcePane';
import type { FiltersMap, LinkedReportRouteProps, Side } from './types';

interface LinkedReportWorkspaceProps extends LinkedReportRouteProps {
  onNewSession: () => void;
}

export function LinkedReportWorkspace({
  links,
  sourceNamesById,
  bootstrapBySourceId,
  linkedReportAllowUnlimited = false,
  onNewSession,
}: LinkedReportWorkspaceProps) {
  const [selectedLinkId, setSelectedLinkId] = useState(links[0]?.id ?? '');
  const activeLink = links.find(l => l.id === selectedLinkId) ?? null;

  const leftBootstrap  = activeLink ? bootstrapBySourceId[activeLink.leftSourceId]  ?? emptyBootstrap : emptyBootstrap;
  const rightBootstrap = activeLink ? bootstrapBySourceId[activeLink.rightSourceId] ?? emptyBootstrap : emptyBootstrap;

  const [leftColumns,  setLeftColumns]  = useState<string[]>(activeLink ? buildDefaultColumns(leftBootstrap,  activeLink.leftJoinField)  : []);
  const [rightColumns, setRightColumns] = useState<string[]>(activeLink ? buildDefaultColumns(rightBootstrap, activeLink.rightJoinField) : []);
  const [leftFilters,  setLeftFilters]  = useState<FiltersMap>({});
  const [rightFilters, setRightFilters] = useState<FiltersMap>({});
  const [sharedPeriod, setSharedPeriod] = useState({ from: '', to: '' });
  const [lazyOptions,  setLazyOptions]  = useState<Record<Side, Record<string, string[]>>>({ left: {}, right: {} });
  const [lazyLoading,  setLazyLoading]  = useState<Record<Side, Record<string, boolean>>>({ left: {}, right: {} });
  const [result,   setResult]   = useState<LinkedReportResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [aggregateByColumnKey, setAggregateByColumnKey] = useState('');
  const [raiseMergedRowLimit,  setRaiseMergedRowLimit]  = useState(false);
  const [raiseSourceRowLimit,  setRaiseSourceRowLimit]  = useState(false);
  const [fullyUnlimitedRows,   setFullyUnlimitedRows]   = useState(false);
  const [modal, setModal] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const lazyLoadedRef = useRef<Record<Side, Set<string>>>({ left: new Set(), right: new Set() });
  const previewAbortRef = useRef<AbortController | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<LinkedReportResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (links.length === 0) {
      if (selectedLinkId) setSelectedLinkId('');
      return;
    }
    if (!links.some(link => link.id === selectedLinkId)) {
      setSelectedLinkId(links[0].id);
    }
  }, [links, selectedLinkId]);

  useEffect(() => {
    if (!activeLink) return;
    setLeftColumns(buildDefaultColumns(leftBootstrap, activeLink.leftJoinField));
    setRightColumns(buildDefaultColumns(rightBootstrap, activeLink.rightJoinField));
    setLeftFilters({});
    setRightFilters({});
    setSharedPeriod({ from: '', to: '' });
    setLazyOptions({ left: {}, right: {} });
    setLazyLoading({ left: {}, right: {} });
    setResult(null);
    setPreviewSnapshot(null);
    setError(null);
    setAggregateByColumnKey('');
    setRaiseMergedRowLimit(false);
    setRaiseSourceRowLimit(false);
    setFullyUnlimitedRows(false);
    lazyLoadedRef.current.left  = new Set();
    lazyLoadedRef.current.right = new Set();
  }, [activeLink, leftBootstrap, rightBootstrap]);

  useEffect(() => {
    const allowed = new Set([
      '',
      '__matchKey',
      ...leftColumns.map(k => `left__${k}`),
      ...rightColumns.map(k => `right__${k}`),
    ]);
    if (aggregateByColumnKey && !allowed.has(aggregateByColumnKey)) {
      setAggregateByColumnKey('');
    }
  }, [aggregateByColumnKey, leftColumns, rightColumns]);

  async function handleLazyOpen(side: Side, sourceId: string, key: string) {
    if (lazyLoadedRef.current[side].has(key) || lazyLoading[side][key]) return;
    setLazyLoading(cur => ({ ...cur, [side]: { ...cur[side], [key]: true } }));
    try {
      const res = await fetch(
        `${BASE_PATH}/api/report/filter-options?sourceId=${encodeURIComponent(sourceId)}&key=${encodeURIComponent(key)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка загрузки значений');
      setLazyOptions(cur => ({ ...cur, [side]: { ...cur[side], [key]: data.values ?? [] } }));
      lazyLoadedRef.current[side].add(key);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка загрузки значений фильтра');
    } finally {
      setLazyLoading(cur => ({ ...cur, [side]: { ...cur[side], [key]: false } }));
    }
  }

  function buildLinkedPreviewBody(): LinkedReportRequest | null {
    if (!activeLink) return null;
    if (leftColumns.length === 0 && rightColumns.length === 0) return null;
    return {
      linkId: activeLink.id,
      leftColumns,
      rightColumns,
      leftFilters,
      rightFilters,
      ...(activeLink.sharedPeriodLink && (sharedPeriod.from || sharedPeriod.to)
        ? { sharedPeriodValue: sharedPeriod }
        : {}),
      preview: true,
    };
  }

  function buildLinkedRequestBody() {
    if (!activeLink) return null;
    const base = {
      linkId: activeLink.id,
      leftColumns,
      rightColumns,
      leftFilters,
      rightFilters,
      ...(activeLink.sharedPeriodLink && (sharedPeriod.from || sharedPeriod.to)
        ? { sharedPeriodValue: sharedPeriod }
        : {}),
      ...(aggregateByColumnKey ? { aggregateByColumnKey } : {}),
    };
    if (linkedReportAllowUnlimited && fullyUnlimitedRows) {
      return { ...base, mergedRowLimit: -1, sourceRowLimit: -1 };
    }
    return {
      ...base,
      ...(raiseMergedRowLimit ? { mergedRowLimit: null } : {}),
      ...(raiseSourceRowLimit ? { sourceRowLimit: null } : {}),
    };
  }

  useEffect(() => {
    if (!activeLink) {
      previewAbortRef.current?.abort();
      setPreviewSnapshot(null);
      setPreviewLoading(false);
      return;
    }
    if (leftColumns.length === 0 && rightColumns.length === 0) {
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
        const body = buildLinkedPreviewBody();
        if (!body) {
          setPreviewSnapshot(null);
          return;
        }
        const res = await fetch(`${BASE_PATH}/api/report/linked`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          setPreviewSnapshot(null);
          return;
        }
        const data = (await res.json()) as LinkedReportResponse;
        setPreviewSnapshot(data);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setPreviewSnapshot(null);
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeLink?.id,
    leftColumns,
    rightColumns,
    leftFilters,
    rightFilters,
    sharedPeriod.from,
    sharedPeriod.to,
  ]);

  async function handleSubmit() {
    if (!activeLink) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/report/linked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildLinkedRequestBody()),
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
      const body = buildLinkedRequestBody();
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

  if (!activeLink) {
    return (
      <ReportsChrome onCreateReport={onNewSession} headerActions={null}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="ui-panel rounded-[30px] p-8 sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                Сводный отчёт
              </span>
              <h2 className="mt-4 font-headline text-2xl font-semibold text-on-surface">
                Связи между источниками ещё не настроены
              </h2>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                Сначала создайте хотя бы одну связь в админке: выберите два источника и поле, по
                которому их нужно склеивать.
              </p>
              <Link
                href="/admin/source-links"
                className="ui-button-primary mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-medium"
              >
                Открыть раздел связей
              </Link>
            </div>
          </div>
        </motion.div>
      </ReportsChrome>
    );
  }

  const leftSourceName  = sourceNamesById[activeLink.leftSourceId]  ?? activeLink.leftSourceId;
  const rightSourceName = sourceNamesById[activeLink.rightSourceId] ?? activeLink.rightSourceId;
  const canRun = leftColumns.length > 0 || rightColumns.length > 0;
  const leftOptions  = { ...leftBootstrap.filterOptions.options,  ...lazyOptions.left  };
  const rightOptions = { ...rightBootstrap.filterOptions.options, ...lazyOptions.right };
  const sharedPeriodLink = activeLink.sharedPeriodLink ?? null;
  const joinShort = `${getColumnLabel(leftBootstrap, activeLink.leftJoinField)} ↔ ${getColumnLabel(rightBootstrap, activeLink.rightJoinField)}`;

  const aggregateSelectOptions: { value: string; label: string }[] = [
    { value: '',           label: 'Каждое совпадение — отдельная строка' },
    { value: '__matchKey', label: `Одна строка на значение связи (${joinShort})` },
    ...leftColumns.map(k => ({
      value: `left__${k}`,
      label: `${leftSourceName}: ${getColumnLabel(leftBootstrap, k)}`,
    })),
    ...rightColumns.map(k => ({
      value: `right__${k}`,
      label: `${rightSourceName}: ${getColumnLabel(rightBootstrap, k)}`,
    })),
  ];
  const aggregateAppSelectOptions = aggregateSelectOptions.map(opt => ({
    value: opt.value || NO_AGGREGATION_VALUE,
    label: opt.label,
  }));

  const headerActions = result != null ? (
    <div className="hidden sm:flex">
      <LinkedExportButton loading={exporting} onClick={() => void handleExportLinked()} />
    </div>
  ) : null;

  return (
    <ReportsChrome onCreateReport={onNewSession} headerActions={headerActions} fullHeight>
      <div className="flex h-full flex-col overflow-hidden">
        <SettingsBar
          aggregateByColumnKey={aggregateByColumnKey}
          setAggregateByColumnKey={setAggregateByColumnKey}
          aggregateAppSelectOptions={aggregateAppSelectOptions}
          raiseMergedRowLimit={raiseMergedRowLimit}
          setRaiseMergedRowLimit={setRaiseMergedRowLimit}
          raiseSourceRowLimit={raiseSourceRowLimit}
          setRaiseSourceRowLimit={setRaiseSourceRowLimit}
          fullyUnlimitedRows={fullyUnlimitedRows}
          setFullyUnlimitedRows={setFullyUnlimitedRows}
          linkedReportAllowUnlimited={linkedReportAllowUnlimited}
          sharedPeriodLink={sharedPeriodLink}
          sharedPeriod={sharedPeriod}
          onSharedPeriodChange={setSharedPeriod}
          onRun={() => void handleSubmit()}
          canRun={canRun}
          runLoading={loading}
        />

        <div className="flex min-h-0 flex-1 divide-x divide-outline-variant/12 overflow-hidden">
          <SourcePane
            side="left"
            sourceName={leftSourceName}
            joinFieldLabel={getColumnLabel(leftBootstrap, activeLink.leftJoinField)}
            bootstrap={leftBootstrap}
            columns={leftColumns}
            onColumnsChange={setLeftColumns}
            filters={leftFilters}
            onFiltersChange={setLeftFilters}
            options={leftOptions}
            lazyLoading={lazyLoading.left}
            onLazyOpen={key => handleLazyOpen('left', activeLink.leftSourceId, key)}
            onChangeLink={() => setModal(true)}
          />
          <SourcePane
            side="right"
            sourceName={rightSourceName}
            joinFieldLabel={getColumnLabel(rightBootstrap, activeLink.rightJoinField)}
            bootstrap={rightBootstrap}
            columns={rightColumns}
            onColumnsChange={setRightColumns}
            filters={rightFilters}
            onFiltersChange={setRightFilters}
            options={rightOptions}
            lazyLoading={lazyLoading.right}
            onLazyOpen={key => handleLazyOpen('right', activeLink.rightSourceId, key)}
            onChangeLink={() => setModal(true)}
          />
          <PreviewPane
            leftColumns={leftColumns}
            rightColumns={rightColumns}
            leftBootstrap={leftBootstrap}
            rightBootstrap={rightBootstrap}
            result={result}
            loading={loading}
            error={error}
            onExport={() => void handleExportLinked()}
            exporting={exporting}
            activeLink={activeLink}
            canRun={canRun}
            onColumnsReorder={(newLeft, newRight) => { setLeftColumns(newLeft); setRightColumns(newRight); }}
            onFullscreen={() => setFullscreenOpen(true)}
            previewSnapshot={previewSnapshot}
            previewLoading={previewLoading}
          />
        </div>
      </div>

      {modal && (
        <LinkPickerModal
          links={links}
          currentLinkId={selectedLinkId}
          sourceNamesById={sourceNamesById}
          bootstrapBySourceId={bootstrapBySourceId}
          onPick={id => { setSelectedLinkId(id); setModal(false); }}
          onClose={() => setModal(false)}
        />
      )}

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          showClose
          className="h-[90vh] w-[95vw] max-w-[95vw] overflow-hidden rounded-2xl border border-outline-variant/20"
        >
          <DialogHeader className="flex-shrink-0 border-b border-outline-variant/12 pb-3">
            <DialogTitle>
              {activeLink?.name ?? 'Сводный отчёт'}
              {result && (
                <span className="ml-2 text-sm font-normal text-on-surface-variant">
                  · {result.data.length.toLocaleString('ru-RU')} строк
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <UnifiedReportTable
              fillHeight
              data={result?.data ?? []}
              columns={result?.columns ?? []}
              warnings={result?.warnings}
              sortable
              mode="client"
              loading={loading}
            />
          </div>
          <div className="flex flex-shrink-0 items-center justify-between border-t border-outline-variant/12 px-4 py-2.5">
            <span className="text-xs text-on-surface-variant">
              {result?.data.length.toLocaleString('ru-RU') ?? 0} строк
            </span>
            <button
              type="button"
              onClick={() => void handleExportLinked()}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-md border border-outline-variant/20 bg-surface-container-low/50 px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3 w-3 text-primary" strokeWidth={2.2} />
              {exporting ? 'Экспорт…' : 'Excel'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </ReportsChrome>
  );
}
