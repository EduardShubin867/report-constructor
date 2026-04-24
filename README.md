# Constructor

**Constructor** — веб-приложение **для построения отчётов поверх произвольных корпоративных данных**: чат с AI, ручной конструктор, экспорт, админка подключений и схем. Фронтенд и BFF на **Next.js 16** (App Router, **React 19**, **Tailwind CSS v4**), к данным — **Microsoft SQL Server** через серверные API-роуты; источники и таблицы описываются в конфигурации, так что сценарий не привязан к одной предметной области. Подробности по коду — в [`CLAUDE.md`](./CLAUDE.md).

## Локальный запуск

```bash
npm install
npm run dev
```

Открой в браузере **http://localhost:3000/constructor** — в [`next.config.ts`](./next.config.ts) задан [`basePath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath) `/constructor`, поэтому приложение обслуживается под этим префиксом, а не в корне сайта.

Сборка и прод-режим:

```bash
npm run build
npm start
```

## Переменные окружения

Минимально для работы с БД и LLM (имена ориентировочные — сверяй с тем, что читает `lib/db.ts` и `lib/llm/`):

- **SQL Server:** `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, при необходимости `DB_PORT`, `DB_ENCRYPT`, `DB_TRUST_CERT`
- **OpenRouter (AI):** `OPENROUTER_API_KEY`, опционально `OPENROUTER_MODEL`

Админка и прочее — см. [`docker-compose.yml`](./docker-compose.yml) (там же пример `ADMIN_PASSWORD`, `AGENT_ANALYTICS_ENABLED`).

## Основные разделы UI

| Путь | Назначение |
|------|------------|
| `/constructor` | редирект → `/constructor/reports` |
| `/constructor/reports` | редирект → чат с отчётами |
| `/constructor/reports/chat` | чат: **AI-аналитик** (SQL) и режим **ОСАГО-агент** |
| `/constructor/reports/manual` | ручной конструктор отчёта (фильтры, колонки, Excel) |
| `/constructor/reports/linked` | связанные отчёты |
| `/constructor/admin` | админка (логин, подключения, схемы, скиллы, source links) |

## OSAGO ML-агент (внешний бэкенд)

Чат в режиме «ОСАГО-агент» ходит на отдельный ML-сервис через приложение: API-роут **`/api/osago-agent`** (прокси и SSE; графики — **`/api/osago-agent/charts/[filename]`**).

Переменные на стороне Next.js (server-only):

```bash
OSAGO_AGENT_BASE_URL=http://localhost:8000
OSAGO_AGENT_DOCKER_BASE_URL=http://host.docker.internal:8000
OSAGO_AGENT_USERNAME=admin
OSAGO_AGENT_PASSWORD=change-me
OSAGO_AGENT_TIMEOUT_MS=1200000
OSAGO_AGENT_SSE_HEARTBEAT_MS=15000
```

- **`OSAGO_AGENT_BASE_URL`** — для локального `next dev` / `next start`.
- В **Docker** в контейнер обычно пробрасывают `OSAGO_AGENT_BASE_URL` из `OSAGO_AGENT_DOCKER_BASE_URL` (см. `docker-compose.yml`).

`OSAGO_AGENT_SSE_HEARTBEAT_MS` задаёт интервал keepalive при длинных ответах агента.

## Docker

```bash
docker compose up --build
```

По умолчанию приложение публикуется на **порту 3400** (маппинг `3400:3000`), внутри контейнера задано `NEXT_PUBLIC_SITE_URL` с префиксом `/constructor`. Каталог **`./data`** монтируется в контейнер (права на запись для пользователя приложения, см. комментарий в compose-файле).

## Скрипты npm

| Команда | Описание |
|---------|----------|
| `npm run dev` | dev-сервер |
| `npm run build` / `npm start` | production |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:unit` | Jest (unit + API route tests) |
| `npm run test:e2e` | сборка + Playwright |
| `npm run test:ci` | lint + unit + build + e2e |

## Документация Next.js

- [Документация Next.js](https://nextjs.org/docs)
- [Создание Next.js-приложения](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
