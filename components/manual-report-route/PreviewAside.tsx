import { BarChart2, Download, Expand, Eye, Loader2, Play } from 'lucide-react';

import ReportPreviewTable from '@/components/ReportPreviewTable';
import UnifiedReportTable from '@/components/unified-report-table';
import type { ColumnDef } from '@/lib/report-columns';

import type { ManualSortState, ReportResult } from './types';

type TableColumn = { key: string; label: string; type: string; integer?: boolean };

type PreviewAsideProps = {
  hasSearched: boolean;
  previewLoading: boolean;
  previewData: Record<string, unknown>[] | null;
  previewTotal: number | null;
  tableColumns: TableColumn[];
  result: ReportResult | null;
  loading: boolean;
  page: number;
  pageSize: number;
  canSubmitDraft: boolean;
  onSubmit: () => void;
  onFullscreenOpen: () => void;
  onPageChange: (n: number) => void;
  onPageSizeChange: (n: number) => void;
  serverSortForTable: ManualSortState;
  onServerSort: (key: string) => void;
  selectedColumnsCount: number;
  onExport: () => void;
  exporting: boolean;
};

export function PreviewAside({
  hasSearched,
  previewLoading,
  previewData,
  previewTotal,
  tableColumns,
  result,
  loading,
  page,
  pageSize,
  canSubmitDraft,
  onSubmit,
  onFullscreenOpen,
  onPageChange,
  onPageSizeChange,
  serverSortForTable,
  onServerSort,
  selectedColumnsCount,
  onExport,
  exporting,
}: PreviewAsideProps) {
  return (
    <aside className="flex w-[420px] flex-shrink-0 flex-col overflow-hidden border-l border-outline-variant/12 bg-surface">
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
            onClick={onFullscreenOpen}
            title="На весь экран"
            className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low/60 hover:text-on-surface"
          >
            <Expand className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
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
            <span className={`font-medium ${selectedColumnsCount > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
              {selectedColumnsCount > 0 ? 'можно запускать' : 'добавьте колонки'}
            </span>
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {hasSearched ? (
          <UnifiedReportTable
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

      <div className="flex flex-shrink-0 items-center justify-between border-t border-outline-variant/12 px-3.5 py-2">
        <span className="text-[11.5px] text-on-surface-variant">
          {result
            ? `Стр. ${page} · ${result.total.toLocaleString('ru-RU')} строк`
            : 'Нет данных'}
        </span>
        <button
          type="button"
          onClick={onExport}
          disabled={!hasSearched || exporting}
          className="ui-button-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
          {exporting ? 'Экспорт…' : 'Excel'}
        </button>
      </div>
    </aside>
  );
}
