'use client';

import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import ReportsChrome from '@/components/ReportsChrome';
import UnifiedReportTable from '@/components/unified-report-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NO_AGGREGATION_VALUE } from './constants';
import { getColumnLabel } from './helpers';
import { LinkPickerModal } from './LinkPickerModal';
import { LinkedExportButton } from './LinkedExportButton';
import { PreviewPane } from './PreviewPane';
import { SettingsBar } from './SettingsBar';
import { SourcePane } from './SourcePane';
import { useLinkedReportWorkspace, type LinkedReportWorkspaceProps } from './useLinkedReportWorkspace';

export function LinkedReportWorkspace(props: LinkedReportWorkspaceProps) {
  const {
    activeLink,
    selectedLinkId,
    setSelectedLinkId,
    leftBootstrap,
    rightBootstrap,
    leftColumns,
    rightColumns,
    leftFilters,
    rightFilters,
    sharedPeriod,
    aggregateByColumnKey,
    raiseMergedRowLimit,
    raiseSourceRowLimit,
    fullyUnlimitedRows,
    lazyLoading,
    leftOptions,
    rightOptions,
    result,
    loading,
    error,
    exporting,
    modal,
    setModal,
    fullscreenOpen,
    setFullscreenOpen,
    previewSnapshot,
    previewLoading,
    canRun,
    leftSourceName,
    rightSourceName,
    setLeftColumns,
    setRightColumns,
    setLeftFilters,
    setRightFilters,
    setSharedPeriod,
    setAggregateByColumnKey,
    setRaiseMergedRowLimit,
    setRaiseSourceRowLimit,
    setFullyUnlimitedRows,
    handleSubmit,
    handleExportLinked,
    handleLazyOpen,
  } = useLinkedReportWorkspace(props);

  if (!activeLink) {
    return (
      <ReportsChrome onCreateReport={props.onNewSession} headerActions={null}>
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

  const joinShort = `${getColumnLabel(leftBootstrap, activeLink.leftJoinField)} ↔ ${getColumnLabel(rightBootstrap, activeLink.rightJoinField)}`;
  const aggregateAppSelectOptions = [
    { value: NO_AGGREGATION_VALUE, label: 'Каждое совпадение — отдельная строка' },
    { value: '__matchKey',         label: `Одна строка на значение связи (${joinShort})` },
    ...leftColumns.map(k => ({ value: `left__${k}`,  label: `${leftSourceName}: ${getColumnLabel(leftBootstrap,  k)}` })),
    ...rightColumns.map(k => ({ value: `right__${k}`, label: `${rightSourceName}: ${getColumnLabel(rightBootstrap, k)}` })),
  ];

  const headerActions = result != null ? (
    <div className="hidden sm:flex">
      <LinkedExportButton loading={exporting} onClick={() => void handleExportLinked()} />
    </div>
  ) : null;

  return (
    <ReportsChrome onCreateReport={props.onNewSession} headerActions={headerActions} fullHeight>
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
          linkedReportAllowUnlimited={props.linkedReportAllowUnlimited ?? false}
          sharedPeriodLink={activeLink.sharedPeriodLink ?? null}
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
          links={props.links}
          currentLinkId={selectedLinkId}
          sourceNamesById={props.sourceNamesById}
          bootstrapBySourceId={props.bootstrapBySourceId}
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
              {activeLink.name ?? 'Сводный отчёт'}
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
