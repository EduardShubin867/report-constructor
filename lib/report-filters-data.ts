import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { getDataSources } from '@/lib/schema';
import { BASE_PATH } from '@/lib/constants';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';
import type { ColumnDef } from '@/lib/report-columns';
import type { DataSource, TableSchema } from '@/lib/schema/types';
import { buildFilterDescriptors } from '@/lib/report-filter-tier';

/** Next.js Data Cache TTL for DISTINCT filter-option SQL (seconds). */
export const REPORT_FILTER_OPTIONS_REVALIDATE = 300;

/**
 * Pass to `revalidateTag()` to drop all cached `loadSourceFilterOptions` entries
 * (every `sourceId` shares this tag).
 */
export const REPORT_FILTER_OPTIONS_CACHE_TAG = 'manual-report-filter-options';

export interface FilterDef {
  /** Column name (direct) or FK alias (fk) — used as key in filter values Record */
  key: string;
  /** Human-readable label for the filter control */
  label: string;
  /** 'direct' = plain column IN filter; 'fk' = reference table lookup */
  type: 'direct' | 'fk';
  /** primary — опции в bootstrap; secondary — подгрузка при открытии дропдауна */
  tier: 'primary' | 'secondary';
}

export interface SourceFilterOptions {
  filterDefs: FilterDef[];
  options: Record<string, string[]>;
  /** Column name used for date-range filter, or null if none */
  dateFilterCol: string | null;
}

function getMainTable(source: DataSource): TableSchema | null {
  return source.tables.find(t => t.columns.length > 0) ?? null;
}

async function loadSourceFilterOptionsUncached(sourceId: string): Promise<SourceFilterOptions> {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return { filterDefs: [], options: {}, dateFilterCol: null };

  const table = getMainTable(source);
  if (!table) return { filterDefs: [], options: {}, dateFilterCol: null };

  const pool = await getPool();
  const t = TIMEOUT.QUERY;

  const descriptors = buildFilterDescriptors(source);
  const filterDefs: FilterDef[] = descriptors.map(d => ({
    key: d.key,
    label: d.label,
    type: d.type,
    tier: d.tier,
  }));

  const primaryQueries = descriptors.filter(d => d.tier === 'primary');

  const results = await Promise.all(
    primaryQueries.map(({ key, sql: querySql }) =>
      queryWithTimeout(pool.request(), querySql, t)
        .then(r => ({ key, values: r.recordset.map(row => String(row['v'])) }))
        .catch(() => ({ key, values: [] })),
    ),
  );

  const options: Record<string, string[]> = {};
  for (const { key, values } of results) {
    options[key] = values;
  }
  for (const d of descriptors) {
    if (d.tier === 'secondary' && options[d.key] === undefined) {
      options[d.key] = [];
    }
  }

  const dateFilterCol = table.columns.find(c => c.dateFilter)?.name ?? null;

  return { filterDefs, options, dateFilterCol };
}

/** Одна DISTINCT-выборка для ключа фильтра (для lazy-дропдаунов и повторной подгрузки). */
export async function loadSingleFilterKeyValues(sourceId: string, key: string): Promise<string[]> {
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

const loadSourceFilterOptionsCached = unstable_cache(
  async (sourceId: string) => loadSourceFilterOptionsUncached(sourceId),
  ['loadSourceFilterOptions'],
  {
    revalidate: REPORT_FILTER_OPTIONS_REVALIDATE,
    tags: [REPORT_FILTER_OPTIONS_CACHE_TAG],
  },
);

/**
 * Loads filter definitions and option values for a data source.
 *
 * - Direct / FK: см. filterTier — только primary выполняют DISTINCT при загрузке; secondary — пустой массив до `/api/report/filter-options`.
 * - dateFilterCol: name of the column with dateFilter: true (for date-range UI)
 *
 * Results are cached in the Next.js Data Cache per `sourceId` (see `REPORT_FILTER_OPTIONS_REVALIDATE`).
 */
export async function loadSourceFilterOptions(sourceId: string): Promise<SourceFilterOptions> {
  return loadSourceFilterOptionsCached(sourceId);
}

/**
 * Вызывать после изменения источника в админке (колонки, filterable, FK-фильтры и т.д.),
 * чтобы сбросить Next Data Cache по DISTINCT-фильтрам и пересобрать RSC ручного отчёта.
 */
export function revalidateManualReportCaches(): void {
  revalidateTag(REPORT_FILTER_OPTIONS_CACHE_TAG, { expire: 0 });
  revalidatePath(`${BASE_PATH}/reports/manual`);
}

/** Server-prefetched bundle for one manual-report source (columns + filter dropdown data). */
export type ManualReportSourcePayload = {
  columns: ColumnDef[];
  filterOptions: SourceFilterOptions;
  /** True when `loadSourceFilterOptions` threw — UI may retry via `/api/report/filters`. */
  filterError: boolean;
};
