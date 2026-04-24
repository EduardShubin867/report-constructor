'use client';

import ReportsChrome from '@/components/ReportsChrome';

import { ColumnTreeAside } from './ColumnTreeAside';
import { FullscreenReportDialog } from './FullscreenReportDialog';
import { PreviewAside } from './PreviewAside';
import { ReportBuilderMain } from './ReportBuilderMain';
import type { ManualReportRouteProps } from './types';
import { useManualReportRoute } from './useManualReportRoute';

export default function ManualReportRoute(props: ManualReportRouteProps) {
  const v = useManualReportRoute(props);

  return (
    <ReportsChrome fullHeight onCreateReport={v.onCreateReport}>
      <div className="flex h-full overflow-hidden">
        <ColumnTreeAside
          selectedSource={v.selectedSource}
          visibleColumnCount={v.visibleColumns.length}
          columnSearch={v.columnSearch}
          onColumnSearchChange={v.setColumnSearch}
          columnGroups={v.columnGroups}
          filtersLoading={v.filtersLoading}
          openGroups={v.openGroups}
          setOpenGroups={v.setOpenGroups}
          selectedColumns={v.selectedColumns}
          onToggleColumn={(key, isAdded) => {
            if (isAdded) v.removeColumn(key);
            else v.setSelectedColumns(prev => [...prev, key]);
          }}
          sources={v.sources}
          selectedSourceId={v.selectedSourceId}
          onSelectSource={v.setSelectedSourceId}
        />

        <ReportBuilderMain
          selectedColumns={v.selectedColumns}
          setSelectedColumns={v.setSelectedColumns}
          visibleColumns={v.visibleColumns}
          groupByColumns={v.groupByColumns}
          removeColumn={v.removeColumn}
          groupBy={v.groupBy}
          setGroupBy={v.setGroupBy}
          showContractCount={v.showContractCount}
          setShowContractCount={v.setShowContractCount}
          columnAggregations={v.columnAggregations}
          setColumnAggregations={v.setColumnAggregations}
          activeFilterCount={v.activeFilterCount}
          manualError={v.manualError}
          filterOptions={v.filterOptions}
          mergedFilterOptions={v.mergedFilterOptions}
          genericFilters={v.genericFilters}
          setGenericFilters={v.setGenericFilters}
          periodFilters={v.periodFilters}
          setPeriodFilters={v.setPeriodFilters}
          filtersLoading={v.filtersLoading}
          onLazyFilterOpen={v.onLazyFilterOpen}
          lazyFilterLoading={v.lazyFilterLoading}
          filtersBlockOpen={v.filtersBlockOpen}
          setFiltersBlockOpen={v.setFiltersBlockOpen}
          groupingBlockOpen={v.groupingBlockOpen}
          setGroupingBlockOpen={v.setGroupingBlockOpen}
          appliedSnapshot={v.appliedSnapshot}
          hasSearched={v.hasSearched}
          pageSize={v.pageSize}
          selectedSourceId={v.selectedSourceId}
          fetchReport={v.fetchReport}
          setManualSort={v.setManualSort}
          setPage={v.setPage}
          dragIndexRef={v.dragIndexRef}
          dragOverIndex={v.dragOverIndex}
          setDragOverIndex={v.setDragOverIndex}
        />

        <PreviewAside
          hasSearched={v.hasSearched}
          previewLoading={v.previewLoading}
          previewData={v.previewData}
          previewTotal={v.previewTotal}
          tableColumns={v.tableColumns}
          result={v.result}
          loading={v.loading}
          page={v.page}
          pageSize={v.pageSize}
          canSubmitDraft={v.canSubmitDraft}
          onSubmit={v.handleSubmit}
          onFullscreenOpen={() => v.setFullscreenOpen(true)}
          onPageChange={v.handlePageChange}
          onPageSizeChange={v.handlePageSizeChange}
          serverSortForTable={v.serverSortForTable}
          onServerSort={v.handleServerSort}
          selectedColumnsCount={v.selectedColumns.length}
          onExport={() => void v.handleExportManual()}
          exporting={v.exporting}
        />
      </div>

      <FullscreenReportDialog
        open={v.fullscreenOpen}
        onOpenChange={v.setFullscreenOpen}
        sourceTitle={v.selectedSource?.name ?? null}
        result={v.result}
        tableColumns={v.tableColumns}
        page={v.page}
        pageSize={v.pageSize}
        loading={v.loading}
        onPageChange={v.handlePageChange}
        onPageSizeChange={v.handlePageSizeChange}
        serverSortForTable={v.serverSortForTable}
        onServerSort={v.handleServerSort}
        onExport={() => void v.handleExportManual()}
        exporting={v.exporting}
      />
    </ReportsChrome>
  );
}
