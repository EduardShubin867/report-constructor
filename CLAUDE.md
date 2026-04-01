@AGENTS.md

# Report Generator

Генератор отчётов по страховой марже. Next.js 16 (App Router, React 19, Tailwind v4) + SQL Server.
Сейчас работает с ОСАГО, архитектура готова к добавлению новых источников (КАСКО и др.).

## Архитектура

```
app/
├── page.tsx                              # Redirect → /reports
├── reports/page.tsx                      # Основная страница (табы: AI / Ручной)
└── api/
    ├── agent/route.ts                    # AI-агент: SSE + multi-turn tool calling
    ├── query/route.ts                    # Выполнение SQL (валидация → кэш → execute)
    ├── query/export/route.ts             # Excel-экспорт AI-отчёта
    └── report/
        ├── route.ts                      # Ручной отчёт (фильтры → SQL → result)
        ├── filters/route.ts              # Distinct-значения для дропдаунов
        └── export/route.ts               # Excel-экспорт ручного отчёта

lib/
├── db.ts                                 # mssql pool singleton + queryWithTimeout
├── query-cache.ts                        # In-memory TTL-кэш результатов SQL
├── sql-validator.ts                      # Валидация SQL (blocklist, whitelist, auto-limit)
├── sql-format.ts                         # Форматирование SQL в multi-line
├── report-columns.ts                     # Определения колонок для ручного отчёта
├── query-builder.ts                      # Построитель SQL для ручного отчёта
├── agent-skills.ts                       # Re-export из skills/registry.ts
├── agents/                               # ← Оркестратор + суб-агенты
│   ├── types.ts                          # SubAgentConfig, AgentContext, AgentEvent
│   ├── runner.ts                         # Generic tool-calling loop
│   ├── registry.ts                       # Реестр суб-агентов + resolveModel
│   ├── orchestrator.ts                   # Маршрутизация запросов к суб-агентам
│   ├── sql-analyst.ts                    # Дефолтный суб-агент (SQL-аналитик)
│   └── index.ts                          # Re-exports
├── schema/                               # ← Структурированные определения схемы БД
│   ├── types.ts                          # Интерфейсы: DataSource, TableSchema, ColumnSchema
│   ├── osago.ts                          # Определение источника ОСАГО
│   ├── index.ts                          # Реестр источников + derived-наборы
│   └── to-prompt.ts                      # Генерация текста схемы для system prompt
├── llm/                                  # ← Абстракция LLM-провайдера
│   ├── types.ts                          # Интерфейс LLMProvider
│   └── openrouter.ts                     # Реализация для OpenRouter
└── skills/                               # ← Модульная система скиллов агента
    ├── types.ts                          # Интерфейс ToolSkill + ToolDefinition
    ├── registry.ts                       # Реестр tools + реэкспорт текстовых инструкций
    ├── text-instructions.ts              # Единый каталог: .md + data/skills.json
    ├── instructions-fs.ts              # Список / чтение встроенных .md
    ├── read-instruction.ts               # Tool: полный текст инструкции по id
    └── instructions/                     # ← встроенные .md (репозиторий)
        └── *.md

data/
└── skills.json                           # Текстовые инструкции из админки (опционально)

components/
├── AgentInput.tsx                        # AI-ввод, фазы, retry, self-validation
├── SqlHighlight.tsx                      # Подсветка SQL с кастомным токенизатором
├── SqlResultTable.tsx                    # Таблица результатов AI-запроса
├── ReportFilters.tsx                     # Фильтры ручного отчёта
├── ReportTable.tsx                       # Таблица ручного отчёта с пагинацией
├── ColumnSelector.tsx                    # Выбор колонок
└── MultiSelect.tsx                       # Мультиселект с поиском
```

## Система схем (`lib/schema/`)

Схема БД описана как структурированные данные, не строки. Единый источник правды для:
- System prompt агента (генерируется через `schemaToPrompt()`)
- Whitelist таблиц в SQL-валидаторе (`ALLOWED_TABLES`)
- Whitelist filterable-колонок в скилле `list_column_values` (`FILTERABLE_COLUMNS`)

### Как добавить новый источник данных

1. Создай `lib/schema/kasko.ts`, экспортируй `KASKO_SOURCE: DataSource`
2. В `lib/schema/index.ts`: импортируй и добавь в массив `DATA_SOURCES`
3. Готово — валидатор разрешит новые таблицы, скиллы увидят новые колонки, промпт обновится

### Структура DataSource

```ts
interface DataSource {
  id: string;           // 'osago', 'kasko'
  name: string;         // 'ОСАГО Маржа' — для промптов
  dialect: SqlDialect;  // 'mssql' | 'postgres' | 'clickhouse'
  schema: string;       // 'dbo'
  tables: TableSchema[];
}

interface TableSchema {
  name: string;         // 'Журнал_ОСАГО_Маржа'
  alias?: string;       // 'm'
  columns: ColumnSchema[];
  foreignKeys?: ForeignKey[];
}

interface ColumnSchema {
  name: string;
  type: 'number' | 'string' | 'date' | 'bit';
  filterable?: boolean; // доступен через list_column_values
}
```

### Ключевые экспорты из `lib/schema/index.ts`

- `DATA_SOURCES` — массив всех зарегистрированных источников
- `ACTIVE_SOURCE` — текущий активный источник (для промпта агента)
- `ALLOWED_TABLES` — объединение таблиц из ВСЕХ источников (для валидатора)
- `FILTERABLE_COLUMNS` — объединение filterable-колонок (для скилла)

## LLM-провайдер (`lib/llm/`)

Абстракция над LLM API. Агент работает через интерфейс `LLMProvider`, не зная о конкретном провайдере.

```ts
interface LLMProvider {
  call(options: LLMCallOptions): Promise<LLMCallResult>;
}
```

Сейчас реализован `createOpenRouterProvider()` в `lib/llm/openrouter.ts`.
Для нового провайдера достаточно реализовать один метод `call()`.

## SQL-валидатор (`lib/sql-validator.ts`)

Параметризованный по диалекту. 5 слоёв защиты:
1. Удаление комментариев
2. Проверка `SELECT` в начале
3. Keyword blocklist (DDL, DML, EXEC, system functions)
4. Table whitelist (из `ALLOWED_TABLES` schema-реестра)
5. Auto-inject row limit: `TOP N` (mssql) или `LIMIT N` (postgres/clickhouse)

```ts
type SqlDialect = 'mssql' | 'postgres' | 'clickhouse';
validateSql(sql, { allowedTables?, dialect?, maxRows? })
```

Дефолты: `ALLOWED_TABLES` из schema, `'mssql'`, `5000`.

## SQL таймауты (`lib/db.ts`)

Все SQL-запросы выполняются через `queryWithTimeout()` с `Promise.race` + `request.cancel()`.

```ts
const TIMEOUT = {
  HEALTH: 5_000,   // health check
  SKILL: 10_000,   // lookup-скиллы агента
  QUERY: 15_000,   // AI-запросы, фильтры
  REPORT: 30_000,  // ручной отчёт с пагинацией
  EXPORT: 60_000,  // Excel-экспорт
};
```

## Кэш запросов (`lib/query-cache.ts`)

In-memory TTL-кэш (60s, max 50 entries). Устраняет двойное выполнение SQL:
- `validate_query` (скилл агента) выполняет SQL и кладёт результат в кэш
- `/api/query` проверяет кэш перед повторным выполнением

## Система скиллов агента

Универсальная, расширяемая система. System prompt НЕ содержит упоминаний конкретных скиллов — агент узнаёт о них из tool definitions и каталога инструкций.

### Два слоя: callable tools и текстовые инструкции

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

**Текстовые инструкции** — одна сущность для агента, два источника хранения:
1. **Репозиторий:** `lib/skills/instructions/*.md` — id = имя файла без `.md`, правки через git.
2. **Админка:** `data/skills.json` — записи с полями как у `Skill` в `lib/schema/types.ts`. Запись с **тем же id**, что у встроенного `.md`, — это **переопределение**: при `enabled: true` агент читает текст из JSON; при `enabled: false` или после удаления записи снова используется файл из репо.

Как это работает:
1. `getTextInstructionsCatalog()` собирает превью с учётом оверрайдов и фильтров `sources` / `agents` для JSON-строк.
2. Один tool `read_instruction` с параметром `id` отдаёт полный текст (активное переопределение или `.md` или чисто JSON-инструкция).
3. Текстовые инструкции могут ссылаться на tool-скиллы по имени — агент вызовет инструмент.

### Как добавить новый скилл

**Tool (вызываемый):**
1. Создай `lib/skills/my-skill.ts`, экспортируй `ToolSkill`
2. В `registry.ts`: импортируй и добавь в `TOOL_SKILLS`

**Текстовая инструкция (репозиторий):**
1. Создай `lib/skills/instructions/my-instruction.md`
2. Готово — превью попадёт в каталог; полный текст по `read_instruction` с `id` = `my-instruction`

**Текстовая инструкция (админка):**
1. Вкладка Skills в `/admin` — новая запись с любым id **кроме** уже занятых чисто JSON-инструкций; тот же id, что у `.md`, создаёт переопределение файла.

### Связь между инструкциями и тулзами

Инструкции (`.md`) могут ссылаться на тулзы по имени. Например, в `sql-best-practices.md`:
> При фильтрации по ДГ используй `lookup_dg` чтобы найти точный Код

Агент прочитает инструкцию и вызовет указанную тулзу. Это позволяет хранить сложную логику (workflow из нескольких шагов) в `.md`, а не в system prompt.

## БД и схема

- СУБД: Microsoft SQL Server
- Источник ОСАГО: `[dbo].[Журнал_ОСАГО_Маржа]` + справочники `[dbo].[ДГ]`, `[dbo].[Территории]`, `[dbo].[КРМ]`, `[dbo].[КРП]`
- Все имена кириллические — в `[квадратных скобках]`
- FK: `m.ID_ДГ → dg.Код`, `m.ID_ТерриторияИспользованияТС → ter.ID`

## Оркестратор и суб-агенты (`lib/agents/`)

Архитектура: **Оркестратор → Суб-агенты**. Оркестратор маршрутизирует запрос к нужному суб-агенту.

### Маршрутизация (как оркестратор выбирает агента)

Трёхуровневая, от быстрого к медленному:

1. **1 агент** → вызывается напрямую, без overhead
2. **`match(ctx)` scoring** → каждый агент может определить функцию `match`, которая возвращает confidence score 0–1. Если ровно один агент набрал ≥ 0.5 — он и выбирается (без LLM). При равных top-scores → неоднозначность → fallback на LLM.
3. **LLM routing** → fallback. Оркестратор отправляет каталог агентов (name + description) и запрос пользователя — LLM возвращает имя агента.

```ts
// Пример match-функции — по ключевым словам
match(ctx) {
  const q = ctx.query.toLowerCase();
  if (/sql|запрос|отчёт|таблиц|выбор|агрегац/.test(q)) return 0.9;
  if (/данн|стат/.test(q)) return 0.6;
  return 0;
},
```

### Резолвинг модели

Две отдельные цепочки:

- **Роутер (оркестратор):** `opts.routerModel` → `OPENROUTER_ROUTER_MODEL` → `OPENROUTER_MODEL` → hardcoded fallback
- **Суб-агент:** `agent.model` → `OPENROUTER_AGENT_MODEL` → `OPENROUTER_MODEL` → hardcoded fallback

`OPENROUTER_MODEL` — общий fallback, если хочется одну модель на всё. Специфичные `_ROUTER_MODEL` / `_AGENT_MODEL` перебивают его.

### Как добавить нового суб-агента

1. Создай `lib/agents/my-agent.ts`, экспортируй `SubAgentConfig`
2. В `lib/agents/registry.ts`: импортируй и добавь в `SUB_AGENTS`

```ts
import type { SubAgentConfig } from './types';

const myAgent: SubAgentConfig = {
  name: 'my-agent',
  description: 'Описание для маршрутизации (LLM-fallback читает это)',
  model: 'anthropic/claude-sonnet-4',  // опционально, иначе из env/default
  maxRounds: 3,                         // опционально, default 5

  // Быстрый роутинг без LLM (опционально)
  match(ctx) {
    return /keyword/.test(ctx.query.toLowerCase()) ? 0.9 : 0;
  },

  buildSystemPrompt(ctx) { return '...'; },
  buildUserMessage(ctx) { return ctx.query; },
  tools: [],                            // ToolDefinition[] — function-calling tools
  executeSkill(name, args) { ... },
  parseResult(content) { ... },         // вернуть null если ответ не финальный
  finalNudge: '...',                    // опционально — message если tools закончились
};
export default myAgent;
```

### Дефолтные суб-агенты

- **sql-analyst** — генерация SQL-запросов для отчётов ОСАГО. Использует скиллы из `lib/skills/`.

### Компоненты системы

- **`types.ts`** — `SubAgentConfig`, `AgentContext`, `AgentEvent`, `match()`
- **`runner.ts`** — generic tool-calling loop (до N раундов, финальный nudge)
- **`registry.ts`** — реестр суб-агентов, `resolveModel()`
- **`orchestrator.ts`** — 3-уровневая маршрутизация (single → match → LLM)
- **`sql-analyst.ts`** — дефолтный суб-агент (извлечён из route.ts)

## AI-агент (детали sql-analyst)

- LLM через абстракцию `LLMProvider` (сейчас OpenRouter, `.env`: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`)
- Multi-turn loop: до 5 раундов tool-calling
- System prompt генерируется из `ACTIVE_SOURCE` через `schemaToPrompt()`
- Самопроверка: агент вызывает `validate_query` перед финальным ответом
- Lazy text instructions: единый каталог (`.md` + `data/skills.json`), полный текст через `read_instruction` с `id`
- Клиентская страховка: если SQL вернул 0 строк, `AgentInput` повторно отправляет запрос
- Автокоррекция: до 2 retry при ошибках SQL или пустых результатах
- SQL-валидация: blocklist → whitelist → auto-limit (dialect-aware)

## Соглашения

- `'use client'` только где нужен React state / browser API
- Все SQL через `mssql` parameterized requests (`.input()`)
- Все SQL-запросы через `queryWithTimeout()` — без исключений
- Колонки валидируются по whitelist перед интерполяцией в SQL
- HTTP-заголовки — только ASCII (no Cyrillic in headers)
- Анимации: framer-motion
- Схема БД описывается в `lib/schema/*.ts`, не хардкодится в промптах или валидаторах
