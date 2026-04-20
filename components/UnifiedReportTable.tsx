'use client';

import { ArrowLeft, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import AppSelect from '@/components/ui/app-select';

export interface ReportColumn {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  /** Число показывать как целое (без ,00). */
  integer?: boolean;
}

export type ServerSortDirection = 'asc' | 'desc' | null;

interface UnifiedReportTableProps {
  data: Record<string, unknown>[];
  columns: ReportColumn[];
  total?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  sortable?: boolean;
  /** Режим server: клик по заголовку — цикл asc → desc → сброс (родитель шлёт запрос с sortColumn/sortDirection). */
  serverSortColumn?: string | null;
  serverSortDirection?: ServerSortDirection;
  onServerSortClick?: (columnKey: string) => void;
  warnings?: string[];
  mode: 'server' | 'client';
  /**
   * Клиентский режим: сгруппировать отображаемые строки по значению колонки (порядок групп —
   * по первому появлению после текущей сортировки).
   */
  clientGroupByColumnKey?: string | null;
  /** Не дублировать колонку группировки в каждой строке — только в шапке группы. */
  hideGroupColumnWhenGrouped?: boolean;
  /** Fill parent container height instead of using viewport-based calc. Parent must have a constrained height. */
  fillHeight?: boolean;
}

const PAGE_SIZES = [50, 100, 200, 500];
const PAGE_SIZE_OPTIONS = PAGE_SIZES.map(size => ({
  value: String(size),
  label: String(size),
}));

function formatValue(value: unknown, type?: string, integer?: boolean): string {
  if (value === null || value === undefined) return '';
  if (type === 'date' && typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ru-RU');
  }
  if (type === 'number' && integer) {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    return Math.round(n).toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  if (type === 'number' && typeof value === 'number') {
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('ru-RU')
      : value.toLocaleString('ru-RU', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('ru-RU');
  }
  return String(value);
}

function stableGroupKey(value: unknown): string {
  if (value == null) return '\0__null__';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pluralRecords(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'запись';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'записи';
  return 'записей';
}

export default function UnifiedReportTable({
  data,
  columns,
  total = 0,
  page = 1,
  pageSize = 100,
  loading = false,
  onPageChange,
  onPageSizeChange,
  sortable = false,
  serverSortColumn = null,
  serverSortDirection = null,
  onServerSortClick,
  warnings,
  mode,
  clientGroupByColumnKey = null,
  hideGroupColumnWhenGrouped = true,
  fillHeight = false,
}: UnifiedReportTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const floatingScrollRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const isSyncing = useRef(false);

  const displayColumns = useMemo(() => {
    if (
      mode === 'client' &&
      clientGroupByColumnKey &&
      hideGroupColumnWhenGrouped
    ) {
      return columns.filter(col => col.key !== clientGroupByColumnKey);
    }
    return columns;
  }, [columns, mode, clientGroupByColumnKey, hideGroupColumnWhenGrouped]);

  const numericKeys = useMemo(() => {
    const set = new Set<string>();
    for (const col of displayColumns) {
      if (col.type === 'number') {
        set.add(col.key);
      } else if (!col.type) {
        const sample = data.find(
          r => r[col.key] !== null && r[col.key] !== undefined,
        );
        if (typeof sample?.[col.key] === 'number') set.add(col.key);
      }
    }
    return set;
  }, [displayColumns, data]);

  const tanstackCols = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      displayColumns.map(col => ({
        accessorKey: col.key,
        header: col.label,
        cell: info => formatValue(info.getValue(), col.type, col.integer),
      })),
    [displayColumns],
  );

  const isServer = mode === 'server';
  const serverHeaderSort = Boolean(isServer && onServerSortClick);

  const table = useReactTable({
    data,
    columns: tanstackCols,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    ...(sortable ? { getSortedRowModel: getSortedRowModel() } : {}),
    ...(!isServer ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    manualPagination: isServer,
    ...(isServer
      ? { pageCount: Math.max(1, Math.ceil(total / pageSize)) }
      : {}),
    initialState: { pagination: { pageSize } },
  });

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const measure = () => {
      const t = el.querySelector('table');
      if (t) setContentWidth(t.scrollWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data, displayColumns]);

  const syncScroll = useCallback(
    (source: 'table' | 'floating') => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      requestAnimationFrame(() => {
        const from =
          source === 'table' ? tableScrollRef.current : floatingScrollRef.current;
        const to =
          source === 'table' ? floatingScrollRef.current : tableScrollRef.current;
        if (from && to) to.scrollLeft = from.scrollLeft;
        isSyncing.current = false;
      });
    },
    [],
  );

  const totalPages = isServer
    ? Math.max(1, Math.ceil(total / pageSize))
    : table.getPageCount();

  const currentPage = isServer
    ? page
    : table.getState().pagination.pageIndex + 1;

  const rowCount = isServer ? total : data.length;

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 4) {
      for (let i = 1; i <= maxVisible; i++) pages.push(i);
    } else if (currentPage >= totalPages - 3) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++)
        pages.push(i);
    } else {
      for (let i = currentPage - 3; i <= currentPage + 3; i++) pages.push(i);
    }
    return pages;
  }, [totalPages, currentPage]);

  const showFloatingScroll =
    contentWidth > 0 &&
    tableScrollRef.current
      ? contentWidth > tableScrollRef.current.clientWidth
      : false;

  const groupColumnMeta = useMemo(() => {
    if (!clientGroupByColumnKey) return null;
    return columns.find(col => col.key === clientGroupByColumnKey) ?? null;
  }, [columns, clientGroupByColumnKey]);

  const clientGroupSections = useMemo(() => {
    if (isServer || !clientGroupByColumnKey) return null;
    const flatRows = table.getRowModel().rows;
    if (flatRows.length === 0) return null;
    const order: string[] = [];
    const buckets = new Map<string, typeof flatRows>();
    for (const row of flatRows) {
      const raw = row.original[clientGroupByColumnKey];
      const sk = stableGroupKey(raw);
      if (!buckets.has(sk)) {
        buckets.set(sk, []);
        order.push(sk);
      }
      buckets.get(sk)!.push(row);
    }
    return order.map(sk => {
      const rows = buckets.get(sk)!;
      const sample = rows[0].original[clientGroupByColumnKey];
      const label = formatValue(
        sample,
        groupColumnMeta?.type,
        groupColumnMeta?.integer,
      );
      return { sk, label, rows };
    });
  }, [
    isServer,
    clientGroupByColumnKey,
    groupColumnMeta,
    table,
  ]);

  const showInitialSkeleton = loading && data.length === 0;

  if (showInitialSkeleton) {
    return (
      <div className="animate-pulse">
        <div className="h-8 border-b border-[#e7e5e3] bg-[#f5f5f4]" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-8 border-b border-[#e7e5e3] bg-white" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-[13px] font-medium text-[#1c1b1a]">
            {isServer ? 'По этим условиям ничего не нашлось' : 'В таблице пока нет данных'}
          </p>
          <p className="mt-1 text-xs text-[#75726e]">
            Попробуйте убрать часть фильтров или изменить группировку.
          </p>
        </div>
      </div>
    );
  }

  const goToPage = (p: number) => {
    if (isServer) onPageChange?.(p);
    else table.setPageIndex(p - 1);
  };

  return (
    <div className={fillHeight ? 'flex h-full flex-col overflow-hidden' : 'flex flex-col overflow-hidden'}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {loading && (
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-white/50"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">Загружаем таблицу</span>
          </div>
        )}
        <div
          ref={tableScrollRef}
          className="min-h-0 flex-1 overflow-auto [&::-webkit-scrollbar]:h-0"
          onScroll={() => syncScroll('table')}
        >
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="sticky top-0 z-10 border-b border-[#e7e5e3] bg-[#f5f5f4]">
                  {hg.headers.map(header => {
                    const colKey = header.column.id;
                    const clientSorted = sortable ? header.column.getIsSorted() : false;
                    const serverSorted =
                      serverHeaderSort && serverSortColumn === colKey && serverSortDirection
                        ? serverSortDirection
                        : false;
                    const headerSortable = sortable || serverHeaderSort;
                    const sortedIcon = sortable ? clientSorted : serverSorted;
                    return (
                      <th
                        key={header.id}
                        onClick={
                          sortable
                            ? header.column.getToggleSortingHandler()
                            : serverHeaderSort
                              ? () => onServerSortClick?.(colKey)
                              : undefined
                        }
                        className={`whitespace-nowrap px-3 py-1.5 text-left text-[11.5px] font-medium text-[#75726e] ${
                          headerSortable ? 'cursor-pointer select-none hover:bg-[#efeeec]' : ''
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {headerSortable && sortedIcon === 'asc' && (
                            <ArrowUp className="h-3 w-3 text-[#3a5a7a]" strokeWidth={2.2} />
                          )}
                          {headerSortable && sortedIcon === 'desc' && (
                            <ArrowDown className="h-3 w-3 text-[#3a5a7a]" strokeWidth={2.2} />
                          )}
                          {headerSortable && !sortedIcon && (
                            <ArrowUpDown className="h-3 w-3 text-[#a8a5a0]" strokeWidth={2.2} />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody>
              {isServer
                ? data.map((row, i) => (
                    <tr
                      key={row.ID != null && row.ID !== '' ? String(row.ID) : `p${page ?? 1}-r${i}`}
                      className="border-b border-[#e7e5e3] hover:bg-[#f5f5f4]"
                    >
                      {columns.map(col => (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap px-3 py-1.5 text-[12px] text-[#1c1b1a] ${
                            numericKeys.has(col.key) ? 'text-right font-mono tabular-nums' : ''
                          }`}
                        >
                          {formatValue(row[col.key], col.type, col.integer)}
                        </td>
                      ))}
                    </tr>
                  ))
                : clientGroupSections
                  ? clientGroupSections.map(section => {
                      const headerTitle = groupColumnMeta?.label ?? 'Значение связи';
                      const headerValue = section.label.trim() === '' ? '(пусто)' : section.label;
                      return (
                        <Fragment key={section.sk}>
                          <tr className="border-b border-[#e7e5e3] bg-[#eaf0f6]">
                            <td colSpan={displayColumns.length} className="px-3 py-1.5 text-[12px]">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span>
                                  <span className="font-medium text-[#2b4560]">{headerTitle}</span>
                                  <span className="ml-1.5 font-mono text-[#3a5a7a]">{headerValue}</span>
                                </span>
                                <span className="text-[#75726e]">
                                  {section.rows.length.toLocaleString('ru-RU')} {pluralRecords(section.rows.length)}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {section.rows.map(row => (
                            <tr key={row.id} className="border-b border-[#e7e5e3] hover:bg-[#f5f5f4]">
                              {row.getVisibleCells().map(cell => (
                                <td
                                  key={cell.id}
                                  className={`whitespace-nowrap px-3 py-1.5 text-[12px] text-[#1c1b1a] ${
                                    numericKeys.has(cell.column.id) ? 'text-right font-mono tabular-nums' : ''
                                  }`}
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  : table.getRowModel().rows.map(row => (
                      <tr key={row.id} className="border-b border-[#e7e5e3] hover:bg-[#f5f5f4]">
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            className={`whitespace-nowrap px-3 py-1.5 text-[12px] text-[#1c1b1a] ${
                              numericKeys.has(cell.column.id) ? 'text-right font-mono tabular-nums' : ''
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

        {showFloatingScroll && (
          <div
            ref={floatingScrollRef}
            className="flex-shrink-0 overflow-x-auto border-t border-[#e7e5e3]"
            onScroll={() => syncScroll('floating')}
          >
            <div style={{ width: contentWidth, height: 1 }} />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-shrink-0 items-center justify-between border-t border-[#e7e5e3] bg-[#f5f5f4] px-3 py-1.5">
          <label className="flex items-center gap-1.5 text-[11.5px] text-[#75726e]">
            На стр:
            <AppSelect
              value={String(isServer ? pageSize : table.getState().pagination.pageSize)}
              onValueChange={value => {
                const size = Number(value);
                if (isServer) onPageSizeChange?.(size);
                else table.setPageSize(size);
              }}
              options={PAGE_SIZE_OPTIONS}
              triggerClassName="h-6 min-w-14 rounded-md border border-[#e7e5e3] bg-white px-2 py-0.5 text-[11.5px]"
              contentClassName="min-w-14"
              labelClassName="text-xs"
              ariaLabel="Выбор числа строк на странице"
            />
          </label>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded-md px-1.5 py-1 text-[#75726e] disabled:opacity-40 hover:bg-[#efeeec]"
              aria-label="Предыдущая страница"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </button>

            {pageNumbers.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                className={`h-6 min-w-6 rounded-md px-1 text-[11.5px] transition-colors ${
                  p === currentPage
                    ? 'bg-[#3a5a7a] font-semibold text-white'
                    : 'text-[#75726e] hover:bg-[#efeeec]'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded-md px-1.5 py-1 text-[#75726e] disabled:opacity-40 hover:bg-[#efeeec]"
              aria-label="Следующая страница"
            >
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
