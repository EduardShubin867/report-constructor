import type { ColumnDef } from '@/lib/report-columns';
import type { FilterDef, ManualReportSourcePayload, SourceFilterOptions } from '@/lib/report-filters-data';

import { emptyBootstrapBySourceId } from './constants';

export function cloneFilters(f: Record<string, string[]>): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const k of Object.keys(f)) o[k] = [...(f[k] ?? [])];
  return o;
}

export function coerceBootstrapMap(
  value: Record<string, ManualReportSourcePayload> | null | undefined,
): Record<string, ManualReportSourcePayload> {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) return value;
  return emptyBootstrapBySourceId;
}

export function normalizeFilterOptions(fo: SourceFilterOptions): SourceFilterOptions {
  return {
    ...fo,
    filterDefs: fo.filterDefs.map((fd: FilterDef & { tier?: 'primary' | 'secondary' }) => ({
      ...fd,
      tier: fd.tier ?? 'primary',
    })),
  };
}

export function fallbackGroupByColumns(columns: ColumnDef[]): ColumnDef[] {
  return columns.filter(c => c.type === 'string' || c.type === 'date' || c.type === 'boolean');
}

export function mergeGroupByColumnsPayload(boot: ManualReportSourcePayload): ColumnDef[] {
  if (boot.groupByColumns !== undefined) return boot.groupByColumns;
  return fallbackGroupByColumns(boot.columns);
}
