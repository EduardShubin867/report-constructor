/**
 * Server-only helpers for column visibility.
 * Do NOT import this file from client components — it reads data/sources.json via getDataSources().
 *
 * All functions are source-aware: pass a sourceId to get columns for a specific DataSource.
 * Column defs are derived from the schema; labels/sqlExpr for known columns come from COLUMN_LABEL_MAP.
 */
import { getDataSources } from '@/lib/schema';
import { ALL_COLUMNS, COLUMN_LABEL_MAP, COLUMN_BY_SQL_EXPR, type ColumnDef, type ColumnType } from '@/lib/report-columns';
import type { DataSource, TableSchema } from '@/lib/schema/types';

/** Map schema type ('bit') to ColumnDef type ('boolean'). */
function toDefType(t: string): ColumnType {
  return t === 'bit' ? 'boolean' : (t as ColumnType);
}

/** Find the main (data) table in a DataSource — the first table with columns. */
function getMainTable(source: DataSource): TableSchema | null {
  return source.tables.find(t => t.columns.length > 0) ?? null;
}

/**
 * Returns the full list of visible ColumnDef[] for a given source.
 *
 * Algorithm:
 * 1. Main table columns (not hidden):
 *    - Label: COLUMN_LABEL_MAP[col.name].label → col.label (schema) → col.name
 *    - groupable: from schema col.groupable
 *    - type: from schema (bit → boolean)
 * 2. FK-derived columns (from foreignKeys[].targetFields):
 *    - sqlExpr: `[alias].[field]`
 *    - If COLUMN_BY_SQL_EXPR has this expr → use its key/label (nice OSAGO names)
 *    - Otherwise → key = `${alias}_${field}`, label = `${targetTable}: ${field}`
 *    - joinKey = fk.alias
 */
export function getVisibleColumnDefs(sourceId: string): ColumnDef[] {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return [];

  const table = getMainTable(source);
  if (!table) return [];

  const result: ColumnDef[] = [];

  // Main table columns
  for (const col of table.columns) {
    if (col.hidden) continue;
    const known = COLUMN_LABEL_MAP.get(col.name);
    result.push({
      key: col.name,
      label: col.label ?? known?.label ?? col.name,
      type: toDefType(col.type),
      groupable: col.groupable,
    });
  }

  // FK-derived columns
  for (const fk of table.foreignKeys ?? []) {
    for (const field of fk.targetFields) {
      const sqlExpr = `[${fk.alias}].[${field}]`;
      const known = COLUMN_BY_SQL_EXPR.get(sqlExpr);
      result.push({
        key: known?.key ?? `${fk.alias}_${field}`,
        label: known?.label ?? `${fk.targetTable}: ${field}`,
        type: known?.type ?? 'string',
        joinKey: fk.alias,
        sqlExpr,
        groupable: known?.groupable,
      });
    }
  }

  return result;
}

function isDimensionType(t: ColumnType): boolean {
  return t === 'string' || t === 'date' || t === 'boolean';
}

/**
 * Измерения для группировки: нечисловые колонки журнала + поля справочников по FK
 * (учитывается foreignKeys[].groupByFields: не задано = все targetFields, [] = ни одного).
 */
export function getGroupByColumnDefs(sourceId: string): ColumnDef[] {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return [];

  const table = getMainTable(source);
  if (!table) return [];

  const result: ColumnDef[] = [];

  for (const col of table.columns) {
    if (col.hidden) continue;
    const type = toDefType(col.type);
    if (!isDimensionType(type)) continue;
    const known = COLUMN_LABEL_MAP.get(col.name);
    result.push({
      key: col.name,
      label: col.label ?? known?.label ?? col.name,
      type,
      groupable: col.groupable,
    });
  }

  for (const fk of table.foreignKeys ?? []) {
    const fields =
      fk.groupByFields !== undefined
        ? fk.groupByFields.filter(f => fk.targetFields.includes(f))
        : fk.targetFields;

    for (const field of fields) {
      const sqlExpr = `[${fk.alias}].[${field}]`;
      const known = COLUMN_BY_SQL_EXPR.get(sqlExpr);
      const type = known?.type ?? 'string';
      if (!isDimensionType(type)) continue;
      result.push({
        key: known?.key ?? `${fk.alias}_${field}`,
        label: known?.label ?? `${fk.targetTable}: ${field}`,
        type,
        joinKey: fk.alias,
        sqlExpr,
        groupable: known?.groupable ?? true,
      });
    }
  }

  return result;
}

/**
 * Returns JOIN definitions for a source: alias → { sql }.
 * Derived from foreignKeys[].{alias, joinSql}.
 */
export function getSourceJoinDefs(sourceId: string): Record<string, { sql: string }> {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return {};
  const table = getMainTable(source);
  if (!table) return {};
  const joins: Record<string, { sql: string }> = {};
  for (const fk of table.foreignKeys ?? []) {
    joins[fk.alias] = { sql: fk.joinSql };
  }
  return joins;
}

/** Keys of visible columns for a source — used for server-side allowlist validation. */
export function getVisibleColumnKeys(sourceId: string): Set<string> {
  return new Set(getVisibleColumnDefs(sourceId).map(c => c.key));
}

/**
 * Returns the main table SQL reference for a source, e.g. `[dbo].[Журнал_ОСАГО_Маржа] m`.
 */
export function getSourceTableRef(sourceId: string): string {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return '';
  const table = getMainTable(source);
  if (!table) return '';
  const alias = table.alias ?? 'm';
  return `[${source.schema}].[${table.name}] ${alias}`;
}

/**
 * Returns the main table alias for a source (default 'm').
 */
export function getSourceTableAlias(sourceId: string): string {
  const source = getDataSources().find(s => s.id === sourceId);
  const table = source ? getMainTable(source) : null;
  return table?.alias ?? 'm';
}

/**
 * Returns all columns with periodFilter: true for a source.
 * Each entry has key (column name), label, and type ('date' | 'number').
 */
export function getPeriodFilterColumns(
  sourceId: string,
): Array<{ key: string; label: string; type: 'date' | 'number' }> {
  const source = getDataSources().find(s => s.id === sourceId);
  if (!source) return [];
  const table = getMainTable(source);
  if (!table) return [];
  return table.columns
    .filter(c => c.periodFilter && (c.type === 'date' || c.type === 'number'))
    .map(c => {
      const known = COLUMN_LABEL_MAP.get(c.name);
      return {
        key: c.name,
        label: c.label ?? known?.label ?? c.name,
        type: c.type as 'date' | 'number',
      };
    });
}

// ---------------------------------------------------------------------------
// Legacy export — used during transition. Remove once all callers pass sourceId.
// ---------------------------------------------------------------------------
/** @deprecated Use getVisibleColumnDefs(sourceId) instead. Falls back to ALL_COLUMNS. */
export function getVisibleColumnDefsLegacy(): ColumnDef[] {
  const sources = getDataSources();
  const hiddenNames = new Set<string>();
  const schemaColumns: ColumnDef[] = [];
  const knownKeys = new Set(ALL_COLUMNS.map(c => c.key));

  for (const ds of sources) {
    for (const table of ds.tables) {
      if (table.columns.length === 0) continue;
      for (const col of table.columns) {
        if (col.hidden) {
          hiddenNames.add(col.name);
          continue;
        }
        if (!knownKeys.has(col.name)) {
          schemaColumns.push({ key: col.name, label: col.name, type: toDefType(col.type) });
        }
      }
    }
  }

  return [...ALL_COLUMNS.filter(c => c.joinKey || !hiddenNames.has(c.key)), ...schemaColumns];
}
