'use client';

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
        header: col,
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
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white/60 p-10 text-center">
        <p className="text-sm text-gray-400">Запрос выполнен, но данных нет</p>
      </div>
    );
  }

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 text-sm">
        <span className="text-gray-600">
          <strong className="text-gray-900">{rowCount.toLocaleString('ru-RU')}</strong> строк
          {rowCount >= 5000 && (
            <span className="ml-2 text-xs text-amber-600 font-medium">(лимит 5 000)</span>
          )}
        </span>
        <div className="flex items-center gap-3">
          {warnings?.map(w => (
            <span key={w} className="text-xs text-amber-600">{w}</span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-100">
              {table.getHeaderGroups().map(hg =>
                hg.headers.map(header => {
                  const isSorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-xs tracking-wide cursor-pointer select-none hover:bg-gray-700 transition-colors"
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
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50/80 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 text-gray-700 whitespace-nowrap text-xs ${
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
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Строк на странице:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white"
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
                className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &larr;
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &rarr;
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
  return (
    <svg className="w-3 h-3 text-purple-400" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4l4 5H4l4-5z" />
    </svg>
  );
}

function SortDescIcon() {
  return (
    <svg className="w-3 h-3 text-purple-400" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 12l4-5H4l4 5z" />
    </svg>
  );
}

function SortNeutralIcon() {
  return (
    <svg className="w-3 h-3 text-gray-500 opacity-30" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4l3 4H5l3-4zM8 12l3-4H5l3 4z" />
    </svg>
  );
}
