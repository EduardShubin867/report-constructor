import { z } from 'zod';
import { getPool, queryWithTimeout, TIMEOUT, timeoutWhenUnlimitedRows } from '../db';
import { validateSql, type ValidateOptions } from '../sql-validator';
import { setCache } from '../query-cache';
import type { ToolSkill } from './types';

export async function executeValidateQuery(
  args: Record<string, unknown>,
  validateOpts?: Pick<ValidateOptions, 'skipAutoRowLimit'>,
): Promise<string> {
  const sql = String(args.sql ?? '').trim();
  if (!sql) return 'SQL-запрос не указан';

  const validation = validateSql(sql, validateOpts);
  if (!validation.valid) {
    return `Ошибка валидации: ${validation.error}`;
  }

  try {
    const pool = await getPool();
    const result = await queryWithTimeout(
      pool.request(),
      validation.sql,
      timeoutWhenUnlimitedRows(TIMEOUT.QUERY, validateOpts?.skipAutoRowLimit),
    );
    const rows = result.recordset as Record<string, unknown>[];
    const count = rows.length;
    const columns = count > 0 ? Object.keys(rows[0]) : [];

    // Cache for /api/query to avoid re-executing the same SQL
    if (count > 0) {
      setCache(validation.sql, rows, columns);
    }

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
}

const validateQuery: ToolSkill = {
  kind: 'tool',
  name: 'validate_query',
  description:
    'Выполнить SQL-запрос и вернуть количество строк и первые 3 строки результата. Вызывай ОДИН РАЗ как финальную проверку готового запроса. НЕ используй для итеративной разработки или разведки — сначала напиши полный SQL, потом проверь.',
  inputSchema: z.object({
    sql: z.string().describe('SQL-запрос для проверки (SELECT ...)'),
  }) as z.ZodType<Record<string, unknown>>,

  execute(args) {
    return executeValidateQuery(args);
  },
};

export default validateQuery;
