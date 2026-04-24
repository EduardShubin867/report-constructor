'use client';

import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useCallback, useMemo, useRef, useState } from 'react';
import { buildTanstackColumnDefs } from './column-defs';
import {
  computePageNumbers,
  buildNumericKeysSet,
  formatValue,
  stableGroupKey,
} from './utils';
import { UnifiedReportTableBodyClientFlat } from './UnifiedReportTableBodyClientFlat';
import {
  type ClientGroupSection,
  UnifiedReportTableBodyClientGrouped,
} from './UnifiedReportTableBodyClientGrouped';
import { UnifiedReportTableBodyServer } from './UnifiedReportTableBodyServer';
import { UnifiedReportTableEmpty } from './UnifiedReportTableEmpty';
import { UnifiedReportTableFloatingScroll } from './UnifiedReportTableFloatingScroll';
import { UnifiedReportTableHead } from './UnifiedReportTableHead';
import { UnifiedReportTablePagination } from './UnifiedReportTablePagination';
import { UnifiedReportTableSkeleton } from './UnifiedReportTableSkeleton';
import type { UnifiedReportTableProps } from './types';
import { useTableContentWidth } from './useTableContentWidth';

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
  mode,
  clientGroupByColumnKey = null,
  hideGroupColumnWhenGrouped = true,
  fillHeight = false,
}: UnifiedReportTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const floatingScrollRef = useRef<HTMLDivElement>(null);
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

  const numericKeys = useMemo(
    () => buildNumericKeysSet(displayColumns, data),
    [displayColumns, data],
  );

  const tanstackCols = useMemo(
    () => buildTanstackColumnDefs(displayColumns),
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
    ...(isServer ? { pageCount: Math.max(1, Math.ceil(total / pageSize)) } : {}),
    initialState: { pagination: { pageSize } },
  });

  const contentWidth = useTableContentWidth(tableScrollRef, data, displayColumns);

  const syncScroll = useCallback((source: 'table' | 'floating') => {
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
  }, []);

  const totalPages = isServer
    ? Math.max(1, Math.ceil(total / pageSize))
    : table.getPageCount();

  const currentPage = isServer ? page : table.getState().pagination.pageIndex + 1;

  const pageNumbers = useMemo(
    () => computePageNumbers(totalPages, currentPage),
    [totalPages, currentPage],
  );

  const showFloatingScroll =
    contentWidth > 0 && tableScrollRef.current
      ? contentWidth > tableScrollRef.current.clientWidth
      : false;

  const groupColumnMeta = useMemo(() => {
    if (!clientGroupByColumnKey) return null;
    return columns.find(col => col.key === clientGroupByColumnKey) ?? null;
  }, [columns, clientGroupByColumnKey]);

  const clientGroupSections = useMemo((): ClientGroupSection[] | null => {
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
  }, [isServer, clientGroupByColumnKey, groupColumnMeta, table]);

  const showInitialSkeleton = loading && data.length === 0;

  if (showInitialSkeleton) {
    return <UnifiedReportTableSkeleton />;
  }

  if (data.length === 0) {
    return <UnifiedReportTableEmpty isServer={isServer} />;
  }

  const goToPage = (p: number) => {
    if (isServer) onPageChange?.(p);
    else table.setPageIndex(p - 1);
  };

  return (
    <div
      className={
        fillHeight ? 'flex h-full flex-col overflow-hidden' : 'flex flex-col overflow-hidden'
      }
    >
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
            <UnifiedReportTableHead
              headerGroups={table.getHeaderGroups()}
              sortable={sortable}
              serverHeaderSort={serverHeaderSort}
              serverSortColumn={serverSortColumn}
              serverSortDirection={serverSortDirection}
              onServerSortClick={onServerSortClick}
            />
            <tbody>
              {isServer ? (
                <UnifiedReportTableBodyServer
                  data={data}
                  columns={columns}
                  page={page}
                  numericKeys={numericKeys}
                />
              ) : clientGroupSections ? (
                <UnifiedReportTableBodyClientGrouped
                  sections={clientGroupSections}
                  displayColumnsLength={displayColumns.length}
                  groupColumnMeta={groupColumnMeta}
                  numericKeys={numericKeys}
                />
              ) : (
                <UnifiedReportTableBodyClientFlat
                  rows={table.getRowModel().rows}
                  numericKeys={numericKeys}
                />
              )}
            </tbody>
          </table>
        </div>

        {showFloatingScroll && (
          <UnifiedReportTableFloatingScroll
            floatingScrollRef={floatingScrollRef}
            contentWidth={contentWidth}
            onScroll={() => syncScroll('floating')}
          />
        )}
      </div>

      <UnifiedReportTablePagination
        isServer={isServer}
        totalPages={totalPages}
        currentPage={currentPage}
        pageNumbers={pageNumbers}
        pageSize={pageSize}
        table={table}
        onPageSizeChange={onPageSizeChange}
        goToPage={goToPage}
      />
    </div>
  );
}
