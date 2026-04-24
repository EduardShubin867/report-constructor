import type { ColumnSchema, DataSource } from '@/lib/schema/types';
import { BASE_PATH } from '@/lib/constants';
import type { ColumnFilterTier, SourceEditorFormData } from './types';

export const EMPTY_SOURCE_EDITOR_FORM: SourceEditorFormData = {
  id: '',
  name: '',
  database: '',
  schema: 'dbo',
  whenToUse: '',
  tables: '',
  connectionId: '',
};

export function filterTierFromColumn(column: ColumnSchema): ColumnFilterTier {
  if (column.filterTier === 'primary' || column.filterTier === 'secondary') return column.filterTier;
  if (column.filterable) return 'primary';
  return 'off';
}

export function sourceToForm(source: DataSource): SourceEditorFormData {
  return {
    id: source.id,
    name: source.name,
    database: source.database ?? '',
    schema: source.schema,
    whenToUse: source.whenToUse ?? '',
    tables: source.tables.map(table => table.name).join('\n'),
    connectionId: source.connectionId ?? '',
  };
}

export function normalizeSourceForSave(source: DataSource, form: SourceEditorFormData): DataSource {
  return {
    ...source,
    name: form.name,
    whenToUse: form.whenToUse.trim() || undefined,
    tables: source.tables.map(table => ({
      ...table,
      columns: table.columns.map(column => {
        const { filterable, ...nextColumn } = column;
        void filterable;
        return nextColumn;
      }),
    })),
  };
}

export function buildGenerateWhenToUseRequest(
  form: Pick<SourceEditorFormData, 'name' | 'whenToUse' | 'tables'>,
): {
  url: string;
  body: { name: string; draft: string; tables: string[] };
} {
  return {
    url: `${BASE_PATH}/api/admin/sources/generate-when-to-use`,
    body: {
      name: form.name,
      draft: form.whenToUse,
      tables: form.tables
        .split('\n')
        .map(table => table.trim())
        .filter(Boolean),
    },
  };
}

export function getFkPanelKey(tableIdx: number, fkIdx: number): string {
  return `${tableIdx}-${fkIdx}`;
}
