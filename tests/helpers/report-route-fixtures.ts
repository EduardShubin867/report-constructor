import type { ColumnDef } from '@/lib/report-columns';
import type { DataSource } from '@/lib/schema/types';

export const MOCK_SOURCE_ID = 'source-1';

export const MOCK_SOURCE: DataSource = {
  id: MOCK_SOURCE_ID,
  name: 'Тестовый источник',
  dialect: 'mssql',
  schema: 'dbo',
  manualReport: true,
  tables: [
    {
      name: 'Main',
      alias: 'm',
      columns: [
        { name: 'ID', type: 'number' },
        { name: 'ДатаЗаключения', type: 'date', periodFilter: true },
        { name: 'Агент', type: 'string', filterable: true, groupable: true },
        { name: 'Премия', type: 'number' },
      ],
      foreignKeys: [],
    },
  ],
};

export const MOCK_VISIBLE_COLUMNS: ColumnDef[] = [
  { key: 'Агент', label: 'Агент', type: 'string' },
  { key: 'Премия', label: 'Премия', type: 'number' },
];
