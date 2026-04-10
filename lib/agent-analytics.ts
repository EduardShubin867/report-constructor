/**
 * Persistent agent run log (SQLite) — запуски, SSE-события, топ запросов для welcome UI.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import type { AgentEvent } from '@/lib/agents/types';

const QUERY_MAX_LEN = 2000;
const SQL_PREVIEW_MAX = 120;
const DEBUG_STRING_PREVIEW_MAX = 240;

let dbSingleton: Database.Database | null = null;

function readBooleanEnv(name: string): boolean | null {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return null;
  if (value === '1' || value === 'true' || value === 'yes') return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return null;
}

export function isAgentAnalyticsEnabled(): boolean {
  return readBooleanEnv('AGENT_ANALYTICS_ENABLED') === true;
}

/**
 * Public popular queries expose aggregated user prompts in the welcome UI.
 * Keep this opt-in outside development to avoid leaking cross-user prompts.
 */
export function isPopularAgentQueriesPublicEnabled(): boolean {
  const explicit = readBooleanEnv('AGENT_ANALYTICS_PUBLIC_QUERIES_ENABLED');
  if (explicit !== null) return explicit;
  return process.env.NODE_ENV === 'development';
}

export function getAgentAnalyticsDbPath(): string {
  const fromEnv = process.env.AGENT_ANALYTICS_DB?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(/* turbopackIgnore: true */ process.cwd(), fromEnv);
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'agent-analytics.db');
}

function openDb(): Database.Database {
  const dbPath = getAgentAnalyticsDbPath();
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      query_raw TEXT NOT NULL,
      query_normalized TEXT NOT NULL,
      sub_agent TEXT,
      success INTEGER NOT NULL,
      error_message TEXT,
      duration_ms INTEGER NOT NULL,
      had_sql INTEGER NOT NULL,
      row_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS agent_run_events (
      run_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (run_id, seq)
    );
    CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_norm_success ON agent_runs(query_normalized, success);
  `);
  return db;
}

function getDb(): Database.Database | null {
  if (!isAgentAnalyticsEnabled()) return null;
  if (!dbSingleton) dbSingleton = openDb();
  return dbSingleton;
}

export function normalizeAgentQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').slice(0, QUERY_MAX_LEN);
}

function truncateQueryRaw(q: string): string {
  const t = q.trim();
  return t.length <= QUERY_MAX_LEN ? t : `${t.slice(0, QUERY_MAX_LEN)}…`;
}

function sanitizeDebugValueForStorage(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > DEBUG_STRING_PREVIEW_MAX
      ? {
          _redacted: true,
          length: value.length,
          preview: value.slice(0, DEBUG_STRING_PREVIEW_MAX),
        }
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 12).map(item => sanitizeDebugValueForStorage(item));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 24)
        .map(([key, nested]) => [key, sanitizeDebugValueForStorage(nested)]),
    );
  }
  return String(value);
}

/** Убираем полный SQL из payload перед записью в аналитическую БД. */
export function sanitizeAgentEventForStorage(event: AgentEvent): Record<string, unknown> {
  switch (event.type) {
    case 'skill': {
      if (event.name === 'validate_query') {
        const sql = event.args?.sql;
        if (typeof sql === 'string' && sql.length > 0) {
          const args = { ...(event.args as Record<string, unknown>) };
          delete args.sql;
          return {
            type: 'skill',
            name: event.name,
            args: { ...args, sqlLength: sql.length, sqlPreview: sql.slice(0, SQL_PREVIEW_MAX) },
          };
        }
      }
      return { type: 'skill', name: event.name, args: event.args };
    }
    case 'result': {
      const data = { ...(event.data as Record<string, unknown>) };
      const sql = data.sql;
      if (typeof sql === 'string' && sql.length > 0) {
        data.sql = {
          _redacted: true,
          length: sql.length,
          preview: sql.slice(0, SQL_PREVIEW_MAX),
        };
      }
      return { type: 'result', data };
    }
    case 'debug':
      return {
        type: 'debug',
        scope: event.scope,
        message: event.message,
        level: event.level,
        data: sanitizeDebugValueForStorage(event.data),
      };
    default:
      return event as unknown as Record<string, unknown>;
  }
}

function parseRunMeta(events: AgentEvent[]): {
  subAgent: string | null;
  success: boolean;
  errorMessage: string | null;
  hadSql: boolean;
} {
  const err = events.find((e): e is Extract<AgentEvent, { type: 'error' }> => e.type === 'error');
  const results = events.filter((e): e is Extract<AgentEvent, { type: 'result' }> => e.type === 'result');
  const lastResult = results[results.length - 1];
  const sub = [...events].reverse().find((e): e is Extract<AgentEvent, { type: 'sub_agent' }> => e.type === 'sub_agent');

  const sql = lastResult?.data?.sql;
  const hadSql = typeof sql === 'string' && sql.trim().length > 0;

  return {
    subAgent: sub?.name ?? null,
    success: !err,
    errorMessage: err?.error ?? null,
    hadSql,
  };
}

export interface RecordAgentRunParams {
  userQuery: string;
  events: AgentEvent[];
  durationMs: number;
}

/** Записать запуск и события (no-op если аналитика выключена). Ошибки БД только в лог. */
export function recordAgentRun(params: RecordAgentRunParams): void {
  const db = getDb();
  if (!db) return;

  const { userQuery, events, durationMs } = params;
  const queryRaw = truncateQueryRaw(userQuery);
  const queryNormalized = normalizeAgentQuery(userQuery);
  if (!queryNormalized) return;

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const meta = parseRunMeta(events);

  try {
    const insertRun = db.prepare(`
      INSERT INTO agent_runs (id, created_at, query_raw, query_normalized, sub_agent, success, error_message, duration_ms, had_sql, row_count)
      VALUES (@id, @created_at, @query_raw, @query_normalized, @sub_agent, @success, @error_message, @duration_ms, @had_sql, @row_count)
    `);
    const insertEv = db.prepare(`
      INSERT INTO agent_run_events (run_id, seq, event_type, payload_json)
      VALUES (@run_id, @seq, @event_type, @payload_json)
    `);

    db.transaction(() => {
      insertRun.run({
        id,
        created_at: createdAt,
        query_raw: queryRaw,
        query_normalized: queryNormalized,
        sub_agent: meta.subAgent,
        success: meta.success ? 1 : 0,
        error_message: meta.errorMessage,
        duration_ms: Math.max(0, Math.round(durationMs)),
        had_sql: meta.hadSql ? 1 : 0,
        row_count: null,
      });
      events.forEach((ev, seq) => {
        const payload = sanitizeAgentEventForStorage(ev);
        insertEv.run({
          run_id: id,
          seq,
          event_type: ev.type,
          payload_json: JSON.stringify(payload),
        });
      });
    })();
  } catch (e) {
    console.error('[agent-analytics] recordAgentRun failed:', e);
  }
}

export interface PopularQueryRow {
  query: string;
  count: number;
}

export function getPopularAgentQueries(days: number, limit: number): PopularQueryRow[] {
  const db = getDb();
  if (!db) return [];

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, Math.min(days, 365)));
  const cutoffIso = cutoff.toISOString();

  try {
    const rows = db
      .prepare(
        `WITH tops AS (
           SELECT query_normalized, COUNT(*) AS cnt
           FROM agent_runs
           WHERE success = 1 AND created_at >= @cutoff
           GROUP BY query_normalized
           ORDER BY cnt DESC
           LIMIT @limit
         )
         SELECT t.cnt AS cnt, (
           SELECT query_raw FROM agent_runs r2
           WHERE r2.query_normalized = t.query_normalized AND r2.success = 1
           ORDER BY r2.created_at DESC
           LIMIT 1
         ) AS query_raw
         FROM tops t
         ORDER BY t.cnt DESC`,
      )
      .all({ cutoff: cutoffIso, limit: Math.max(1, Math.min(limit, 50)) }) as { cnt: number; query_raw: string | null }[];

    return rows
      .filter(r => r.query_raw && r.query_raw.trim().length > 0)
      .map(r => ({ query: r.query_raw!.trim(), count: Number(r.cnt) }));
  } catch (e) {
    console.error('[agent-analytics] getPopularAgentQueries failed:', e);
    return [];
  }
}
