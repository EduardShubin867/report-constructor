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
      <div className="ui-panel overflow-hidden rounded-[28px]">
        <div className="animate-pulse">
          <div className="h-20 border-b border-outline-variant/10 bg-surface-container-low/70" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`h-9 border-b border-outline-variant/10 ${
                i % 2 === 0
                  ? 'bg-surface-container-lowest'
                  : 'bg-surface-container-low/50'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="ui-panel rounded-[28px] p-12 text-center">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            Результат
          </p>
          <p className="mt-3 font-headline text-xl font-semibold text-on-surface">
            {isServer
              ? 'По этим условиям ничего не нашлось'
              : 'В таблице пока нет данных'}
          </p>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Попробуйте убрать часть фильтров, изменить период или упростить группировку и набор колонок.
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
    <div className="ui-panel overflow-hidden rounded-[28px]">
      <div className="border-b border-outline-variant/10 bg-surface-container-low/45 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                Результат
              </span>
              <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                {displayColumns.length}{' '}
                {displayColumns.length === 1
                  ? 'колонка'
                  : displayColumns.length < 5
                    ? 'колонки'
                    : 'колонок'}
              </span>
              {totalPages > 1 ? (
                <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                  Страница {currentPage}/{totalPages}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-on-surface-variant">
              <strong className="text-lg font-semibold text-on-surface">
              {rowCount.toLocaleString('ru-RU')}
              </strong>{' '}
              {pluralRecords(rowCount)}
              {loading ? (
                <span className="ml-2 text-on-surface-variant/70">· обновляем данные…</span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          {warnings?.map(w => (
            <span
              key={w}
              className="rounded-full border border-tertiary/15 bg-tertiary-fixed/70 px-3 py-1 text-xs text-tertiary"
            >
              {w}
            </span>
          ))}
          </div>
        </div>
      </div>

      <div
        className="relative flex min-h-[19.5rem] flex-col"
        style={{ height: 'calc(100dvh - 3.5rem - 200px)' }}
      >
        {loading && (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/35 backdrop-blur-[1px]"
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
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr
                  key={hg.id}
                  className="sticky top-0 z-10 bg-surface-container-low/95 backdrop-blur-sm"
                >
                  {hg.headers.map(header => {
                    const colKey = header.column.id;
                    const clientSorted = sortable ? header.column.getIsSorted() : false;
                    const serverSorted =
                      serverHeaderSort &&
                      serverSortColumn === colKey &&
                      serverSortDirection
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
                        className={`whitespace-nowrap px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant ${
                          headerSortable
                            ? 'cursor-pointer select-none transition-colors hover:bg-surface-container-low'
                            : ''
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {headerSortable && sortedIcon === 'asc' && (
                            <ArrowUp
                              className="h-3 w-3 text-primary"
                              strokeWidth={2.2}
                            />
                          )}
                          {headerSortable && sortedIcon === 'desc' && (
                            <ArrowDown
                              className="h-3 w-3 text-primary"
                              strokeWidth={2.2}
                            />
                          )}
                          {headerSortable && !sortedIcon && (
                            <ArrowUpDown
                              className="h-3 w-3 text-on-surface-variant opacity-30"
                              strokeWidth={2.2}
                            />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-outline-variant/10">
              {isServer
                ? data.map((row, i) => (
                    <tr
                      key={
                        row.ID != null && row.ID !== ''
                          ? String(row.ID)
                          : `p${page ?? 1}-r${i}`
                      }
                      className={`transition-colors hover:bg-primary-fixed/45 ${
                        i % 2 === 0 ? 'bg-surface-container-lowest/82' : 'bg-surface-container-low/28'
                      }`}
                    >
                      {columns.map(col => (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap px-5 py-2.5 text-xs text-on-surface ${
                            numericKeys.has(col.key)
                              ? 'text-right font-mono tabular-nums'
                              : ''
                          }`}
                        >
                          {formatValue(row[col.key], col.type, col.integer)}
                        </td>
                      ))}
                    </tr>
                  ))
                : clientGroupSections
                  ? clientGroupSections.map(section => {
                      const headerTitle =
                        groupColumnMeta?.label ?? 'Значение связи';
                      const headerValue =
                        section.label.trim() === '' ? '(пусто)' : section.label;
                      return (
                        <Fragment key={section.sk}>
                          <tr className="bg-primary-fixed/55">
                            <td
                              colSpan={displayColumns.length}
                              className="px-5 py-2.5 text-xs text-on-surface"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span>
                                  <span className="font-semibold text-on-surface">
                                    {headerTitle}
                                  </span>
                                  <span className="ml-1.5 font-mono text-on-surface-variant">
                                    {headerValue}
                                  </span>
                                </span>
                                <span className="text-on-surface-variant">
                                  {section.rows.length.toLocaleString('ru-RU')}{' '}
                                  {pluralRecords(section.rows.length)}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {section.rows.map((row, rowIdx) => (
                            <tr
                              key={row.id}
                              className={`transition-colors hover:bg-primary-fixed/45 ${
                                rowIdx % 2 === 0
                                  ? 'bg-surface-container-lowest/82'
                                  : 'bg-surface-container-low/28'
                              }`}
                            >
                              {row.getVisibleCells().map(cell => (
                                <td
                                  key={cell.id}
                                  className={`whitespace-nowrap px-5 py-2.5 text-xs text-on-surface ${
                                    numericKeys.has(cell.column.id)
                                      ? 'text-right font-mono tabular-nums'
                                      : ''
                                  }`}
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  : table.getRowModel().rows.map(row => (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-primary-fixed/45 ${
                        row.index % 2 === 0 ? 'bg-surface-container-lowest/82' : 'bg-surface-container-low/28'
                      }`}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          className={`whitespace-nowrap px-5 py-2.5 text-xs text-on-surface ${
                            numericKeys.has(cell.column.id)
                              ? 'text-right font-mono tabular-nums'
                              : ''
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
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
            className="flex-shrink-0 overflow-x-auto border-t border-outline-variant/15 bg-surface-container-lowest/90"
            onScroll={() => syncScroll('floating')}
          >
            <div style={{ width: contentWidth, height: 1 }} />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-4 border-t border-outline-variant/10 bg-surface-container-low px-4 py-2">
          <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            На странице:
            <AppSelect
              value={String(isServer ? pageSize : table.getState().pagination.pageSize)}
              onValueChange={value => {
                const size = Number(value);
                if (isServer) onPageSizeChange?.(size);
                else table.setPageSize(size);
              }}
              options={PAGE_SIZE_OPTIONS}
              triggerClassName="ui-field h-7 min-w-16 rounded-lg px-2 py-1 text-xs"
              contentClassName="min-w-16"
              labelClassName="text-xs"
              ariaLabel="Выбор числа строк на странице"
            />
          </label>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="ui-button-secondary rounded-lg px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Предыдущая страница"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>

            {pageNumbers.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                className={`h-7 w-7 rounded-lg text-xs transition-colors ${
                  p === currentPage
                    ? 'ui-chip-accent font-semibold text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="ui-button-secondary rounded-lg px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Следующая страница"
            >
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
