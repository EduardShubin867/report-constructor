import { getPool } from '../db';
import type { ToolSkill } from './types';

const lookupDg: ToolSkill = {
  kind: 'tool',
  name: 'lookup_dg',
  description:
    'Поиск дилерской группы (ДГ) по наименованию в справочнике. Используй ВСЕГДА когда пользователь упоминает конкретную ДГ (например "150 ДГ", "ДГ Рольф", "дг 022"). Ищет по полю Наименование, возвращает Код (для WHERE dg.[Код] = ...) и Наименование. Пользователь обычно называет ДГ по имени или по номеру — оба содержатся в поле Наименование.',
  parameters: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Строка для поиска в Наименовании ДГ (например "150", "Рольф", "022")',
      },
    },
    required: ['search'],
  },

  async execute(args) {
    const search = String(args.search ?? '').trim();
    if (!search) return 'Не указана строка поиска для ДГ';

    const pool = await getPool();
    const result = await pool
      .request()
      .input('search', `%${search}%`)
      .query(
        `SELECT TOP 15 Код, Наименование, ДатаСоздания
         FROM [dbo].[ДГ]
         WHERE Наименование LIKE @search
         ORDER BY Наименование`,
      );

    if (result.recordset.length === 0)
      return `Не найдено ДГ по запросу "${search}". Попробуй другой вариант написания — номер ДГ содержится в поле Наименование.`;

    return `Найдены ДГ. Используй значение поля Код в SQL: dg.[Код] = '<значение Код>'.\n\n${JSON.stringify(result.recordset, null, 2)}`;
  },
};

export default lookupDg;
