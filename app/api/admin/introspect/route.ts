/**
 * POST /api/admin/introspect
 *
 * Loads a StoredConnection by id, reads INFORMATION_SCHEMA for the given tables,
 * then uses an LLM to classify columns and detect foreign keys.
 * Returns a complete DataSource JSON ready to save.
 */

import { NextRequest } from 'next/server';
import sql from 'mssql';
import { createOpenRouterProvider } from '@/lib/llm/openrouter';
import { getConnection } from '@/lib/schema/store';
import type { DataSource, StoredConnection } from '@/lib/schema/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface IntrospectRequest {
  id: string;
  name: string;
  schema: string;
  tables: string[];
  connectionId: string;
  database: string;
}

interface ColumnInfo {
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: string;
}

interface FkInfo {
  fkTable: string;
  fkColumn: string;
  pkTable: string;
  pkColumn: string;
}

async function queryInformationSchema(
  conn: StoredConnection,
  database: string,
  schemaName: string,
  tables: string[],
): Promise<{ columns: ColumnInfo[]; fks: FkInfo[]; log: string[] }> {
  const log: string[] = [];

  const config: sql.config = {
    server: conn.server,
    database,
    user: conn.user,
    password: conn.password,
    port: conn.port ?? 1433,
    options: {
      encrypt: conn.encrypt ?? false,
      trustServerCertificate: conn.trustServerCertificate ?? true,
      connectTimeout: 10000,
    },
    pool: { max: 3, min: 0, idleTimeoutMillis: 10000 },
  };

  log.push(`Подключение к ${conn.server}/${database}...`);
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  log.push('Подключено.');

  try {
    // Query columns
    const inList = tables.map((_, i) => `@t${i}`).join(', ');
    const colReq = pool.request();
    colReq.input('schema', schemaName);
    tables.forEach((t, i) => colReq.input(`t${i}`, t));

    log.push(`Получение колонок для ${tables.length} таблиц...`);
    const colResult = await colReq.query<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      DATA_TYPE: string;
      IS_NULLABLE: string;
    }>(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema
        AND TABLE_NAME IN (${inList})
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const columns: ColumnInfo[] = colResult.recordset.map(r => ({
      tableName: r.TABLE_NAME,
      columnName: r.COLUMN_NAME,
      dataType: r.DATA_TYPE,
      isNullable: r.IS_NULLABLE,
    }));
    log.push(`Найдено ${columns.length} колонок.`);

    // Query formal foreign keys
    log.push('Получение внешних ключей...');
    const fkReq = pool.request();
    fkReq.input('schema2', schemaName);
    tables.forEach((t, i) => fkReq.input(`ft${i}`, t));

    const fkResult = await fkReq.query<{
      FK_TABLE: string;
      FK_COLUMN: string;
      PK_TABLE: string;
      PK_COLUMN: string;
    }>(`
      SELECT
        kcu1.TABLE_NAME  AS FK_TABLE,
        kcu1.COLUMN_NAME AS FK_COLUMN,
        kcu2.TABLE_NAME  AS PK_TABLE,
        kcu2.COLUMN_NAME AS PK_COLUMN
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu1
        ON rc.CONSTRAINT_NAME = kcu1.CONSTRAINT_NAME
        AND kcu1.TABLE_SCHEMA = @schema2
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu2
        ON rc.UNIQUE_CONSTRAINT_NAME = kcu2.CONSTRAINT_NAME
      WHERE kcu1.TABLE_NAME IN (${tables.map((_, i) => `@ft${i}`).join(', ')})
    `);

    const fks: FkInfo[] = fkResult.recordset.map(r => ({
      fkTable: r.FK_TABLE,
      fkColumn: r.FK_COLUMN,
      pkTable: r.PK_TABLE,
      pkColumn: r.PK_COLUMN,
    }));
    log.push(`Найдено ${fks.length} внешних ключей.`);

    return { columns, fks, log };
  } finally {
    await pool.close().catch(() => {});
  }
}

function buildLLMPrompt(
  sourceId: string,
  sourceName: string,
  schemaName: string,
  dialect: string,
  columns: ColumnInfo[],
  fks: FkInfo[],
): string {
  const byTable: Record<string, ColumnInfo[]> = {};
  for (const col of columns) {
    (byTable[col.tableName] ??= []).push(col);
  }

  const tableBlocks = Object.entries(byTable).map(([tbl, cols]) => {
    const colLines = cols.map(c => `  ${c.columnName} (${c.dataType}, nullable=${c.isNullable})`).join('\n');
    return `Table: ${tbl}\n${colLines}`;
  }).join('\n\n');

  const fkBlock = fks.length
    ? fks.map(f => `  ${f.fkTable}.${f.fkColumn} → ${f.pkTable}.${f.pkColumn}`).join('\n')
    : '  (не обнаружены формально — используй эвристику по именам вида ID_*)';

  return `Ты — эксперт по БД. Тебе нужно создать DataSource конфигурацию для системы AI-аналитики.

Система использует такие типы колонок:
- "number" — числовые: int, bigint, smallint, tinyint, decimal, numeric, float, real, money, smallmoney
- "string" — строковые: varchar, nvarchar, char, nchar, text, ntext
- "date" — даты: datetime, datetime2, date, smalldatetime, datetimeoffset
- "bit" — булевы: bit

Правила для "filterable: true":
- Только строковые колонки (type="string")
- Имена типа: Агент, СубАгент, Регион, РегионФакт, Вид*, Тип*, Категория*, Источник*, Цель*, Статус*, Марка, Модель, ЮрФизЛицо, КласcБонусМалус и т.п.
- НЕ ставь filterable для: номеров документов (Номер*, ID*, UID*), ИНН, ГРЗ, VIN, имён (Страхователь, Собственник без суффикса), дат

Правила для псевдонимов (alias):
- Главная таблица (та что с наибольшим числом колонок) — alias "m"
- Справочники — короткие латинские аббревиатуры (ДГ→dg, Территории→ter, КРМ→krm, КРП→krp, или придумай по смыслу)

Правила для внешних ключей:
- Формальные FK из INFORMATION_SCHEMA уже даны ниже
- Также ищи по паттерну: колонка называется ID_ЧтоТо → скорее всего FK на таблицу ЧтоТо
- Для каждого FK создай joinSql: LEFT JOIN [${schemaName}].[TargetTable] AS alias ON main.FK_COLUMN = alias.TARGET_COLUMN
- targetFields — перечисли 1-3 наиболее полезных колонки из целевой таблицы (не ID-ключи)

## Данные таблиц

${tableBlocks}

## Формальные внешние ключи

${fkBlock}

## Задание

Верни ТОЛЬКО валидный JSON (без markdown-обёртки) в следующем формате:

{
  "id": "${sourceId}",
  "name": "${sourceName}",
  "dialect": "${dialect}",
  "schema": "${schemaName}",
  "tables": [
    {
      "name": "ИмяТаблицы",
      "alias": "m",
      "columns": [
        { "name": "КолонкаЧисловая", "type": "number" },
        { "name": "КолонкаСтрока", "type": "string", "filterable": true },
        { "name": "КолонкаДата", "type": "date" },
        { "name": "КолонкаБит", "type": "bit" }
      ],
      "foreignKeys": [
        {
          "column": "ID_ДГ",
          "targetTable": "ДГ",
          "targetColumn": "Код",
          "alias": "dg",
          "targetFields": ["Наименование"],
          "joinSql": "LEFT JOIN [${schemaName}].[ДГ] AS dg ON m.ID_ДГ = dg.Код"
        }
      ]
    },
    {
      "name": "СправочникТаблица",
      "columns": []
    }
  ]
}

ВАЖНО:
- Главная таблица (с колонками) — первой в массиве tables
- Таблицы-справочники (целевые для FK) — добавь в конец с пустым "columns: []"
- Не добавляй поле "filterable" если оно false (только если true)
- foreignKeys включай только в основную таблицу`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY не настроен' }, { status: 500 });
  }

  let body: IntrospectRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, name, schema, tables, connectionId, database } = body;

  if (!id || !name || !tables?.length || !connectionId || !database) {
    return Response.json({ error: 'Заполните все обязательные поля' }, { status: 400 });
  }

  // Load connection from store
  const conn = getConnection(connectionId);
  if (!conn) {
    return Response.json({ error: `Подключение "${connectionId}" не найдено. Сначала создайте его.` }, { status: 404 });
  }

  const log: string[] = [];
  log.push(`Используется подключение: ${conn.name} (${conn.server}/${database})`);

  try {
    // Step 1: query DB
    const { columns, fks, log: dbLog } = await queryInformationSchema(conn, database, schema, tables);
    log.push(...dbLog);

    if (columns.length === 0) {
      return Response.json({
        error: `Колонки не найдены. Проверьте имена таблиц и название схемы (указано: "${schema}").`,
        log,
      }, { status: 422 });
    }

    // Step 2: LLM classification
    log.push('Отправка данных в LLM для классификации...');
    const prompt = buildLLMPrompt(id, name, schema, conn.dialect, columns, fks);

    const model = process.env.OPENROUTER_AGENT_MODEL ?? process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-001';
    const provider = createOpenRouterProvider({ apiKey, siteUrl: process.env.NEXT_PUBLIC_SITE_URL });

    const result = await provider.call({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const content = result.message.content ?? '';
    log.push('Ответ LLM получен. Парсинг...');

    // Extract JSON
    let source: DataSource | null = null;
    const tryParse = (s: string) => {
      try { return JSON.parse(s) as DataSource; } catch { return null; }
    };

    source = tryParse(content)
      ?? tryParse(content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? '')
      ?? tryParse(content.match(/\{[\s\S]*\}/)?.[0] ?? '');

    if (!source?.tables) {
      log.push('Ошибка парсинга JSON от LLM.');
      return Response.json({ error: 'LLM вернул невалидный JSON', log, rawContent: content }, { status: 502 });
    }

    // ── Validate LLM output against ground truth from INFORMATION_SCHEMA ────
    const knownTables = new Set(tables);
    const knownColumns = new Set(columns.map(c => `${c.tableName}.${c.columnName}`));
    const VALID_TYPES = new Set<string>(['number', 'string', 'date', 'bit']);
    const SAFE_JOIN_RE = /^(LEFT\s+|INNER\s+|RIGHT\s+)?JOIN\s+\[?\w[\w\u0400-\u04FF]*\]?\s*\.\s*\[?\w[\w\u0400-\u04FF ]*\]?\s+AS\s+\w+\s+ON\s+[\w\u0400-\u04FF\[\]._\s=]+$/i;

    const sanitizedTables = source.tables
      .filter(t => {
        if (!knownTables.has(t.name)) {
          log.push(`[LLM-guard] Отброшена выдуманная таблица: ${t.name}`);
          return false;
        }
        return true;
      })
      .map(t => ({
        ...t,
        alias: typeof t.alias === 'string' && /^\w{1,10}$/.test(t.alias) ? t.alias : undefined,
        columns: t.columns
          .filter(col => {
            if (!knownColumns.has(`${t.name}.${col.name}`)) {
              log.push(`[LLM-guard] Отброшена выдуманная колонка: ${t.name}.${col.name}`);
              return false;
            }
            if (!VALID_TYPES.has(col.type)) {
              log.push(`[LLM-guard] Недопустимый тип ${col.name}: ${col.type} → string`);
              (col as { type: string }).type = 'string';
            }
            if ((col as { filterable?: boolean }).filterable && col.type !== 'string') {
              delete (col as { filterable?: boolean }).filterable;
            }
            if ((col as { filterable?: boolean }).filterable === false) {
              delete (col as { filterable?: boolean }).filterable;
            }
            return true;
          }),
        foreignKeys: (t.foreignKeys ?? []).filter(fk => {
          const joinSqlStr = typeof fk.joinSql === 'string' ? fk.joinSql.trim() : '';
          if (!SAFE_JOIN_RE.test(joinSqlStr)) {
            log.push(`[LLM-guard] Отброшен небезопасный joinSql для ${fk.column}: ${joinSqlStr.slice(0, 80)}`);
            return false;
          }
          if (typeof fk.targetTable !== 'string' || !/^[\w\u0400-\u04FF ]+$/.test(fk.targetTable)) {
            log.push(`[LLM-guard] Отброшен FK с недопустимым targetTable: ${fk.targetTable}`);
            return false;
          }
          if (!Array.isArray(fk.targetFields)) fk.targetFields = [];
          fk.targetFields = fk.targetFields.filter(
            (f): f is string => typeof f === 'string' && /^[\w\u0400-\u04FF ]+$/.test(f),
          );
          return true;
        }),
      }));

    source.tables = sanitizedTables;
    log.push(`[LLM-guard] Валидация пройдена: ${sanitizedTables.length} таблиц, ${sanitizedTables.flatMap(t => t.columns).length} колонок.`);

    // Set connectionId + database (no embedded credentials)
    source.connectionId = connectionId;
    source.database = database;
    // dialect from connection
    source.dialect = conn.dialect;

    log.push('Готово.');
    return Response.json({ source, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`Ошибка: ${msg}`);
    return Response.json({ error: msg, log }, { status: 500 });
  }
}
