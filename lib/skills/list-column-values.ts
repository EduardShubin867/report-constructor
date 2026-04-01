import { getPool, queryWithTimeout, TIMEOUT } from '../db';
import { getFilterableColumns } from '../schema';
import type { ToolSkill } from './types';

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
        description: 'Имя filterable-колонки (строковые колонки: Агент, Марка, Регион, ВидДоговора и т.п.)',
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
    const allowed = getFilterableColumns();
    if (!allowed.has(column)) {
      return `Колонка "${column}" не доступна. Доступные: ${[...allowed].join(', ')}`;
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

    const result = await queryWithTimeout(req,
      `SELECT TOP ${limit} [${column}] AS [value], COUNT(*) AS [count]
       FROM [dbo].[Журнал_ОСАГО_Маржа]
       ${where}
       GROUP BY [${column}]
       ORDER BY COUNT(*) DESC`,
      TIMEOUT.SKILL,
    );

    if (result.recordset.length === 0)
      return `Нет значений для колонки "${column}"${search ? ` с фильтром "${search}"` : ''}`;
    return JSON.stringify(result.recordset, null, 2);
  },
};

export default listColumnValues;
