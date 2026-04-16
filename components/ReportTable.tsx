'use client';

import AppSelect from '@/components/ui/app-select';
import { ALL_COLUMNS } from '@/lib/report-columns';

interface ReportTableProps {
  data: Record<string, unknown>[];
  columns: string[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [50, 100, 200];
const PAGE_SIZE_OPTIONS = PAGE_SIZES.map(size => ({
  value: String(size),
  label: String(size),
}));

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '';
  if (type === 'date' && typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('ru-RU');
  }
  if (type === 'number' && typeof value === 'number') {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  return String(value);
}

export default function ReportTable({
  data, columns, total, page, pageSize, loading, onPageChange, onPageSizeChange,
}: ReportTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const colDefs = columns.map(k => ALL_COLUMNS.find(c => c.key === k)!).filter(Boolean);

  if (loading) {
    return (
      <div className="ui-panel overflow-hidden rounded-2xl">
        <div className="animate-pulse">
          <div className="h-10 border-b border-outline-variant/10 bg-surface-container-low" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`h-9 border-b border-outline-variant/10 ${i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/50'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="ui-panel rounded-2xl p-12 text-center">
        <p className="text-sm text-on-surface-variant">Нет данных по выбранным фильтрам</p>
      </div>
    );
  }

  return (
    <div className="ui-panel overflow-hidden rounded-2xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low/45 px-4 py-2.5 text-sm">
        <span className="text-on-surface-variant">
          <strong className="text-on-surface">{total.toLocaleString('ru-RU')}</strong> записей
          {totalPages > 1 && <span className="text-on-surface-variant/70"> · стр. {page}/{totalPages}</span>}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          Строк:
          <AppSelect
            value={String(pageSize)}
            onValueChange={value => onPageSizeChange(Number(value))}
            options={PAGE_SIZE_OPTIONS}
            triggerClassName="ui-field h-7 min-w-16 rounded-lg px-2 py-1 text-xs"
            contentClassName="min-w-16"
            labelClassName="text-xs"
            ariaLabel="Выбор числа строк на странице"
          />
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low/80">
              {colDefs.map(col => (
                <th key={col.key} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {data.map((row, i) => (
              <tr
                key={row.ID != null && row.ID !== '' ? String(row.ID) : `p${page}-r${i}`}
                className="transition-colors hover:bg-surface-container-low"
              >
                {colDefs.map(col => (
                  <td key={col.key}
                    className={`whitespace-nowrap px-5 py-2.5 text-xs text-on-surface ${col.type === 'number' ? 'text-right font-mono tabular-nums' : ''}`}>
                    {formatValue(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low px-4 py-2">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            className="ui-button-secondary rounded-lg px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40">
            ← Назад
          </button>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <button key={p} type="button" onClick={() => onPageChange(p)}
                  className={`h-7 w-7 rounded-lg text-xs transition-colors ${p === page ? 'ui-chip-accent font-semibold text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
            className="ui-button-secondary rounded-lg px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40">
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
