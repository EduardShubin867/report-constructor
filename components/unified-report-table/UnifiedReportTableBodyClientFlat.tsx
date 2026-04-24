import { flexRender, type Row } from '@tanstack/react-table';

type Props = {
  rows: Row<Record<string, unknown>>[];
  numericKeys: Set<string>;
};

export function UnifiedReportTableBodyClientFlat({ rows, numericKeys }: Props) {
  return (
    <>
      {rows.map(row => (
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
    </>
  );
}
