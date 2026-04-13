import type { DataSource, TableSchema, ColumnType } from './types';

const TYPE_LABELS: Record<ColumnType, string> = {
  number: 'Числовые поля',
  string: 'Строковые поля',
  date: 'Дата/время поля',
  bit: 'Bit (0/1) поля',
};

function formatColumnName(name: string): string {
  return /\s/.test(name) ? `[${name}]` : name;
}

function tableToPrompt(table: TableSchema, schema: string): string {
  const parts: string[] = [];

  const aliasNote = table.alias ? `  (используй псевдоним ${table.alias})` : '';
  parts.push(`## Основная таблица: [${schema}].[${table.name}]${aliasNote}`);

  // Group columns by type, preserving definition order within each group
  const byType = new Map<ColumnType, string[]>();
  for (const col of table.columns) {
    if (col.hidden) continue;
    let list = byType.get(col.type);
    if (!list) { list = []; byType.set(col.type, list); }
    list.push(formatColumnName(col.name));
  }

  // Output in consistent order: number, string, date, bit
  for (const type of ['number', 'string', 'date', 'bit'] as ColumnType[]) {
    const cols = byType.get(type);
    if (!cols?.length) continue;
    parts.push(`${TYPE_LABELS[type]}: ${cols.join(', ')}`);
  }

  // Foreign keys
  if (table.foreignKeys?.length) {
    parts.push('');
    parts.push('Внешние ключи (для JOIN):');
    for (const fk of table.foreignKeys) {
      parts.push(`  ${fk.column} → [${schema}].[${fk.targetTable}].${fk.targetColumn} → поля: ${fk.targetFields.join(', ')}`);
    }

    parts.push('');
    parts.push('Примеры JOIN:');
    for (const fk of table.foreignKeys) {
      parts.push(`  ${fk.joinSql}`);
    }
  }

  return parts.join('\n');
}

/**
 * Generate the schema description for the LLM system prompt.
 * Only includes tables that have columns defined (main tables, not bare references).
 */
export function schemaToPrompt(ds: DataSource): string {
  const header = `# Источник данных: ${ds.name}${ds.whenToUse ? `\nКогда использовать: ${ds.whenToUse}` : ''}`;
  const tables = ds.tables
    .filter(t => t.columns.length > 0)
    .map(t => tableToPrompt(t, ds.schema))
    .join('\n\n');
  return `${header}\n\n${tables}`;
}
