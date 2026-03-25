import { getPool } from '../db';
import { validateSql } from '../sql-validator';
import type { ToolSkill } from './types';

const validateQuery: ToolSkill = {
  kind: 'tool',
  name: 'validate_query',
  description:
    'Выполнить SQL-запрос и вернуть количество строк и первые 3 строки результата. Вызывай ОДИН РАЗ как финальную проверку готового запроса. НЕ используй для итеративной разработки или разведки — сначала напиши полный SQL, потом проверь.',
  parameters: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description: 'SQL-запрос для проверки (SELECT ...)',
      },
    },
    required: ['sql'],
  },

  async execute(args) {
    const sql = String(args.sql ?? '').trim();
    if (!sql) return 'SQL-запрос не указан';

    const validation = validateSql(sql);
    if (!validation.valid) {
      return `Ошибка валидации: ${validation.error}`;
    }

    try {
      const pool = await getPool();
      const result = await pool.request().query(validation.sql);
      const rows = result.recordset;
      const count = rows.length;

      if (count === 0) {
        return 'Запрос вернул 0 строк. Если это первая проверка — попробуй исправить условия WHERE и вызови validate_query ещё раз. Если это вторая проверка — верни текущий SQL как есть и укажи в explanation что данные не найдены.';
      }

      const preview = rows.slice(0, 3);
      return JSON.stringify({
        rowCount: count,
        preview,
        message: count < 5
          ? `Запрос вернул всего ${count} строк — убедись, что это ожидаемый результат.`
          : `Запрос вернул ${count} строк. Всё ОК.`,
      }, null, 2);
    } catch (err) {
      return `Ошибка выполнения: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`;
    }
  },
};

export default validateQuery;
