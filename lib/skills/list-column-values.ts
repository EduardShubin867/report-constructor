import { getPool } from '../db';
import type { ToolSkill } from './types';

const ALLOWED_COLUMNS = new Set([
  'Агент', 'СубАгент', 'Регион', 'РегионФакт', 'Марка', 'Модель',
  'ВидДоговора', 'КатегорияПолная', 'КатегорияСокращенная',
  'ИсточникДокумента', 'ЦельИспользования', 'ТипТерритории',
  'СтраховательЮрФизЛицо', 'СобственникТСЮрФизЛицо',
]);

const listColumnValues: ToolSkill = {
  kind: 'tool',
  name: 'list_column_values',
  description:
    'Получить уникальные значения колонки из основной таблицы с количеством записей. Используй чтобы узнать точные названия агентов, марок, регионов и т.п. перед написанием SQL.',
  parameters: {
    type: 'object',
    properties: {
      column: {
        type: 'string',
        description: 'Имя колонки',
        enum: [...ALLOWED_COLUMNS],
      },
      search: {
        type: 'string',
        description: 'Опциональный фильтр (LIKE %search%). Пример: "Москва", "BMW"',
      },
      limit: {
        type: 'number',
        description: 'Макс. результатов (по умолчанию 20, максимум 50)',
      },
    },
    required: ['column'],
  },

  async execute(args) {
    const column = String(args.column ?? '');
    if (!ALLOWED_COLUMNS.has(column)) {
      return `Колонка "${column}" не доступна. Доступные: ${[...ALLOWED_COLUMNS].join(', ')}`;
    }
    const search = args.search ? String(args.search) : null;
    const limit = Math.min(Number(args.limit) || 20, 50);

    const pool = await getPool();
    const req = pool.request();
    let where = `WHERE [${column}] IS NOT NULL AND [${column}] != ''`;
    if (search) {
      req.input('search', `%${search}%`);
      where += ` AND [${column}] LIKE @search`;
    }

    const result = await req.query(
      `SELECT TOP ${limit} [${column}] AS [value], COUNT(*) AS [count]
       FROM [dbo].[Журнал_ОСАГО_Маржа]
       ${where}
       GROUP BY [${column}]
       ORDER BY COUNT(*) DESC`,
    );

    if (result.recordset.length === 0)
      return `Нет значений для колонки "${column}"${search ? ` с фильтром "${search}"` : ''}`;
    return JSON.stringify(result.recordset, null, 2);
  },
};

export default listColumnValues;
