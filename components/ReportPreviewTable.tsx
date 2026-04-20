'use client';

/** Compact HTML table for live report preview (first rows), shared by manual and linked reports. */
export default function ReportPreviewTable({
  data,
  columns,
}: {
  data: Record<string, unknown>[];
  columns: { key: string; label: string; type: string }[];
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-outline-variant/12 bg-surface-container-low/40">
            {columns.map(col => (
              <th key={col.key} className="whitespace-nowrap px-3 py-1.5 text-left text-[11.5px] font-medium text-on-surface-variant">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-outline-variant/10 hover:bg-surface-container-low/30">
              {columns.map(col => (
                <td key={col.key} className="whitespace-nowrap px-3 py-1.5 text-[12px] text-on-surface">
                  {row[col.key] != null ? String(row[col.key]) : <span className="text-on-surface-variant/50">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
