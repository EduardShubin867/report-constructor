import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { getDataSources } from '@/lib/schema';
import { BASE_PATH } from '@/lib/constants';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';
import type { ColumnDef } from '@/lib/report-columns';
import type { DataSource, TableSchema } from '@/lib/schema/types';

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
  const schema = source.schema;
  const tableName = `[${schema}].[${table.name}]`;
  const t = TIMEOUT.QUERY;

  const filterDefs: FilterDef[] = [];
  const queries: { key: string; sql: string }[] = [];

  // Direct filters — filterable columns
  for (const col of table.columns) {
    if (!col.filterable || col.hidden) continue;
    const label = col.label ?? col.name;
    filterDefs.push({ key: col.name, label, type: 'direct' });
    queries.push({
      key: col.name,
      sql: `SELECT DISTINCT [${col.name}] AS v FROM ${tableName} WHERE [${col.name}] IS NOT NULL ORDER BY [${col.name}]`,
    });
  }

  // FK filters — foreignKeys with filterConfig
  for (const fk of table.foreignKeys ?? []) {
    if (!fk.filterConfig) continue;
    const { displayField, label, targetWhere } = fk.filterConfig;
    const targetTableRef = `[${schema}].[${fk.targetTable}]`;
    const whereClause = targetWhere ? ` WHERE ${targetWhere}` : '';
    filterDefs.push({ key: fk.alias, label, type: 'fk' });
    queries.push({
      key: fk.alias,
      sql: `SELECT DISTINCT [${displayField}] AS v FROM ${targetTableRef}${whereClause} ORDER BY [${displayField}]`,
    });
  }

  // Date filter column
  const dateFilterCol = table.columns.find(c => c.dateFilter)?.name ?? null;

  // Execute all queries in parallel
  const results = await Promise.all(
    queries.map(({ key, sql: querySql }) =>
      queryWithTimeout(pool.request(), querySql, t)
        .then(r => ({ key, values: r.recordset.map(row => String(row['v'])) }))
        .catch(() => ({ key, values: [] })),
    ),
  );

  const options: Record<string, string[]> = {};
  for (const { key, values } of results) {
    options[key] = values;
  }

  return { filterDefs, options, dateFilterCol };
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
 * - Direct filters: columns with filterable: true → SELECT DISTINCT [col] FROM [table]
 * - FK filters: foreignKeys with filterConfig → SELECT DISTINCT [displayField] FROM [targetTable] [WHERE targetWhere]
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
