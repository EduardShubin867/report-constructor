/**
 * POST /api/admin/sources/generate-when-to-use
 *
 * Input:  { name: string, draft?: string, tables?: string[] }
 * Output: { whenToUse: string }
 *
 * Generates a polished `whenToUse` description for a data source using an LLM.
 * User provides a rough description (draft) — the model rewrites it into the
 * structured format expected by the source-router.
 *
 * Model resolution: OPENROUTER_WHEN_TO_USE_MODEL → OPENROUTER_MODEL → fallback.
 */

import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import { resolveWhenToUseGeneratorModel } from '@/lib/agents/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SYSTEM_PROMPT = `Ты помогаешь оформлять описание поля "whenToUse" для источников данных в SQL-агенте.

Описание читает LLM-роутер, чтобы выбрать ОДИН источник под запрос пользователя. Качество описания напрямую влияет на точность маршрутизации.

## Правила хорошего whenToUse

1. Начинается с императива: «Используй когда…», «Используй для…».
2. Перечисляет ПОЗИТИВНЫЕ триггеры: сущности, метрики, типы вопросов, для которых источник релевантен.
3. Явно указывает уровень гранулярности (детальные строки / агрегаты / сводка).
4. Разграничивает с похожими источниками, если такое разграничение очевидно из черновика.
5. Содержит 1–3 коротких примера вопросов пользователя в формате: «Примеры: «…», «…», «…».».
6. Длина: 2–5 строк связного русского текста. Без маркдауна, без списков, без заголовков — один-два абзаца.
7. Не используй отрицательные определения («всё что НЕ X») — переформулируй позитивно.
8. Не пиши «можно использовать» — это ослабляет сигнал. Пиши «используй».

## Формат ответа

Верни ТОЛЬКО готовый текст whenToUse. Без кавычек, без markdown-обёртки, без префиксов «Вот описание:», без пояснений.`;

interface GenerateBody {
  name?: string;
  draft?: string;
  tables?: string[];
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: 'OPENROUTER_API_KEY не настроен' }, { status: 500 });
  }

  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  const draft = body.draft?.trim();
  const tables = Array.isArray(body.tables) ? body.tables.filter(Boolean) : [];

  if (!name && !draft) {
    return Response.json(
      { error: 'Нужно указать хотя бы name или draft' },
      { status: 400 },
    );
  }

  const parts: string[] = [];
  if (name) parts.push(`Название источника: ${name}`);
  if (tables.length) parts.push(`Таблицы: ${tables.slice(0, 20).join(', ')}`);
  parts.push(
    draft
      ? `Черновик описания от пользователя (сформулируй красиво по правилам выше):\n${draft}`
      : 'Черновика нет. Сгенерируй описание исходя из названия и таблиц.',
  );
  const userMessage = parts.join('\n\n');

  try {
    const openrouter = createAppOpenRouter();
    const modelId = resolveWhenToUseGeneratorModel();
    const { text } = await generateText({
      model: openrouter(modelId),
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
    });

    const whenToUse = text.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
    if (!whenToUse) {
      return Response.json({ error: 'LLM вернула пустой ответ' }, { status: 502 });
    }
    return Response.json({ whenToUse });
  } catch (err) {
    console.error('[generate-when-to-use] LLM call failed:', err);
    const message = err instanceof Error ? err.message : 'LLM недоступна';
    return Response.json({ error: message }, { status: 502 });
  }
}
