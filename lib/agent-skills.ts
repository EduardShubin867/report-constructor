import { getPool } from './db';

/* ────────────────────────────────────────────────────────────────────
 * Tool definitions (OpenAI function-calling format for OpenRouter)
 * ──────────────────────────────────────────────────────────────────── */

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'lookup_dg',
      description:
        'Поиск ДГ по названию или коду. Используй ВСЕГДА когда пользователь упоминает конкретную ДГ (например «150 ДГ», «ДГ Рольф», «дг 022»). Возвращает Код (для JOIN через ID_ДГ) и Наименование.',
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Строка поиска — название или код ДГ (например "150" или "Рольф")',
          },
        },
        required: ['search'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lookup_territory',
      description:
        'Поиск территории использования ТС по названию. Используй когда пользователь упоминает конкретный город или территорию (например «Москва», «Казань»). Возвращает ID (для JOIN через ID_ТерриторияИспользованияТС), Наименование, Регион, КТ.',
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
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_column_values',
      description:
        'Получить уникальные значения колонки из основной таблицы с количеством записей. Используй чтобы узнать точные названия агентов, марок, регионов и т.п. перед написанием SQL.',
      parameters: {
        type: 'object',
        properties: {
          column: {
            type: 'string',
            description: 'Имя колонки',
            enum: [
              'Агент', 'СубАгент', 'Регион', 'РегионФакт', 'Марка', 'Модель',
              'ВидДоговора', 'КатегорияПолная', 'КатегорияСокращенная',
              'ИсточникДокумента', 'ЦельИспользования', 'ТипТерритории',
              'СтраховательЮрФизЛицо', 'СобственникТСЮрФизЛицо',
            ],
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
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_krm_krp_values',
      description:
        'Получить все возможные значения КРМ и КРП из справочников. Используй когда пользователь упоминает конкретные КРМ/КРП значения.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
] as const;

/* ────────────────────────────────────────────────────────────────────
 * Skill execution
 * ──────────────────────────────────────────────────────────────────── */

const ALLOWED_COLUMNS = new Set([
  'Агент', 'СубАгент', 'Регион', 'РегионФакт', 'Марка', 'Модель',
  'ВидДоговора', 'КатегорияПолная', 'КатегорияСокращенная',
  'ИсточникДокумента', 'ЦельИспользования', 'ТипТерритории',
  'СтраховательЮрФизЛицо', 'СобственникТСЮрФизЛицо',
]);

export async function executeSkill(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const pool = await getPool();

  switch (name) {
    /* ── lookup_dg ────────────────────────────────────────────────── */
    case 'lookup_dg': {
      const search = String(args.search ?? '').trim();
      if (!search) return 'Не указана строка поиска для ДГ';
      const result = await pool
        .request()
        .input('search', `%${search}%`)
        .query(
          `SELECT TOP 15 Код, Наименование, ДатаСоздания
           FROM [dbo].[ДГ]
           WHERE Наименование LIKE @search OR Код LIKE @search
           ORDER BY Наименование`,
        );
      if (result.recordset.length === 0)
        return `Не найдено ДГ по запросу "${search}". Попробуй другой запрос или проверь написание.`;
      return JSON.stringify(result.recordset, null, 2);
    }

    /* ── lookup_territory ─────────────────────────────────────────── */
    case 'lookup_territory': {
      const search = String(args.search ?? '').trim();
      if (!search) return 'Не указана строка поиска для территории';
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
    }

    /* ── list_column_values ───────────────────────────────────────── */
    case 'list_column_values': {
      const column = String(args.column ?? '');
      if (!ALLOWED_COLUMNS.has(column)) {
        return `Колонка "${column}" не доступна. Доступные: ${[...ALLOWED_COLUMNS].join(', ')}`;
      }
      const search = args.search ? String(args.search) : null;
      const limit = Math.min(Number(args.limit) || 20, 50);

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
    }

    /* ── get_krm_krp_values ───────────────────────────────────────── */
    case 'get_krm_krp_values': {
      const krm = await pool.request().query('SELECT ID, КРМ FROM [dbo].[КРМ] ORDER BY КРМ');
      const krp = await pool.request().query('SELECT ID, КРП FROM [dbo].[КРП] ORDER BY КРП ');
      return JSON.stringify({ КРМ: krm.recordset, КРП: krp.recordset }, null, 2);
    }

    default:
      return `Неизвестный скилл: ${name}`;
  }
}
