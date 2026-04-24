import { Download } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UnifiedReportTable from '@/components/unified-report-table';
import type { ColumnDef } from '@/lib/report-columns';

import type { ManualSortState, ReportResult } from './types';

type TableColumn = { key: string; label: string; type: string; integer?: boolean };

type FullscreenReportDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceTitle: string | null;
  result: ReportResult | null;
  tableColumns: TableColumn[];
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (n: number) => void;
  onPageSizeChange: (n: number) => void;
  serverSortForTable: ManualSortState;
  onServerSort: (key: string) => void;
  onExport: () => void;
  exporting: boolean;
};

export function FullscreenReportDialog({
  open,
  onOpenChange,
  sourceTitle,
  result,
  tableColumns,
  page,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
  serverSortForTable,
  onServerSort,
  onExport,
  exporting,
}: FullscreenReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        className="h-[90vh] w-[95vw] max-w-[95vw] overflow-hidden rounded-2xl border border-outline-variant/20"
      >
        <DialogHeader className="flex-shrink-0 border-b border-outline-variant/12 pb-3">
          <DialogTitle>
            {sourceTitle ?? 'Отчёт'}
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
            columns={tableColumns as { key: string; label: string; type: ColumnDef['type']; integer?: boolean }[]}
            total={result?.total ?? 0}
            page={page}
            pageSize={pageSize}
            loading={loading}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            mode="server"
            serverSortColumn={serverSortForTable.col}
            serverSortDirection={serverSortForTable.dir}
            onServerSortClick={onServerSort}
          />
        </div>
        <div className="flex flex-shrink-0 items-center justify-between border-t border-outline-variant/12 px-4 py-2.5">
          <span className="text-xs text-on-surface-variant">
            Стр. {page} · {result?.total.toLocaleString('ru-RU') ?? 0} строк
          </span>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-outline-variant/20 bg-surface-container-low/50 px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-40"
          >
            <Download className="h-3 w-3 text-primary" strokeWidth={2.2} />
            {exporting ? 'Экспорт…' : 'Excel'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
