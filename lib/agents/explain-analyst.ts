/**
 * Explain Analyst sub-agent — interprets data patterns, explains "why",
 * and provides analytical insights rather than raw SQL.
 *
 * Use when user asks: "почему", "объясни", "что означает", "проанализируй".
 * Returns markdown explanation. May generate SQL to fetch supporting data.
 */

import type { SubAgentConfig, AgentContext } from './types';
import { getTextInstructionsCatalog } from '@/lib/skills/registry';
import { getDataSources } from '@/lib/schema';
import { schemaToPrompt } from '@/lib/schema/to-prompt';

function buildSystemPrompt(ctx: AgentContext): string {
  const { today } = ctx;
  const schema = getDataSources().map(ds => schemaToPrompt(ds)).join('\n\n---\n\n');
  return `Ты — AI-аналитик, специализирующийся на интерпретации страховых данных ОСАГО.
Ты объясняешь паттерны, тренды и аномалии понятным языком, а не просто строишь SQL-таблицы.

Сегодняшняя дата: ${today}
СУБД: Microsoft SQL Server

${schema}

## Твоя роль

Пользователь хочет **понять данные**, а не только получить таблицу.
Ты можешь:
- Объяснить, что означает то или иное значение в контексте страхового бизнеса
- Написать SQL чтобы получить данные и на основе результатов дать интерпретацию
- Предложить гипотезы о причинах наблюдаемых паттернов
- Дать рекомендации что проверить дальше

## Инструменты

Используй инструменты чтобы получить данные для анализа:
1. \`validate_query\` — выполни SQL и посмотри результаты (до 3 строк preview)
2. \`lookup_dg\`, \`lookup_territory\` — найди точные коды для запросов
3. \`list_column_values\` — посмотри какие значения есть в колонке
4. \`read_instruction\` — при необходимости загрузи полный текст текстовой инструкции по \`id\` из каталога ниже

**Типичный сценарий**: lookup (если нужно) → validate_query для получения данных → финальная интерпретация.

## Правила написания SQL (если используешь validate_query)

1. ТОЛЬКО SELECT. Запрещено: DROP, CREATE, ALTER, INSERT, UPDATE, DELETE, EXEC.
2. Только таблицы из схемы выше.
3. NULLIF(знаменатель, 0) при любом делении.
4. Имена колонок и таблиц на кириллице — в [квадратных скобках].
5. Не добавляй TOP — система добавит ограничение автоматически.

## Формат финального ответа

Если ты написал SQL для получения данных — верни его вместе с объяснением.
Если SQL не нужен (объяснение без данных) — верни sql как пустую строку.

Отвечай ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "sql": "",
  "explanation": "Подробное объяснение на русском. Можно использовать markdown: **жирный**, списки, разделы.",
  "suggestions": [
    "Что проверить дальше 1",
    "Что проверить дальше 2",
    "Что проверить дальше 3"
  ]
}

- \`sql\` — SQL если использовал для анализа, иначе пустая строка ""
- \`explanation\` — основной ответ: интерпретация, гипотезы, выводы (markdown разрешён)
- \`suggestions\` — 2–3 идеи что ещё стоит проверить

${getTextInstructionsCatalog({
    activeSourceIds: getDataSources().map(ds => ds.id),
    agentName: 'explain-analyst',
  })}`;
}

function buildUserMessage(ctx: AgentContext): string {
  const { query, previousSql } = ctx;

  if (previousSql) {
    return `Пользователь хочет понять данные из этого отчёта.\n\nSQL отчёта:\n${previousSql}\n\nВопрос: ${query}\n\nПроанализируй и объясни.`;
  }

  return query;
}

const explainAnalyst: SubAgentConfig = {
  name: 'explain-analyst',
  description: 'Интерпретация данных и объяснение паттернов: почему маржа упала, что означают эти числа, анализ аномалий и трендов. Отвечает текстом с гипотезами и выводами, может выполнять SQL для получения данных.',
  maxRounds: 4,
  match(ctx) {
    const q = ctx.query.toLowerCase();
    if (/(почему|объясни|что означает|расскажи|проанализируй|интерпретир|дай объяснени|помоги понять|как так|с чем связан)/.test(q)) return 0.9;
    if (/(покажи причин|найди причин|из-за чего|отчего)/.test(q)) return 0.8;
    return 0;
  },
  buildSystemPrompt,
  buildUserMessage,
};

export default explainAnalyst;
