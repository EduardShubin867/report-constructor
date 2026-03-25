'use client';

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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-100 border-b border-gray-200" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`h-9 border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white/60 p-12 text-center">
        <p className="text-sm text-gray-400">Нет данных по выбранным фильтрам</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 text-sm">
        <span className="text-gray-600">
          <strong className="text-gray-900">{total.toLocaleString('ru-RU')}</strong> записей
          {totalPages > 1 && <span className="text-gray-400"> · стр. {page}/{totalPages}</span>}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Строк:
          <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-100">
              {colDefs.map(col => (
                <th key={col.key} className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-xs tracking-wide">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr key={row.ID as string ?? i} className="hover:bg-gray-50/80 transition-colors">
                {colDefs.map(col => (
                  <td key={col.key}
                    className={`px-3 py-2 text-gray-700 whitespace-nowrap text-xs ${col.type === 'number' ? 'text-right font-mono tabular-nums' : ''}`}>
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
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/80">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
                  className={`w-7 h-7 text-xs rounded-md transition-colors ${p === page ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
