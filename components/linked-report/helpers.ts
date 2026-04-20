import type { ManualReportSourcePayload } from '@/lib/report-filters-data';

export function buildDefaultColumns(payload: ManualReportSourcePayload, joinField: string): string[] {
  const preferred = [joinField];
  for (const col of payload.columns) {
    if (col.key !== joinField) preferred.push(col.key);
    if (preferred.length >= 4) break;
  }
  return [...new Set(preferred)].filter(Boolean);
}

export function getColumnLabel(payload: ManualReportSourcePayload, key: string): string {
  return payload.columns.find(c => c.key === key)?.label ?? key;
}
