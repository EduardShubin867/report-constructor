'use client';

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { resolveAiColumnHeader } from '@/lib/column-header';

/* ── Helpers (carried from SqlResultTable) ────────────────────────── */

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('ru-RU');
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('ru-RU')
      : value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString('ru-RU');
  }
  return String(value);
}

function isNumericColumn(data: Record<string, unknown>[], col: string): boolean {
  const sample = data.find(r => r[col] !== null && r[col] !== undefined);
  return typeof sample?.[col] === 'number';
}

/* ── Props ────────────────────────────────────────────────────────── */

interface DataTableProps {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  warnings?: string[];
}

/* ── Component ────────────────────────────────────────────────────── */

export default function DataTable({ data, columns, rowCount, warnings }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const numericCols = useMemo(() => {
    const set = new Set<string>();
    for (const col of columns) {
      if (isNumericColumn(data, col)) set.add(col);
    }
    return set;
  }, [data, columns]);

  const columnDefs = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map(col => ({
        accessorKey: col,
        header: resolveAiColumnHeader(col),
        cell: info => formatCell(info.getValue()),
        sortingFn: numericCols.has(col) ? 'alphanumeric' : 'text',
      })),
    [columns, numericCols],
  );

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 100 } },
  });

  if (data.length === 0) {
    return (
      <div className="ui-panel rounded-2xl p-10 text-center">
        <p className="text-sm text-on-surface-variant">Запрос выполнен, но данных нет</p>
      </div>
    );
  }

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <div className="ui-panel overflow-hidden rounded-xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low/45 px-4 py-2 text-sm">
        <span className="text-on-surface-variant">
          <strong className="text-on-surface">{rowCount.toLocaleString('ru-RU')}</strong> строк
          {rowCount >= 5000 && (
            <span className="ml-2 text-xs font-medium text-tertiary">(лимит 5 000)</span>
          )}
        </span>
        <div className="flex items-center gap-3">
          {warnings?.map(w => (
            <span key={w} className="text-xs text-tertiary">{w}</span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low/80">
              {table.getHeaderGroups().map(hg =>
                hg.headers.map(header => {
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:bg-surface-container-low"
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isSorted === 'asc' && <SortAscIcon />}
                        {isSorted === 'desc' && <SortDescIcon />}
                        {!isSorted && <SortNeutralIcon />}
                      </span>
                    </th>
                  );
                }),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="transition-colors hover:bg-surface-container-low">
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={`whitespace-nowrap px-4 py-2 text-xs text-on-surface ${
                      numericCols.has(cell.column.id) ? 'text-right font-mono tabular-nums' : ''
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low px-4 py-1.5 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span>Строк на странице:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="ui-field rounded-lg px-2 py-1 text-xs"
            >
              {[50, 100, 250, 500].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Страница {pageIndex + 1} из {pageCount}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="ui-button-secondary rounded-lg px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Предыдущая страница"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="ui-button-secondary rounded-lg px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Следующая страница"
              >
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sort icons ───────────────────────────────────────────────────── */

function SortAscIcon() {
  return <ArrowUp className="h-3 w-3 text-primary" strokeWidth={2.2} />;
}

function SortDescIcon() {
  return <ArrowDown className="h-3 w-3 text-primary" strokeWidth={2.2} />;
}

function SortNeutralIcon() {
  return <ArrowUpDown className="h-3 w-3 text-on-surface-variant opacity-30" strokeWidth={2.2} />;
}
