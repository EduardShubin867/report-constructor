import type { DataSource, TableSchema } from './types';

type TableLabelLike = Pick<TableSchema, 'name' | 'displayName'>;

export function getTableDisplayName(table: TableLabelLike): string {
  const displayName = table.displayName?.trim();
  return displayName || table.name;
}

export function getSourceTableDisplayName(source: DataSource, tableName: string): string {
  const table = source.tables.find(candidate => candidate.name === tableName);
  return table ? getTableDisplayName(table) : tableName;
}
