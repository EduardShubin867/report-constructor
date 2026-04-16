import type { ColumnDef } from '@/lib/report-columns';

const AGG_COUNT_KEY = '__linkedAggCount';

function stableBucketKey(value: unknown): string {
  if (value == null) return '\0__null__';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sumNumericColumn(rows: Record<string, unknown>[], colKey: string): number {
  let sum = 0;
  for (const row of rows) {
    const v = row[colKey];
    if (v === null || v === undefined || v === '') continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) sum += n;
  }
  return sum;
}

function firstNonEmptyValue(rows: Record<string, unknown>[], colKey: string): unknown {
  for (const row of rows) {
    const v = row[colKey];
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return rows[0]?.[colKey];
}

export const LINKED_AGG_COUNT_COLUMN: ColumnDef = {
  key: AGG_COUNT_KEY,
  label: 'Строк в группе',
  type: 'number',
  integer: true,
};

/**
 * Схлопывает детальные строки сводного отчёта: одна строка на уникальное значение groupKey.
 * Числовые колонки суммируются, остальные — первое непустое значение в группе.
 */
export function aggregateLinkedMergedRows(
  rows: Record<string, unknown>[],
  columnDefs: ColumnDef[],
  groupKey: string,
): Record<string, unknown>[] {
  if (rows.length === 0) return [];

  const order: string[] = [];
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const sk = stableBucketKey(row[groupKey]);
    if (!buckets.has(sk)) {
      buckets.set(sk, []);
      order.push(sk);
    }
    buckets.get(sk)!.push(row);
  }

  return order.map(sk => {
    const bucket = buckets.get(sk)!;
    const next: Record<string, unknown> = {
      [AGG_COUNT_KEY]: bucket.length,
    };
    for (const col of columnDefs) {
      if (col.key === groupKey) {
        next[col.key] = firstNonEmptyValue(bucket, col.key);
        continue;
      }
      if (col.type === 'number') {
        next[col.key] = sumNumericColumn(bucket, col.key);
      } else {
        next[col.key] = firstNonEmptyValue(bucket, col.key);
      }
    }
    return next;
  });
}

export function columnsWithAggCount(columnDefs: ColumnDef[]): ColumnDef[] {
  if (columnDefs.some(c => c.key === AGG_COUNT_KEY)) return columnDefs;
  return [...columnDefs, LINKED_AGG_COUNT_COLUMN];
}
