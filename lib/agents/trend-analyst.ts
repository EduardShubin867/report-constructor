/**
 * Trend Analyst sub-agent — specializes in time-series and period-comparison SQL.
 *
 * Use when user asks about: dynamics, trends, MoM/YoY comparisons, rolling averages,
 * growth/decline over time, cumulative totals, etc.
 */

import type { SubAgentConfig, AgentContext } from './types';
import {
  getCriticalDatabaseRulesSection,
  getTerritoryScopedUserMessageNote,
} from './shared-db-rules';
import { getTextInstructionsCatalog } from '@/lib/skills/registry';
import { getDataSources } from '@/lib/schema';
import { schemaToPrompt } from '@/lib/schema/to-prompt';

function buildSystemPrompt(ctx: AgentContext): string {
  const { today } = ctx;
  const schema = getDataSources().map(ds => schemaToPrompt(ds)).join('\n\n---\n\n');
  return `Ты — AI-аналитик, специализирующийся на временных рядах и анализе динамики в страховании ОСАГО.

Сегодняшняя дата: ${today}
СУБД: Microsoft SQL Server

${schema}

## Твоя специализация

Ты эксперт по временным рядам и сравнению периодов. Используй оконные функции и группировку по времени:

### Ключевые паттерны

**Динамика по месяцам:**
SELECT YEAR(m.[ДатаЗаключения]) AS [Год],
       MONTH(m.[ДатаЗаключения]) AS [Месяц],
       COUNT(*) AS [Договоров],
       SUM(m.[Премия]) AS [Премия]
FROM [dbo].[Журнал_ОСАГО_Маржа] m
GROUP BY YEAR(m.[ДатаЗаключения]), MONTH(m.[ДатаЗаключения])
ORDER BY [Год], [Месяц]

**MoM (месяц к предыдущему месяцу) через LAG:**
SELECT период, метрика,
       LAG(метрика) OVER (ORDER BY период) AS [ПредыдущийПериод],
       метрика - LAG(метрика) OVER (ORDER BY период) AS [Изменение],
       ROUND(100.0 * (метрика - LAG(метрика) OVER (ORDER BY период))
             / NULLIF(LAG(метрика) OVER (ORDER BY период), 0), 2) AS [ИзменениеПроцент]
FROM (подзапрос с агрегацией по периоду)

**YoY (год к году) для конкретного месяца:**
-- Группируй по месяцу, добавь год через YEAR() как отдельную колонку

**Накопленный итог (running total):**
SELECT ..., SUM(метрика) OVER (PARTITION BY год ORDER BY месяц) AS [НакопленныйИтог]

**Скользящее среднее (3 месяца):**
SELECT ..., AVG(метрика) OVER (ORDER BY период ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS [Среднее3М]

### Правила для временного анализа

1. Всегда явно определяй период: YEAR + MONTH, или DATEFROMPARTS для группировки
2. LAG/LEAD — только поверх подзапроса с агрегацией по периоду (нельзя агрегировать с оконными функциями в одном SELECT)
3. NULLIF(знаменатель, 0) при делении — всегда
4. ORDER BY в OVER() для LAG/LEAD — по хронологическому ключу (YEAR, MONTH или дате)
5. PARTITION BY — если анализ по нескольким группам одновременно

## Инструменты и инструкции

${getCriticalDatabaseRulesSection()}

### Дополнительные правила использования инструментов

1. Типичный сценарий: 1 раунд lookup (если нужно) → 1 раунд validate_query → финальный JSON.

### Самопроверка (ОБЯЗАТЕЛЬНО)

ПЕРЕД финальным ответом вызови \`validate_query\` РОВНО ОДИН РАЗ с готовым запросом.
**0 строк — валидный ответ**, если фильтры разумны: данных за этот период может просто не быть. Не выдумывай новые условия, чтобы «найти строки». Верни SQL как есть и честно скажи в explanation, что данных за выбранный период нет.
Вторую попытку validate_query делай только если есть подозрение на конкретную ошибку (опечатка, не тот период, неверная колонка). Максимум 2 вызова validate_query.

## Правила написания SQL

1. ТОЛЬКО SELECT. Запрещено: DROP, CREATE, ALTER, INSERT, UPDATE, DELETE, EXEC, xp_, sp_.
2. Только таблицы из схемы выше.
3. Никаких точек с запятой и нескольких операторов.
4. Имена колонок и таблиц на кириллице — в [квадратных скобках].
5. Псевдонимы AS — кириллицей (они станут заголовками в Excel).
6. Не добавляй TOP — система добавит ограничение автоматически.
7. **Не начинай запрос с WITH (CTE).** Валидатор системы принимает только запросы, первый оператор которых — SELECT. Для оконных функций используй подзапрос во FROM (как в примере ниже).
8. Для относительных дат: DATEADD/DATEDIFF/DATEFROMPARTS от ${today}.

## Правила для explanation

Пиши только смысл для аналитика: какие периоды, метрики, разрез. Не упоминай CTE, подзапросы, валидатор, SELECT в начале запроса, TOP — это внутренние детали.

## Пример: динамика премий с ростом MoM (без WITH — только SELECT)

SELECT [Год], [Месяц], [Договоров], [Премия],
       LAG([Премия]) OVER (ORDER BY [Год], [Месяц]) AS [ПремияПредМесяц],
       ROUND(100.0 * ([Премия] - LAG([Премия]) OVER (ORDER BY [Год], [Месяц]))
             / NULLIF(LAG([Премия]) OVER (ORDER BY [Год], [Месяц]), 0), 2) AS [РостПремииПроцент]
FROM (
    SELECT YEAR(m.[ДатаЗаключения])  AS [Год],
           MONTH(m.[ДатаЗаключения]) AS [Месяц],
           COUNT(*)                  AS [Договоров],
           SUM(m.[Премия])           AS [Премия]
    FROM [dbo].[Журнал_ОСАГО_Маржа] m
    WHERE m.[ДатаЗаключения] >= DATEADD(YEAR, -1, '${today}')
    GROUP BY YEAR(m.[ДатаЗаключения]), MONTH(m.[ДатаЗаключения])
) AS [ПоМесяцам]
ORDER BY [Год], [Месяц]

## Формат финального ответа

Отвечай ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "sql": "SELECT ...",
  "explanation": "Краткое объяснение на русском (1–2 предложения)",
  "suggestions": [
    "Уточняющий запрос 1",
    "Уточняющий запрос 2",
    "Уточняющий запрос 3"
  ]
}

suggestions — 2–3 логичных продолжения анализа (другой период, другой разрез, YoY и т.п.).

${getTextInstructionsCatalog({
    activeSourceIds: getDataSources().map(ds => ds.id),
    agentName: 'trend-analyst',
  })}`;
}

function buildUserMessage(ctx: AgentContext): string {
  const { query, previousSql, retryError } = ctx;
  const territoryNote = getTerritoryScopedUserMessageNote(query);

  if (retryError && previousSql) {
    return `SQL-запрос вернул ошибку. Исправь его.\n\nТекущий SQL:\n${previousSql}\n\nОшибка:\n${retryError}\n\nВерни исправленный SQL. Если ошибка связана с несуществующей колонкой/таблицей — установи canRetry: false.${territoryNote}`;
  }

  if (previousSql) {
    return `Пользователь хочет изменить существующий отчёт.\n\nТекущий SQL:\n${previousSql}\n\nЗапрос пользователя: ${query}\n\nЕсли это доработка — измени существующий SQL. Если принципиально новый — напиши с нуля.${territoryNote}`;
  }

  return `${query}${territoryNote}`;
}

const trendAnalyst: SubAgentConfig = {
  name: 'trend-analyst',
  description: 'Анализ динамики и временных рядов: MoM/YoY сравнения, скользящие средние, оконные функции LAG/LEAD, накопленные итоги. Используй для запросов о росте, трендах, динамике по месяцам/кварталам/годам.',
  maxRounds: 5,
  match(ctx) {
    const q = ctx.query.toLowerCase();
    if (/(динамик|тренд|рост|падение|по месяц|по кварт|понедель|по год|прошл.{0,5}(год|месяц|квартал)|сравни.{0,10}период|год.{0,5}год|месяц.{0,5}месяц|yoy|mom|накопл|скользящ|нараста)/.test(q)) return 0.9;
    if (/(изменени.{0,10}(премии|маржи|договор)|как менял|как изменил)/.test(q)) return 0.8;
    return 0;
  },
  buildSystemPrompt,
  buildUserMessage,
};

export default trendAnalyst;
