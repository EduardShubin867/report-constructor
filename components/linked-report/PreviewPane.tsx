import {
  BarChart2,
  Eye,
  FileSpreadsheet,
  GripVertical,
  Loader2,
  Maximize2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReportPreviewTable from '@/components/ReportPreviewTable';
import UnifiedReportTable from '@/components/unified-report-table';
import type { LinkedReportResponse } from '@/lib/linked-report';
import type { ManualReportSourcePayload } from '@/lib/report-filters-data';
import type { SourceLink } from '@/lib/schema';
import { TypeBadge } from './TypeBadge';
import type { OrderedItem, Side } from './types';

export function PreviewPane({
  leftColumns,
  rightColumns,
  leftBootstrap,
  rightBootstrap,
  result,
  loading,
  error,
  onExport,
  exporting,
  activeLink,
  canRun,
  onColumnsReorder,
  onFullscreen,
  previewSnapshot,
  previewLoading,
}: {
  leftColumns: string[];
  rightColumns: string[];
  leftBootstrap: ManualReportSourcePayload;
  rightBootstrap: ManualReportSourcePayload;
  result: LinkedReportResponse | null;
  loading: boolean;
  error: string | null;
  onExport: () => void;
  exporting: boolean;
  activeLink: SourceLink | null;
  canRun: boolean;
  onColumnsReorder: (left: string[], right: string[]) => void;
  onFullscreen: () => void;
  previewSnapshot: LinkedReportResponse | null;
  previewLoading: boolean;
}) {
  const [orderedItems, setOrderedItems] = useState<OrderedItem[]>(() => [
    ...leftColumns.map(k => ({ key: k, side: 'left' as Side })),
    ...rightColumns.map(k => ({ key: k, side: 'right' as Side })),
  ]);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setOrderedItems(prev => {
      const selectedSet = new Set([
        ...leftColumns.map(k => `left:${k}`),
        ...rightColumns.map(k => `right:${k}`),
      ]);
      const filtered = prev.filter(item => selectedSet.has(`${item.side}:${item.key}`));
      const filteredKeys = new Set(filtered.map(item => `${item.side}:${item.key}`));
      const newLeft  = leftColumns.filter(k => !filteredKeys.has(`left:${k}`)).map(k => ({ key: k, side: 'left'  as Side }));
      const newRight = rightColumns.filter(k => !filteredKeys.has(`right:${k}`)).map(k => ({ key: k, side: 'right' as Side }));
      return [...filtered, ...newLeft, ...newRight];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftColumns.join(','), rightColumns.join(',')]);

  const selectedCount = leftColumns.length + rightColumns.length;
  const hasRun = result != null;
  const previewTableColumns = useMemo(
    () =>
      previewSnapshot?.columns.map(c => ({ key: c.key, label: c.label, type: c.type })) ?? [],
    [previewSnapshot],
  );

  return (
    <div className="flex w-[420px] flex-shrink-0 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-outline-variant/12 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-3.5 w-3.5 flex-shrink-0 text-on-surface-variant" strokeWidth={2} />
          <span className="text-sm font-semibold text-on-surface">
            {hasRun ? 'Результат' : 'Превью'}
          </span>
          {!hasRun && (
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-low/50 px-2 py-px text-[11px] font-medium text-on-surface-variant">
              {previewLoading ? 'обновление…' : previewSnapshot ? '5 строк' : 'ожидание'}
            </span>
          )}
        </div>
        {hasRun && (
          <button
            type="button"
            onClick={onFullscreen}
            className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low/60 hover:text-on-surface"
            title="На весь экран"
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="flex-shrink-0 border-b border-outline-variant/10 px-3 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Колонки в отчёте · {selectedCount}
        </p>
        {selectedCount === 0 ? (
          <p className="text-xs text-on-surface-variant/50">
            Отметьте колонки слева и справа.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {orderedItems.map((item, idx) => {
              const pool = item.side === 'left' ? leftBootstrap.columns : rightBootstrap.columns;
              const col = pool.find(c => c.key === item.key);
              if (!col) return null;
              const isLeft = item.side === 'left';
              const isDragOver = dragOverIndex === idx;
              return (
                <span
                  key={`${item.side}:${item.key}`}
                  draggable
                  onDragStart={() => { dragIndexRef.current = idx; }}
                  onDragOver={e => { e.preventDefault(); setDragOverIndex(idx); }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={e => {
                    e.preventDefault();
                    const from = dragIndexRef.current;
                    setDragOverIndex(null);
                    if (from === null || from === idx) return;
                    setOrderedItems(prev => {
                      const next = [...prev];
                      const [moved] = next.splice(from, 1);
                      next.splice(idx, 0, moved);
                      onColumnsReorder(
                        next.filter(i => i.side === 'left').map(i => i.key),
                        next.filter(i => i.side === 'right').map(i => i.key),
                      );
                      return next;
                    });
                    dragIndexRef.current = null;
                  }}
                  onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                  className={`inline-flex max-w-[130px] cursor-grab items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors active:cursor-grabbing ${
                    isDragOver ? 'ring-2 ring-primary/30' : ''
                  } ${
                    isLeft
                      ? 'border-primary/20 bg-primary-fixed/50 text-primary'
                      : 'border-tertiary/20 bg-tertiary-fixed/50 text-tertiary'
                  }`}
                >
                  <GripVertical className="h-3 w-3 flex-shrink-0 opacity-40" />
                  <TypeBadge type={col.type} />
                  <span className="truncate">{col.label}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3.5 border-b border-outline-variant/10 bg-surface-container-low/30 px-3.5 py-1.5 text-[11.5px] text-on-surface-variant">
        {!activeLink ? (
          <span className="text-red-500">Связь не выбрана ↑</span>
        ) : (
          <>
            <span>
              Строк:{' '}
              <strong className="font-semibold tabular-nums text-on-surface">
                {hasRun
                  ? result.data.length.toLocaleString('ru-RU')
                  : previewLoading && !previewSnapshot
                    ? '—'
                    : previewSnapshot
                      ? previewSnapshot.data.length === 5
                        ? `${previewSnapshot.data.length}+`
                        : previewSnapshot.data.length.toLocaleString('ru-RU')
                      : '—'}
              </strong>
            </span>
            <span>
              Колонок:{' '}
              <strong className="font-semibold tabular-nums text-on-surface">
                {hasRun ? result.columns.length : previewSnapshot?.columns.length ?? '—'}
              </strong>
            </span>
            <span className="ml-auto">
              {hasRun ? (
                <span className="font-medium text-primary">результат</span>
              ) : previewLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-on-surface-variant/50" />
              ) : (
                <span className={`font-medium ${canRun ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {canRun ? 'можно выполнить' : 'добавьте колонки'}
                </span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : hasRun ? (
          <UnifiedReportTable
            data={result.data}
            columns={result.columns}
            warnings={result.warnings}
            sortable
            mode="client"
            loading={loading}
          />
        ) : previewLoading && previewSnapshot === null ? (
          <div className="flex h-full items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant/40" />
          </div>
        ) : previewSnapshot && previewSnapshot.data.length > 0 ? (
          <div className="flex flex-col">
            <ReportPreviewTable data={previewSnapshot.data} columns={previewTableColumns} />
            <div className="border-t border-outline-variant/12 px-3.5 py-2 text-[11px] text-on-surface-variant/50">
              Показаны первые 5 строк · нажмите «Выполнить» вверху для полного результата
            </div>
          </div>
        ) : previewSnapshot && previewSnapshot.data.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <BarChart2 className="mx-auto mb-3 h-9 w-9 text-on-surface-variant/40" strokeWidth={1.5} />
              <p className="text-sm font-medium text-on-surface">Нет строк</p>
              <p className="mt-1 text-xs text-on-surface-variant">С текущими фильтрами совпадений нет</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <BarChart2 className="mx-auto mb-3 h-9 w-9 text-on-surface-variant/40" strokeWidth={1.5} />
              <p className="text-sm font-medium text-on-surface">Здесь появится превью</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Выберите колонки в обоих источниках — превью обновится автоматически
              </p>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-outline-variant/12 px-3 py-2">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="ui-button-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
            {exporting ? '…' : 'Excel'}
          </button>
        </div>
      )}
    </div>
  );
}
