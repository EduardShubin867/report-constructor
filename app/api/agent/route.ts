import { NextRequest, NextResponse } from 'next/server';
import { AGENT_TOOLS, executeSkill, getInstructionsBlock } from '@/lib/skills/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // seconds — agent does multiple LLM roundtrips

export interface AgentResponse {
  sql: string;
  explanation: string;
  suggestions: string[];
  canRetry?: boolean;
  /** How many tool-call rounds the agent went through (for debug) */
  _skillRounds?: number;
}

/* ────────────────────────────────────────────────────────────────────
 * Schema description for the system prompt
 * ──────────────────────────────────────────────────────────────────── */

const SCHEMA = `
## Основная таблица: [dbo].[Журнал_ОСАГО_Маржа]  (используй псевдоним m)

Числовые поля: Премия, ПремияКросс, ПремияОСАГОПлюсКросс, ДоплатаВозврат, ТарифБазовый, ДоляОСАГО,
  КБМ, КВС, КМ, КН, КО, КТ, КП, КПР, КС, МощностьДвигателя, ГодВыпуска, Срок,
  МаксБТ, МинБТ, КоличествоМест, КоличествоЛДУ, КоэфБесшовки, КоэфОтказаОтАЗ,
  КоэфПериодаНесенияОтветсвенности, КоэфСрокаСтрахования, ПереданВПул, ПоКонкурсу,
  ВнутреннийПул, ЗаработаноДоля, ЗаработаннаяПремияОСАГОПлюсКросс,
  ВозрастМладшегоВодителя, ВозрастСобственника, ВозрастСтрахователя, МинимальныйСтаж,
  КатегорияОператора, ПремияДоп, СтраховаяСумма, КатегорияРискаДоговора,
  [Количество урегулированных убытков], [Сумма выплаты урегулированных убытков],
  [Количество неурегулированных убытков]

Строковые поля: НомерДоговора, Агент, СубАгент, Марка, Модель, МаркаМодель, МодельСтрокой,
  VIN, ГРЗ, Регион, РегионФакт, ВидДоговора, КатегорияПолная, КатегорияСокращенная,
  КлассБонусМалус, ИсточникДокумента, ЦельИспользования, ТипТерритории,
  Страхователь, СтраховательИНН, СтраховательЮрФизЛицо,
  СобственникТС, СобственникТСИНН, СобственникТСЮрФизЛицо,
  НомерКузова, НомерШасси,
  ДокументОснованиеНомерДокумента, ПервоначальныйДоговорНомерДокумента,
  UIDДокумента, ТерриторияИспользованияТСФакт

Дата/время поля: ДатаЗаключения, ДатаНачала, ДатаОкончания, ДатаНачисления,
  ДокументОснованиеДата, ПервоначальныйДоговорДата,
  ДатаМинимальногоСтажа, ДатаРожденияМладшегоВодителя,
  СтраховательДатаРождения, СобственникТСДатаРождения

Bit (0/1) поля: БезАЗ, НестандартныйVIN, СписокЛицОграничен, ГородСоколова, Транзит

Внешние ключи (для JOIN):
  ID_ДГ         → [dbo].[ДГ].Код         → поля: Наименование, ДатаСоздания
  ID_КРМ        → [dbo].[КРМ].ID         → поля: КРМ (int)
  ID_КРП        → [dbo].[КРП].ID         → поля: КРП (int)
  ID_ТерриторияИспользованияТС → [dbo].[Территории].ID → поля: Наименование, КТ, Регион, ТипТерритории

Примеры JOIN:
  LEFT JOIN [dbo].[ДГ] AS dg ON m.ID_ДГ = dg.Код
  LEFT JOIN [dbo].[Территории] AS ter ON m.ID_ТерриторияИспользованияТС = ter.ID
  LEFT JOIN [dbo].[КРМ] AS krm ON m.ID_КРМ = krm.ID
  LEFT JOIN [dbo].[КРП] AS krp ON m.ID_КРП = krp.ID
`.trim();

/* ────────────────────────────────────────────────────────────────────
 * System prompt builder
 * ──────────────────────────────────────────────────────────────────── */

function buildSystemPrompt(today: string): string {
  return `Ты — AI-аналитик, который пишет SQL-запросы для системы учёта маржи ОСАГО.

Сегодняшняя дата: ${today}
СУБД: Microsoft SQL Server

${SCHEMA}

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

${getInstructionsBlock()}`;
}

/* ────────────────────────────────────────────────────────────────────
 * JSON extraction helper (in case model wraps in markdown)
 * ──────────────────────────────────────────────────────────────────── */

function extractJson(text: string): string | null {
  // Try direct parse
  try { JSON.parse(text); return text; } catch { /* noop */ }
  // Try stripping markdown fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { JSON.parse(fenced[1]); return fenced[1]; } catch { /* noop */ } }
  // Try finding first { ... }
  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) { try { JSON.parse(braces[0]); return braces[0]; } catch { /* noop */ } }
  return null;
}

/* ────────────────────────────────────────────────────────────────────
 * OpenRouter call helper
 * ──────────────────────────────────────────────────────────────────── */

interface Message {
  role: string;
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

async function callLLM(
  apiKey: string,
  model: string,
  messages: Message[],
  useTools: boolean,
): Promise<{ message: Message; finishReason: string }> {
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.1,
  };

  if (useTools) {
    payload.tools = AGENT_TOOLS;
    payload.tool_choice = 'auto';
  } else {
    payload.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      'X-Title': 'OSAGO Report Generator',
    },
    body: Buffer.from(JSON.stringify(payload), 'utf-8'),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('OpenRouter error:', err);
    throw new Error('Ошибка AI-сервиса');
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error('Пустой ответ от модели');

  return {
    message: choice.message,
    finishReason: choice.finish_reason ?? '',
  };
}

/* ────────────────────────────────────────────────────────────────────
 * POST handler
 * ──────────────────────────────────────────────────────────────────── */

const MAX_TOOL_ROUNDS = 5;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY не настроен' }, { status: 500 });
  }

  const startTime = Date.now();
  console.log('[Agent] Request started');

  try {
    const body = await request.json() as {
      query: string;
      previousSql?: string;
      retryError?: string;
    };

    const { query, previousSql, retryError } = body;
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Запрос не может быть пустым' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const model = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-001';

    // Build user message depending on mode
    let userMessage: string;
    if (retryError && previousSql) {
      userMessage = `SQL-запрос вернул ошибку базы данных. Исправь его.

Текущий SQL:
${previousSql}

Ошибка:
${retryError}

Верни исправленный SQL. Если ошибка связана с несуществующей колонкой/таблицей — установи canRetry: false.`;
    } else if (previousSql) {
      userMessage = `Пользователь хочет изменить существующий отчёт.

Текущий SQL:
${previousSql}

Запрос пользователя: ${query}

Если это доработка текущего отчёта — измени существующий SQL. Если принципиально новый — напиши с нуля.`;
    } else {
      userMessage = query;
    }

    // Build conversation
    const messages: Message[] = [
      { role: 'system', content: buildSystemPrompt(today) },
      { role: 'user', content: userMessage },
    ];

    // Multi-turn loop: allow the model to call tools before generating SQL
    let skillRounds = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { message: assistantMsg, finishReason } = await callLLM(apiKey, model, messages, true);

      // If the model returned tool calls — execute them and continue
      if (assistantMsg.tool_calls?.length) {
        skillRounds++;
        messages.push(assistantMsg);

        // Execute all tool calls (could be multiple in one round)
        for (const tc of assistantMsg.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* noop */ }

          console.log(`[Agent] Skill: ${tc.function.name}(${JSON.stringify(args)})`);
          const result = await executeSkill(tc.function.name, args);

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }
        continue;
      }

      // Model returned content — check if it's our JSON response
      if (assistantMsg.content) {
        const jsonStr = extractJson(assistantMsg.content);
        if (jsonStr) {
          const parsed: AgentResponse = JSON.parse(jsonStr);
          if (parsed.sql?.trim()) {
            parsed._skillRounds = skillRounds;
            console.log(`[Agent] Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s, rounds=${skillRounds}`);
            return NextResponse.json(parsed);
          }
        }
      }

      // If finish_reason is 'stop' but no valid JSON — model might have stopped without tools
      // Try one more call without tools to force JSON output
      if (finishReason === 'stop') {
        break;
      }
    }

    // Final call without tools — force JSON response
    console.log(`[Agent] Final call (no tools), rounds=${skillRounds}`);

    // Tell the model that tools are no longer available so it must return JSON now
    messages.push({
      role: 'user',
      content:
        'Инструменты больше недоступны. Верни финальный ответ в формате JSON с полями sql, explanation, suggestions. Используй ЛУЧШИЙ запрос из тех что ты уже проверил через validate_query. Если ни один запрос не вернул строки — верни наиболее вероятный вариант и укажи это в explanation.',
    });

    const { message: finalMsg } = await callLLM(apiKey, model, messages, false);

    if (!finalMsg.content) {
      return NextResponse.json({ error: 'Пустой ответ от модели' }, { status: 502 });
    }

    const jsonStr = extractJson(finalMsg.content);
    if (!jsonStr) {
      console.error('Failed to extract JSON:', finalMsg.content);
      return NextResponse.json({ error: 'Не удалось разобрать ответ модели' }, { status: 502 });
    }

    const parsed: AgentResponse = JSON.parse(jsonStr);
    if (!parsed.sql?.trim()) {
      return NextResponse.json({ error: 'Модель не вернула SQL' }, { status: 502 });
    }

    parsed._skillRounds = skillRounds;
    console.log(`[Agent] Done (final) in ${((Date.now() - startTime) / 1000).toFixed(1)}s, rounds=${skillRounds}`);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error(`[Agent] Error after ${((Date.now() - startTime) / 1000).toFixed(1)}s:`, err);
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
