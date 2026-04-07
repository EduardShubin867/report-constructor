'use client';

import { resolveAiColumnHeader } from '@/lib/column-header';

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

interface SqlResultTableProps {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  warnings?: string[];
}

export default function SqlResultTable({ data, columns, rowCount, warnings }: SqlResultTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white/60 p-10 text-center">
        <p className="text-sm text-gray-400">Запрос выполнен, но данных нет</p>
      </div>
    );
  }

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
        {warnings?.map(w => (
          <span key={w} className="text-xs text-amber-600">{w}</span>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-100">
              {columns.map(col => (
                <th key={col} className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-xs tracking-wide">
                  {resolveAiColumnHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                {columns.map(col => (
                  <td key={col}
                    className={`px-3 py-2 text-gray-700 whitespace-nowrap text-xs ${isNumericColumn(data, col) ? 'text-right font-mono tabular-nums' : ''}`}>
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
