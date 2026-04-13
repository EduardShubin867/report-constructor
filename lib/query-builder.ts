import { sql } from './db';
import { getVisibleColumnDefs, getVisibleColumnKeys, getSourceJoinDefs } from './visible-columns';
import { effectiveColumnFilterTier } from './report-filter-tier';
import { getDataSources } from './schema';
import type { DataSource, TableSchema } from './schema/types';
import { CONTRACT_COUNT_COLUMN_KEY } from './report-columns';

export { CONTRACT_COUNT_COLUMN_KEY };

// ── Request interface ────────────────────────────────────────────────────────

export interface GenericReportRequest {
  sourceId: string;
  columns: string[];
  /** columnKey or fkAlias → selected values */
  filters: Record<string, string[]>;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: string[];
  /** В режиме группировки: добавлять ли COUNT(*) как «КоличествоДоговоров». По умолчанию true. */
  includeContractCount?: boolean;
  /** Серверная сортировка: ключ колонки из whitelist (в т.ч. КоличествоДоговоров при группировке). */
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}


// ── Internal helpers ─────────────────────────────────────────────────────────

function getSource(sourceId: string): DataSource {
  const src = getDataSources().find(s => s.id === sourceId);
  if (!src) throw new Error(`Source not found: ${sourceId}`);
  return src;
}

function getMainTable(source: DataSource): TableSchema {
  const t = source.tables.find(tbl => tbl.columns.length > 0);
  if (!t) throw new Error(`No main table in source: ${source.id}`);
  return t;
}

// ── Column validation ────────────────────────────────────────────────────────

/** Validate and return allowed column keys for a source. */
export function safeColumns(requested: string[], sourceId: string): string[] {
  const visible = getVisibleColumnKeys(sourceId);
  return requested.filter(c => visible.has(c));
}

/** Сортировка детального отчёта: только выбранные видимые колонки. */
export function safeDetailSortColumn(
  sortColumn: string | undefined,
  selectedCols: string[],
  sourceId: string,
): string | null {
  if (!sortColumn) return null;
  if (!selectedCols.includes(sortColumn)) return null;
  const visible = getVisibleColumnKeys(sourceId);
  return visible.has(sortColumn) ? sortColumn : null;
}

/** Сортировка сгруппированного отчёта: измерения, суммы по выбранным числовым колонкам, опционально количество договоров. */
export function safeGroupedSortColumn(
  sortColumn: string | undefined,
  selectedCols: string[],
  groupBy: string[],
  sourceId: string,
  includeContractCount: boolean,
): string | null {
  if (!sortColumn) return null;
  if (includeContractCount && sortColumn === CONTRACT_COUNT_COLUMN_KEY) {
    return CONTRACT_COUNT_COLUMN_KEY;
  }
  const visible = getVisibleColumnKeys(sourceId);
  if (!visible.has(sortColumn)) return null;
  const groupSet = new Set(groupBy);
  if (groupSet.has(sortColumn)) return sortColumn;
  const defs = getVisibleColumnDefs(sourceId);
  const def = defs.find(c => c.key === sortColumn);
  if (def?.type === 'number' && selectedCols.includes(sortColumn) && !groupSet.has(sortColumn)) {
    return sortColumn;
  }
  return null;
}

// ── WHERE builder ────────────────────────────────────────────────────────────

/**
 * Builds a parameterized WHERE clause for any source.
 *
 * Supports two filter types (resolved from schema):
 * - Direct: filterable column → `m.[col] IN (@p0, @p1...)`
 * - FK: fk.alias with filterConfig → subquery on reference table
 *
 * Date range uses the column marked dateFilter: true in the schema.
 */
export function buildGenericWhere(
  req: sql.Request,
  filters: Record<string, string[]>,
  source: DataSource,
  dateFrom?: string,
  dateTo?: string,
): string {
  const table = getMainTable(source);
  const alias = table.alias ?? 'm';
  const schema = source.schema;
  const conditions: string[] = [];

  // Build lookup maps from schema
  const filterableColNames = new Set(
    table.columns.filter(c => effectiveColumnFilterTier(c) != null).map(c => c.name),
  );
  const fkByAlias = new Map((table.foreignKeys ?? []).map(fk => [fk.alias, fk]));

  let paramIdx = 0;

  for (const [key, values] of Object.entries(filters)) {
    if (!values.length) continue;

    if (filterableColNames.has(key)) {
      // Direct column filter
      const params = values.map(v => {
        const name = `f${paramIdx++}`;
        req.input(name, sql.NVarChar, v);
        return `@${name}`;
      });
      conditions.push(`${alias}.[${key}] IN (${params.join(',')})`);
    } else {
      // Try FK alias
      const fk = fkByAlias.get(key);
      if (fk?.filterConfig) {
        const { displayField, targetWhere } = fk.filterConfig;
        const params = values.map(v => {
          const name = `f${paramIdx++}`;
          req.input(name, sql.NVarChar, String(v));
          return `@${name}`;
        });
        const extraWhere = targetWhere ? ` AND ${targetWhere}` : '';
        conditions.push(
          `${alias}.[${fk.column}] IN (SELECT [${fk.targetColumn}] FROM [${schema}].[${fk.targetTable}] WHERE [${displayField}] IN (${params.join(',')})${extraWhere})`,
        );
      }
    }
  }

  // Date range
  const dateCol = table.columns.find(c => c.dateFilter)?.name;
  if (dateCol) {
    if (dateFrom) {
      req.input('dateFrom', sql.Date, new Date(dateFrom));
      conditions.push(`CAST(${alias}.[${dateCol}] AS DATE) >= @dateFrom`);
    }
    if (dateTo) {
      req.input('dateTo', sql.Date, new Date(dateTo));
      conditions.push(`CAST(${alias}.[${dateCol}] AS DATE) <= @dateTo`);
    }
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

// ── SELECT + JOINs builder ───────────────────────────────────────────────────

/**
 * Builds SELECT clause and JOIN clauses for a detail (non-grouped) query.
 * Always includes the main table alias column `[alias].[ID]` as the first column.
 */
export function buildGenericSelectAndJoins(
  cols: string[],
  sourceId: string,
): { select: string; joins: string } {
  const source = getSource(sourceId);
  const table = getMainTable(source);
  const alias = table.alias ?? 'm';
  const allDefs = getVisibleColumnDefs(sourceId);
  const colDefs = cols.map(k => allDefs.find(c => c.key === k)!).filter(Boolean);
  const joinDefs = getSourceJoinDefs(sourceId);

  const neededJoinKeys = new Set(colDefs.filter(c => c.joinKey).map(c => c.joinKey!));
  const joinClauses = [...neededJoinKeys].map(k => joinDefs[k]?.sql ?? '').filter(Boolean).join('\n');

  const selectParts = [
    `${alias}.[ID]`,
    ...colDefs.map(col =>
      col.sqlExpr ? `${col.sqlExpr} AS [${col.key}]` : `${alias}.[${col.key}]`,
    ),
  ];

  return { select: selectParts.join(', '), joins: joinClauses };
}

// ── Grouped SELECT + JOINs + GROUP BY builder ────────────────────────────────

/**
 * Builds SELECT, JOINs, and GROUP BY clause for a grouped (aggregated) query.
 * - Columns in groupBy: dimensions → included in SELECT as-is and in GROUP BY
 * - Numeric columns not in groupBy: wrapped with SUM()
 * - Other non-groupBy columns: skipped
 * - Опционально добавляет COUNT(*) AS [КоличествоДоговоров]
 */
export function buildGroupedSelectAndJoins(
  cols: string[],
  groupBy: string[],
  sourceId: string,
  options?: { includeContractCount?: boolean },
): { select: string; joins: string; groupByClause: string } {
  const includeContractCount = options?.includeContractCount !== false;
  const source = getSource(sourceId);
  const table = getMainTable(source);
  const alias = table.alias ?? 'm';
  const allDefs = getVisibleColumnDefs(sourceId);
  const colDefs = cols.map(k => allDefs.find(c => c.key === k)!).filter(Boolean);
  const joinDefs = getSourceJoinDefs(sourceId);
  const groupBySet = new Set(groupBy);

  const neededJoinKeys = new Set(colDefs.filter(c => c.joinKey).map(c => c.joinKey!));
  for (const key of groupBy) {
    const def = allDefs.find(c => c.key === key);
    if (def?.joinKey) neededJoinKeys.add(def.joinKey);
  }
  const joinClauses = [...neededJoinKeys].map(k => joinDefs[k]?.sql ?? '').filter(Boolean).join('\n');

  const selectParts: string[] = [];
  const groupByExprs: string[] = [];

  for (const col of colDefs) {
    const expr = col.sqlExpr ?? `${alias}.[${col.key}]`;
    if (groupBySet.has(col.key)) {
      selectParts.push(col.sqlExpr ? `${col.sqlExpr} AS [${col.key}]` : `${alias}.[${col.key}]`);
      groupByExprs.push(expr);
    } else if (col.type === 'number') {
      selectParts.push(`SUM(${expr}) AS [${col.key}]`);
    }
  }

  if (includeContractCount) {
    selectParts.push(`COUNT(*) AS [${CONTRACT_COUNT_COLUMN_KEY}]`);
  }

  return {
    select: selectParts.join(', '),
    joins: joinClauses,
    groupByClause: groupByExprs.length > 0 ? `GROUP BY ${groupByExprs.join(', ')}` : '',
  };
}
