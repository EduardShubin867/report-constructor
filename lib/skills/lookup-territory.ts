import { z } from 'zod';
import { getPool, queryWithTimeout, TIMEOUT } from '../db';
import type { ToolSkill } from './types';

const lookupTerritory: ToolSkill = {
  kind: 'tool',
  name: 'lookup_territory',
  description:
    'Поиск территории использования ТС по названию города/территории или по территориальному региону. Используй когда пользователь упоминает конкретный город, территорию или отчёт "по территориям в <городе/регионе>". Возвращает ID, Наименование, Регион, КТ и подсказывает, как фильтровать через JOIN с [dbo].[Территории].',
  inputSchema: z.object({
    search: z.string().describe('Название территории, города или региона'),
  }) as z.ZodType<Record<string, unknown>>,

  async execute(args) {
    const search = String(args.search ?? '').trim();
    if (!search) return 'Не указана строка поиска для территории';

    const pool = await getPool();
    const req = pool.request().input('search', `%${search}%`);
    const result = await queryWithTimeout(req,
      `SELECT TOP 15 ID, Наименование, Регион, КТ, ТипТерритории
       FROM [dbo].[Территории]
       WHERE Наименование LIKE @search
          OR Регион LIKE @search
       ORDER BY Наименование`,
      TIMEOUT.SKILL,
    );

    if (result.recordset.length === 0)
      return `Не найдено территорий по запросу "${search}". Попробуй другое название города, территории или региона.`;
    return [
      'Найдены территории. Для точечного фильтра используй JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID] и фильтр по ter.[ID].',
      'Если нужен отчёт именно по территориям или по территориям внутри региона, фильтруй/группируй по полям ter.[Наименование], ter.[Регион], ter.[ТипТерритории].',
      '',
      JSON.stringify(result.recordset, null, 2),
    ].join('\n');
  },
};

export default lookupTerritory;
