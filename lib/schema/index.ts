/**
 * Central schema registry.
 *
 * All sources are stored in data/sources.json and loaded at runtime.
 * Call invalidateSchemaCache() after saving/deleting a source so
 * subsequent requests pick up the changes without a server restart.
 */

import type { DataSource } from './types';
import { loadDynamicSources } from './store';
import { effectiveColumnFilterTier } from '@/lib/report-filter-tier';

// ── In-memory cache ──────────────────────────────────────────────────────────

let _cache: DataSource[] | null = null;

export function invalidateSchemaCache(): void {
  _cache = null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** All registered data sources. Cached per process. */
export function getDataSources(): DataSource[] {
  if (!_cache) {
    _cache = loadDynamicSources();
  }
  return _cache;
}

/** All table names across all sources — for sql-validator whitelist */
export function getAllowedTables(): Set<string> {
  return new Set(getDataSources().flatMap(ds => ds.tables.map(t => t.name)));
}

/** Sources marked as available in the manual report UI */
export function getManualReportSources(): DataSource[] {
  return getDataSources().filter(s => s.manualReport === true);
}

/** Filterable column names across all sources — for list_column_values skill */
export function getFilterableColumns(): Set<string> {
  return new Set(
    getDataSources()
      .flatMap(ds => ds.tables)
      .flatMap(t => t.columns)
      .filter(c => effectiveColumnFilterTier(c) != null)
      .map(c => c.name),
  );
}

// Proxy-based live Sets so existing imports of ALLOWED_TABLES / FILTERABLE_COLUMNS
// still work and reflect dynamic sources without code changes in consumers.
function makeLiveSetProxy(getter: () => Set<string>): Set<string> {
  return new Proxy(new Set<string>(), {
    get(_, prop) {
      const live = getter();
      const val = (live as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === 'function'
        ? (val as (...args: unknown[]) => unknown).bind(live)
        : val;
    },
    has(_, value) {
      return getter().has(value as string);
    },
  });
}

/** All table names across all registered sources — for sql-validator whitelist */
export const ALLOWED_TABLES: Set<string> = makeLiveSetProxy(getAllowedTables);

/** Filterable column names across all sources — for list_column_values skill */
export const FILTERABLE_COLUMNS: Set<string> = makeLiveSetProxy(getFilterableColumns);

export type { DataSource, TableSchema, ColumnSchema, ForeignKey, ColumnType, DbConnection } from './types';
