@AGENTS.md

# OSAGO Report Generator

Генератор отчётов по марже ОСАГО. Next.js 16 (App Router, React 19, Tailwind v4) + SQL Server.

## Архитектура

```
app/
├── page.tsx                              # Redirect → /reports
├── reports/page.tsx                      # Основная страница (табы: AI / Ручной)
└── api/
    ├── agent/route.ts                    # AI-агент: system prompt + multi-turn tool calling
    ├── query/route.ts                    # Выполнение SQL (валидация → execute → result)
    ├── query/export/route.ts             # Excel-экспорт AI-отчёта
    └── report/
        ├── route.ts                      # Ручной отчёт (фильтры → SQL → result)
        ├── filters/route.ts              # Distinct-значения для дропдаунов
        └── export/route.ts               # Excel-экспорт ручного отчёта

lib/
├── db.ts                                 # mssql connection pool singleton
├── sql-validator.ts                      # Валидация SQL (blocklist, whitelist, auto-TOP)
├── sql-format.ts                         # Форматирование SQL в multi-line
├── report-columns.ts                     # Определения колонок для ручного отчёта
├── query-builder.ts                      # Построитель SQL для ручного отчёта
├── agent-skills.ts                       # Re-export из skills/registry.ts
└── skills/                               # ← Модульная система скиллов агента
    ├── types.ts                          # Интерфейс ToolSkill + ToolDefinition
    ├── registry.ts                       # Реестр: tools + индекс инструкций
    ├── read-instruction.ts               # Tool: чтение полного текста инструкции
    └── instructions/                     # ← .md файлы — lazy-loaded инструкции
        └── *.md                          # Каждый файл = отдельная инструкция

components/
├── AgentInput.tsx                        # AI-ввод, фазы, retry, self-validation
├── SqlHighlight.tsx                      # Подсветка SQL с кастомным токенизатором
├── SqlResultTable.tsx                    # Таблица результатов AI-запроса
├── ReportFilters.tsx                     # Фильтры ручного отчёта
├── ReportTable.tsx                       # Таблица ручного отчёта с пагинацией
├── ColumnSelector.tsx                    # Выбор колонок
└── MultiSelect.tsx                       # Мультиселект с поиском
```

## Система скиллов агента

Универсальная, расширяемая система. System prompt НЕ содержит упоминаний конкретных скиллов — агент узнаёт о них из tool definitions и каталога инструкций.

### Два типа скиллов

**Tool Skills** (`.ts` файлы в `lib/skills/`) — вызываемые инструменты через function-calling.
Каждый файл экспортирует объект `ToolSkill`:

```ts
import type { ToolSkill } from './types';

const mySkill: ToolSkill = {
  kind: 'tool',
  name: 'my_skill_name',
  description: 'Описание для LLM — когда вызывать',
  parameters: {
    type: 'object',
    properties: { /* ... */ },
    required: ['param1'],
  },
  async execute(args) {
    return 'результат';
  },
};
export default mySkill;
```

После создания — импортируй в `registry.ts` и добавь в массив `TOOL_SKILLS`.

**Instructions** (`.md` файлы в `lib/skills/instructions/`) — текстовые инструкции, загружаемые лениво.

Как это работает:
1. При старте реестр читает из каждого `.md` файла только первые 2 непустые строки (заголовок + краткое описание)
2. Превью инжектятся в system prompt как каталог доступных инструкций
3. Агент вызывает tool `read_instruction` с именем файла, чтобы получить полный текст
4. Инструкции могут ссылаться на tool-скиллы по имени (например, "вызови `lookup_dg`") — агент вызовет инструмент

Это позволяет добавлять сколько угодно инструкций без раздувания system prompt.

### Как добавить новый скилл

**Tool (вызываемый):**
1. Создай `lib/skills/my-skill.ts`, экспортируй `ToolSkill`
2. В `registry.ts`: импортируй и добавь в `TOOL_SKILLS`

**Instruction (текстовая):**
1. Создай `lib/skills/instructions/my-instruction.md`
2. Готово — первые 2 строки автоматически попадут в system prompt как превью

### Связь между инструкциями и тулзами

Инструкции (`.md`) могут ссылаться на тулзы по имени. Например, в `sql-best-practices.md`:
> При фильтрации по ДГ используй `lookup_dg` чтобы найти точный Код

Агент прочитает инструкцию и вызовет указанную тулзу. Это позволяет хранить сложную логику (workflow из нескольких шагов) в `.md`, а не в system prompt.

## БД и схема

- СУБД: Microsoft SQL Server
- Основная таблица: `[dbo].[Журнал_ОСАГО_Маржа]`
- Справочники: `[dbo].[ДГ]`, `[dbo].[Территории]`, `[dbo].[КРМ]`, `[dbo].[КРП]`
- Все имена кириллические — в `[квадратных скобках]`
- FK: `m.ID_ДГ → dg.Код`, `m.ID_ТерриторияИспользованияТС → ter.ID`

## AI-агент

- LLM через OpenRouter (`.env`: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`)
- Multi-turn loop: до 5 раундов tool-calling
- System prompt — универсальный, без хардкода конкретных скиллов
- Самопроверка: агент вызывает `validate_query` перед финальным ответом
- Lazy instructions: агент видит превью инструкций, читает полные через `read_instruction`
- Клиентская страховка: если SQL вернул 0 строк, `AgentInput` повторно отправляет запрос
- Автокоррекция: до 2 retry при ошибках SQL или пустых результатах
- SQL-валидация: blocklist → whitelist → auto-TOP 5000

## Соглашения

- `'use client'` только где нужен React state / browser API
- Все SQL через `mssql` parameterized requests (`.input()`)
- Колонки валидируются по whitelist перед интерполяцией в SQL
- HTTP-заголовки — только ASCII (no Cyrillic in headers)
- Анимации: framer-motion
