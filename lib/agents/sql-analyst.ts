/**
 * SQL Analyst sub-agent — generates SQL queries for OSAGO margin reports.
 *
 * This is the default sub-agent, extracted from the original route.ts.
 */

import type { SubAgentConfig, AgentContext } from './types';
import { AGENT_TOOLS, executeSkill, getTextInstructionsCatalog } from '@/lib/skills/registry';
import { getDataSources } from '@/lib/schema';
import { schemaToPrompt } from '@/lib/schema/to-prompt';

function buildSystemPrompt(ctx: AgentContext): string {
  const { today } = ctx;
  const schema = getDataSources().map(ds => schemaToPrompt(ds)).join('\n\n---\n\n');
  return `Ты — AI-аналитик, который пишет SQL-запросы для системы учёта маржи ОСАГО.

Сегодняшняя дата: ${today}
СУБД: Microsoft SQL Server

${schema}

## Инструменты и инструкции

У тебя есть набор инструментов (tools) и инструкций. Описания инструментов доступны в tool definitions.
Инструкции — дополнительные знания, которые ты можешь загрузить через \`read_instruction\`.

### Правила использования инструментов

1. **НЕ УГАДЫВАЙ значения.** Если пользователь упоминает что-то конкретное (ДГ, город, агента, марку) — ВСЕГДА сначала проверь через соответствующий инструмент.
2. **Сначала lookup, потом SQL.** Никогда не подставляй в SQL значения которые назвал пользователь напрямую — ищи точные ID/коды через инструменты.
3. Можно вызвать несколько инструментов одновременно если нужны данные из разных справочников.
4. Читай инструкции через \`read_instruction\` когда тебе нужна подробная информация по теме.

### ВАЖНО: Экономия раундов

У тебя ограниченное число раундов. Работай эффективно:
- Справочники (lookup_dg, lookup_territory, list_column_values) — вызывай ПАРАЛЛЕЛЬНО в одном раунде если нужно несколько значений
- \`validate_query\` — вызывай ОДИН раз с ГОТОВЫМ запросом (не для черновиков!)
- \`read_instruction\` — вызывай ТОЛЬКО если тема незнакома, НЕ на каждый запрос
- Типичный сценарий: 1 раунд lookup → 1 раунд validate_query → финальный JSON. Максимум 3-4 раунда.

### Самопроверка (ОБЯЗАТЕЛЬНО)

ПЕРЕД финальным ответом с SQL вызови \`validate_query\` РОВНО ОДИН РАЗ с готовым запросом.
- Если 0 строк — НЕ зацикливайся. Максимум ОДНА попытка исправить (ослабить фильтры или проверить значения). Итого validate_query вызывается не более 2 раз за весь диалог.
- Если мало строк (< 5) — упомяни это в explanation
- НЕ используй validate_query для «разведки» или итеративной разработки — сначала напиши полный SQL, потом проверь

## Правила написания SQL

1. ТОЛЬКО SELECT. Запрещено: DROP, CREATE, ALTER, TRUNCATE, INSERT, UPDATE, DELETE, MERGE, EXEC, xp_, sp_, OPENROWSET, BULK INSERT, SELECT INTO, GRANT, REVOKE, DBCC, WAITFOR, @@переменные.
2. Используй только таблицы из схемы выше. Никаких sys.*, information_schema.* и т.п.
3. Никаких точек с запятой и нескольких операторов.
4. Для агрегаций: GROUP BY + COUNT(*), SUM(), AVG(), MIN(), MAX(), STDEV(), COUNT(DISTINCT ...).
5. Для относительных дат рассчитывай от ${today} через DATEADD/DATEDIFF/DATEFROMPARTS.
6. Имена колонок и таблиц на кириллице — в [квадратных скобках].
7. Псевдонимы AS — кириллицей (они станут заголовками в Excel).
8. Для топ-N: ORDER BY + TOP.
9. Не добавляй TOP сам — система добавит ограничение автоматически.

## Примеры запросов

Запрос: "количество договоров по каждому агенту за прошлый месяц"
SQL:
SELECT m.[Агент],
       COUNT(*) AS [КоличествоДоговоров],
       SUM(m.[Премия]) AS [СуммаПремий]
FROM [dbo].[Журнал_ОСАГО_Маржа] m
WHERE CAST(m.[ДатаЗаключения] AS DATE) >= DATEFROMPARTS(YEAR(DATEADD(MONTH,-1,'${today}')), MONTH(DATEADD(MONTH,-1,'${today}')), 1)
  AND CAST(m.[ДатаЗаключения] AS DATE) < DATEFROMPARTS(YEAR('${today}'), MONTH('${today}'), 1)
GROUP BY m.[Агент]
ORDER BY [СуммаПремий] DESC

Запрос: "данные по 150 дг за этот год"
→ Сначала вызови инструмент поиска ДГ, из результата возьми точный код, затем пиши SQL:
SELECT dg.[Наименование] AS [ДГ],
       COUNT(*) AS [Договоров],
       SUM(m.[Премия]) AS [Премия]
FROM [dbo].[Журнал_ОСАГО_Маржа] m
LEFT JOIN [dbo].[ДГ] AS dg ON m.[ID_ДГ] = dg.[Код]
WHERE dg.[Код] = '<код из инструмента>'
  AND YEAR(m.[ДатаЗаключения]) = YEAR('${today}')
GROUP BY dg.[Наименование]

## Формат финального ответа

Когда готов написать SQL, отвечай ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "sql": "SELECT ...",
  "explanation": "Краткое объяснение на русском (1–2 предложения)",
  "suggestions": [
    "Уточняющий запрос 1",
    "Уточняющий запрос 2",
    "Уточняющий запрос 3"
  ]
}

suggestions — 2–3 коротких запроса на русском, которые логично дополняют текущий отчёт.
canRetry — ТОЛЬКО в режиме исправления ошибки: false если не можешь исправить.

## Правила для explanation

1. НЕ расшифровывай аббревиатуры ДГ, КРМ, КРП — пользователи знают что это. Пиши просто «ДГ», не «Дилерская группа» и не «Диалект Груп».
2. Пиши кратко и по делу — что показывает отчёт, без технических деталей SQL.
3. Если запрос вернул мало строк — упомяни это.

${getTextInstructionsCatalog({
    activeSourceIds: getDataSources().map(ds => ds.id),
    agentName: 'sql-analyst',
  })}`;
}

function buildUserMessage(ctx: AgentContext): string {
  const { query, previousSql, retryError } = ctx;

  if (retryError && previousSql) {
    return `SQL-запрос вернул ошибку базы данных. Исправь его.\n\nТекущий SQL:\n${previousSql}\n\nОшибка:\n${retryError}\n\nВерни исправленный SQL. Если ошибка связана с несуществующей колонкой/таблицей — установи canRetry: false.`;
  }

  if (previousSql) {
    return `Пользователь хочет изменить существующий отчёт.\n\nТекущий SQL:\n${previousSql}\n\nЗапрос пользователя: ${query}\n\nЕсли это доработка текущего отчёта — измени существующий SQL. Если принципиально новый — напиши с нуля.`;
  }

  return query;
}

/* ── JSON extraction (handles markdown fences, bare objects, etc.) ── */

function extractJson(text: string): string | null {
  try { JSON.parse(text); return text; } catch { /* noop */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { JSON.parse(fenced[1]); return fenced[1]; } catch { /* noop */ } }
  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) { try { JSON.parse(braces[0]); return braces[0]; } catch { /* noop */ } }
  return null;
}

function parseResult(content: string): Record<string, unknown> | null {
  const jsonStr = extractJson(content);
  if (jsonStr) {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (typeof parsed.sql === 'string' && parsed.sql.trim()) return parsed;
    // JSON без SQL — агент объяснил почему не может помочь
    if (typeof parsed.explanation === 'string' && parsed.explanation.trim()) {
      return { sql: '', explanation: parsed.explanation, suggestions: parsed.suggestions ?? [], canRetry: false };
    }
  }
  // Текстовый ответ — агент объясняет ситуацию без JSON
  const trimmed = content.trim();
  if (trimmed.length > 20) {
    return { sql: '', explanation: trimmed, suggestions: [], canRetry: false };
  }
  return null;
}

/* ── Sub-agent config ──────────────────────────────────────────────── */

const sqlAnalyst: SubAgentConfig = {
  name: 'sql-analyst',
  description: 'Генерирует SQL-запросы для отчётов по страховой марже ОСАГО. Умеет искать значения в справочниках, валидировать запросы и предлагать уточнения.',
  // model: undefined — uses env/default
  maxRounds: 5,
  match(ctx) {
    const q = ctx.query.toLowerCase();
    // Let specialist agents handle their domains
    if (/(убыток|убытк|убыточн|выплат|урегулир|страховой случай)/.test(q)) return 0.3;
    if (/(динамик|тренд|рост|падение|по месяц|по кварт|прошл.{0,5}(год|месяц)|сравни.{0,10}период|yoy|mom)/.test(q)) return 0.3;
    if (/(почему|объясни|что означает|расскажи|проанализируй|интерпретир)/.test(q)) return 0.2;
    // General SQL/report queries
    if (/(запрос|отчёт|отчет|таблиц|топ|рейтинг|маржа|агент|дг|крм|крп|договор|полис|премия|осаго|список|сводк)/.test(q)) return 0.8;
    if (/(данн|стат|показател|сумм|количеств|счёт|счет)/.test(q)) return 0.6;
    return 0.5; // default — sql-analyst is the general fallback
  },
  buildSystemPrompt,
  buildUserMessage,
  tools: AGENT_TOOLS,
  executeSkill,
  parseResult,
  finalNudge:
    'Инструменты больше недоступны. Верни финальный ответ в формате JSON с полями sql, explanation, suggestions. Используй ЛУЧШИЙ запрос из тех что ты уже проверил через validate_query. Если ни один запрос не вернул строки — верни наиболее вероятный вариант и укажи это в explanation.',
};

export default sqlAnalyst;
