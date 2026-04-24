import { flexRender, type HeaderGroup } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ServerSortDirection } from './types';

type Props = {
  headerGroups: HeaderGroup<Record<string, unknown>>[];
  sortable: boolean;
  serverHeaderSort: boolean;
  serverSortColumn: string | null;
  serverSortDirection: ServerSortDirection;
  onServerSortClick?: (columnKey: string) => void;
};

export function UnifiedReportTableHead({
  headerGroups,
  sortable,
  serverHeaderSort,
  serverSortColumn,
  serverSortDirection,
  onServerSortClick,
}: Props) {
  return (
    <thead>
      {headerGroups.map(hg => (
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
  );
}
