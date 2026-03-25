import { getPool } from '../db';
import type { ToolSkill } from './types';

const lookupTerritory: ToolSkill = {
  kind: 'tool',
  name: 'lookup_territory',
  description:
    'Поиск территории использования ТС по названию. Используй когда пользователь упоминает конкретный город или территорию (например "Москва", "Казань"). Возвращает ID (для JOIN через ID_ТерриторияИспользованияТС), Наименование, Регион, КТ.',
  parameters: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Название территории или города',
      },
    },
    required: ['search'],
  },

  async execute(args) {
    const search = String(args.search ?? '').trim();
    if (!search) return 'Не указана строка поиска для территории';

    const pool = await getPool();
    const result = await pool
      .request()
      .input('search', `%${search}%`)
      .query(
        `SELECT TOP 15 ID, Наименование, Регион, КТ, ТипТерритории
         FROM [dbo].[Территории]
         WHERE Наименование LIKE @search
         ORDER BY Наименование`,
      );

    if (result.recordset.length === 0)
      return `Не найдено территорий по запросу "${search}". Попробуй другой запрос.`;
    return JSON.stringify(result.recordset, null, 2);
  },
};

export default lookupTerritory;
