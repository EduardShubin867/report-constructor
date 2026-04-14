import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { getDataSources } from '@/lib/schema';
import { BASE_PATH } from '@/lib/constants';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';
import type { ColumnDef } from '@/lib/report-columns';
import type { DataSource, TableSchema } from '@/lib/schema/types';
import { buildFilterDescriptors } from '@/lib/report-filter-tier';
import { getPeriodFilterColumns } from '@/lib/visible-columns';

/** Next.js Data Cache TTL for on-demand DISTINCT filter-value SQL (seconds). */
export const REPORT_FILTER_OPTIONS_REVALIDATE = 300;

/**
 * Pass to `revalidateTag()` to drop all cached lazy filter-value entries.
 * Every sourceId/key pair shares this tag for simple invalidation after schema edits.
 */
export const REPORT_FILTER_OPTIONS_CACHE_TAG = 'manual-report-filter-options';

export interface FilterDef {
  /** Column name (direct) or FK alias (fk) — used as key in filter values Record */
  key: string;
  /** Human-readable label for the filter control */
  label: string;
  /** 'direct' = plain column IN filter; 'fk' = reference table lookup */
  type: 'direct' | 'fk';
  /** primary / secondary controls UI grouping; values are loaded lazily for both tiers */
  tier: 'primary' | 'secondary';
}

export interface PeriodFilterCol {
  /** Column name — used as key in periodFilters Record */
  key: string;
  /** Human-readable label for the range control */
  label: string;
  /** Controls input type in the UI: date picker or number */
  type: 'date' | 'number';
}

export interface SourceFilterOptions {
  filterDefs: FilterDef[];
  options: Record<string, string[]>;
  /** Columns available as period (range) filters */
  periodFilterCols: PeriodFilterCol[];
}

function getMainTable(source: DataSource): TableSchema | null {
  return source.tables.find(t => t.columns.length > 0) ?? null;
}

function buildSourceFilterOptions(sourceId: string): SourceFilterOptions {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return { filterDefs: [], options: {}, periodFilterCols: [] };

  const table = getMainTable(source);
  if (!table) return { filterDefs: [], options: {}, periodFilterCols: [] };

  const descriptors = buildFilterDescriptors(source);
  const filterDefs: FilterDef[] = descriptors.map(d => ({
    key: d.key,
    label: d.label,
    type: d.type,
    tier: d.tier,
  }));

  const options: Record<string, string[]> = Object.fromEntries(
    descriptors.map(d => [d.key, [] as string[]]),
  );

  const periodFilterCols = getPeriodFilterColumns(sourceId);

  return { filterDefs, options, periodFilterCols };
}

/** Одна DISTINCT-выборка для ключа фильтра (для lazy-дропдаунов). */
async function loadSingleFilterKeyValuesUncached(sourceId: string, key: string): Promise<string[]> {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return [];
  const desc = buildFilterDescriptors(source).find(d => d.key === key);
  if (!desc) return [];
  const pool = await getPool();
  try {
    const r = await queryWithTimeout(pool.request(), desc.sql, TIMEOUT.QUERY);
    return r.recordset.map(row => String(row['v']));
  } catch {
    return [];
  }
}

const loadSingleFilterKeyValuesCached = unstable_cache(
  async (sourceId: string, key: string) => loadSingleFilterKeyValuesUncached(sourceId, key),
  ['loadSingleFilterKeyValues'],
  {
    revalidate: REPORT_FILTER_OPTIONS_REVALIDATE,
    tags: [REPORT_FILTER_OPTIONS_CACHE_TAG],
  },
);

/**
 * Loads filter definitions and option values for a data source.
 *
 * - Direct / FK filter values are loaded lazily on dropdown open via `/api/report/filter-options`.
 * - periodFilterCols: columns with periodFilter: true (for range inputs in UI)
 */
export async function loadSourceFilterOptions(sourceId: string): Promise<SourceFilterOptions> {
  return buildSourceFilterOptions(sourceId);
}

/** Cached lazy values for one dropdown (`sourceId` + `key`). */
export async function loadSingleFilterKeyValues(sourceId: string, key: string): Promise<string[]> {
  return loadSingleFilterKeyValuesCached(sourceId, key);
}

/**
 * Вызывать после изменения источника в админке (колонки, фильтры, FK и т.д.),
 * чтобы сбросить lazy-cache по DISTINCT-значениям и пересобрать страницу ручного отчёта.
 */
export function revalidateManualReportCaches(): void {
  revalidateTag(REPORT_FILTER_OPTIONS_CACHE_TAG, { expire: 0 });
  revalidatePath(`${BASE_PATH}/reports/manual`);
}

/** Server-prefetched bundle for one manual-report source (columns + filter dropdown data). */
export type ManualReportSourcePayload = {
  columns: ColumnDef[];
  /** Измерения для группировки (основная таблица + выбранные поля FK). */
  groupByColumns?: ColumnDef[];
  filterOptions: SourceFilterOptions;
};
