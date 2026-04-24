import type { ColumnDef } from '@tanstack/react-table';
import type { ReportColumn } from './types';
import { formatValue } from './utils';

export function buildTanstackColumnDefs(
  displayColumns: ReportColumn[],
): ColumnDef<Record<string, unknown>>[] {
  return displayColumns.map(col => ({
    accessorKey: col.key,
    header: col.label,
    cell: info => formatValue(info.getValue(), col.type, col.integer),
  }));
}
