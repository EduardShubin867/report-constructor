import { ArrowLeft, ArrowRight } from 'lucide-react';
import AppSelect from '@/components/ui/app-select';
import type { Table } from '@tanstack/react-table';
import { PAGE_SIZE_OPTIONS } from './constants';

type Props = {
  isServer: boolean;
  totalPages: number;
  currentPage: number;
  pageNumbers: number[];
  pageSize: number;
  table: Table<Record<string, unknown>>;
  onPageSizeChange?: (size: number) => void;
  goToPage: (p: number) => void;
};

export function UnifiedReportTablePagination({
  isServer,
  totalPages,
  currentPage,
  pageNumbers,
  pageSize,
  table,
  onPageSizeChange,
  goToPage,
}: Props) {
  if (totalPages <= 1) return null;

  return (
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
  );
}
