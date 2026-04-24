import type { ReportColumn } from './types';
import { formatValue } from './utils';

type Props = {
  data: Record<string, unknown>[];
  columns: ReportColumn[];
  page: number;
  numericKeys: Set<string>;
};

export function UnifiedReportTableBodyServer({ data, columns, page, numericKeys }: Props) {
  return (
    <>
      {data.map((row, i) => (
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
      ))}
    </>
  );
}
