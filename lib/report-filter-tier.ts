import type { ColumnSchema, DataSource, ForeignKey } from '@/lib/schema/types';

/** UI-tier фильтра колонки основной таблицы в ручном отчёте. */
export function effectiveColumnFilterTier(col: ColumnSchema): 'primary' | 'secondary' | null {
  if (col.hidden) return null;
  if (col.filterTier === 'primary' || col.filterTier === 'secondary') return col.filterTier;
  if (col.filterable) return 'primary';
  return null;
}

/** UI-tier FK-фильтра в ручном отчёте. */
export function effectiveFkFilterTier(fk: ForeignKey): 'primary' | 'secondary' | null {
  if (!fk.filterConfig) return null;
  if (fk.filterTier === 'primary' || fk.filterTier === 'secondary') return fk.filterTier;
  return 'primary';
}

export interface BuiltFilterDescriptor {
  key: string;
  label: string;
  type: 'direct' | 'fk';
  tier: 'primary' | 'secondary';
  sql: string;
}

export const FILTER_OPTION_VALUE_LIMIT = 5000;

/** Все фильтры источника с SQL для DISTINCT; значения подгружаются по запросу. */
export function buildFilterDescriptors(source: DataSource): BuiltFilterDescriptor[] {
  const table = source.tables.find(t => t.columns.length > 0);
  if (!table) return [];
  const schema = source.schema;
  const tableName = `[${schema}].[${table.name}]`;
  const out: BuiltFilterDescriptor[] = [];

  for (const col of table.columns) {
    const tier = effectiveColumnFilterTier(col);
    if (!tier) continue;
    const label = col.label ?? col.name;
    const sql = `SELECT DISTINCT TOP (${FILTER_OPTION_VALUE_LIMIT}) [${col.name}] AS v FROM ${tableName} WHERE [${col.name}] IS NOT NULL ORDER BY [${col.name}]`;
    out.push({ key: col.name, label, type: 'direct', tier, sql });
  }

  for (const fk of table.foreignKeys ?? []) {
    const tier = effectiveFkFilterTier(fk);
    if (!tier || !fk.filterConfig) continue;
    const { displayField, label, targetWhere } = fk.filterConfig;
    const targetTableRef = `[${schema}].[${fk.targetTable}]`;
    const whereClause = targetWhere ? ` WHERE ${targetWhere}` : '';
    const sql = `SELECT DISTINCT TOP (${FILTER_OPTION_VALUE_LIMIT}) [${displayField}] AS v FROM ${targetTableRef}${whereClause} ORDER BY [${displayField}]`;
    out.push({ key: fk.alias, label, type: 'fk', tier, sql });
  }

  return out;
}
