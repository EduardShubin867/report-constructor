import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { NextRequest, NextResponse } from 'next/server';
import type {
  ArtifactPayload,
  AssistantMessageTone,
  SavedChatAssistantMessage,
  SavedChatSession,
  SavedChatSummary,
  SavedChatTurn,
  SavedChatTurnInput,
} from '@/lib/report-history-types';

const ALLOWED_TONES: ReadonlySet<AssistantMessageTone> = new Set(['info', 'warning', 'error']);

function safeTone(value: unknown): AssistantMessageTone | undefined {
  return typeof value === 'string' && ALLOWED_TONES.has(value as AssistantMessageTone)
    ? (value as AssistantMessageTone)
    : undefined;
}

function safeDetail(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

const VIEWER_COOKIE_NAME = 'constructor_viewer_id';
const MAX_CHATS_PER_VIEWER = 6;
const QUERY_PREVIEW_MAX = 240;
const CHAT_SCHEMA_VERSION = 2;

let dbSingleton: Database.Database | null = null;

interface ChatSessionRow {
  id: string;
  first_query: string;
  latest_query: string;
  created_at: string;
  updated_at: string;
  turn_count: number;
}

interface ChatTurnRow {
  id: string;
  version_index: number;
  created_at: string;
  query_text: string;
  result_json: string;
}

interface StoredChatTurnEnvelope {
  schemaVersion: number;
  turn: {
    createdAt?: string;
    userQuery?: string;
    assistant?: SavedChatAssistantMessage;
  };
}

function normalizeEntityId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[a-z0-9_-]{16,80}$/i.test(trimmed) ? trimmed : null;
}

function truncateQuery(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= QUERY_PREVIEW_MAX) return normalized;
  return `${normalized.slice(0, QUERY_PREVIEW_MAX - 1)}…`;
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function isArtifactPayload(value: unknown): value is ArtifactPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ArtifactPayload>;
  return Array.isArray(candidate.data)
    && Array.isArray(candidate.columns)
    && typeof candidate.rowCount === 'number'
    && typeof candidate.sql === 'string'
    && typeof candidate.explanation === 'string'
    && typeof candidate.validatedSql === 'string';
}

function normalizeArtifactPayload(value: ArtifactPayload): ArtifactPayload {
  return {
    data: Array.isArray(value.data) ? value.data : [],
    columns: Array.isArray(value.columns) ? value.columns.map(String) : [],
    rowCount: Number.isFinite(value.rowCount) ? value.rowCount : 0,
    validatedSql: value.validatedSql ?? '',
    sql: value.sql ?? '',
    explanation: value.explanation ?? '',
    ...(Array.isArray(value.warnings) ? { warnings: value.warnings.map(String) } : {}),
    ...(typeof value.skillRounds === 'number' ? { skillRounds: value.skillRounds } : {}),
    ...(value.skipAutoRowLimit === true ? { skipAutoRowLimit: true } : {}),
  };
}

function normalizeAssistantMessage(
  assistant: SavedChatAssistantMessage | undefined,
  fallbackText: string,
): SavedChatAssistantMessage {
  const suggestions = safeStringArray(assistant?.suggestions);
  const text = assistant?.text?.trim() || fallbackText;

  const tone = safeTone((assistant as { tone?: unknown } | undefined)?.tone);

  if (assistant?.kind === 'artifact' && assistant.artifact && isArtifactPayload(assistant.artifact)) {
    const artifact = normalizeArtifactPayload(assistant.artifact);
    return {
      kind: 'artifact',
      text: text || artifact.explanation || 'Отчёт сформирован.',
      suggestions,
      artifact,
      ...(tone ? { tone } : {}),
    };
  }

  const detail = safeDetail((assistant as { detail?: unknown } | undefined)?.detail);
  return {
    kind: 'text',
    text: text || 'Ответ сформирован.',
    suggestions,
    ...(tone ? { tone } : {}),
    ...(detail ? { detail } : {}),
  };
}

function toLegacyArtifactTurn(row: ChatTurnRow, parsed: unknown): SavedChatTurn {
  const artifact = isArtifactPayload(parsed)
    ? normalizeArtifactPayload(parsed)
    : normalizeArtifactPayload({
        data: [],
        columns: [],
        rowCount: 0,
        validatedSql: '',
        sql: '',
        explanation: 'Не удалось восстановить артефакт.',
      });

  return {
    id: row.id,
    createdAt: row.created_at,
    userQuery: row.query_text,
    assistant: {
      kind: 'artifact',
      text: artifact.explanation || 'Отчёт сформирован.',
      suggestions: [],
      artifact,
    },
  };
}

function toStoredEnvelope(turn: SavedChatTurnInput, createdAt: string): StoredChatTurnEnvelope {
  return {
    schemaVersion: CHAT_SCHEMA_VERSION,
    turn: {
      createdAt,
      userQuery: turn.userQuery.trim(),
      assistant: normalizeAssistantMessage(turn.assistant, ''),
    },
  };
}

function parseStoredTurn(row: ChatTurnRow): SavedChatTurn {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.result_json);
  } catch {
    parsed = null;
  }

  if (
    parsed
    && typeof parsed === 'object'
    && (parsed as Partial<StoredChatTurnEnvelope>).schemaVersion === CHAT_SCHEMA_VERSION
    && typeof (parsed as StoredChatTurnEnvelope).turn === 'object'
  ) {
    const stored = parsed as StoredChatTurnEnvelope;
    return {
      id: row.id,
      createdAt: stored.turn.createdAt || row.created_at,
      userQuery: stored.turn.userQuery?.trim() || row.query_text,
      assistant: normalizeAssistantMessage(stored.turn.assistant, 'Ответ сформирован.'),
    };
  }

  return toLegacyArtifactTurn(row, parsed);
}

export function getReportHistoryDbPath(): string {
  const fromEnv = process.env.REPORT_HISTORY_DB?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(/* turbopackIgnore: true */ process.cwd(), fromEnv);
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'report-history.db');
}

function openDb(): Database.Database {
  const dbPath = getReportHistoryDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_sessions (
      id TEXT PRIMARY KEY,
      viewer_id TEXT NOT NULL,
      first_query TEXT NOT NULL,
      latest_query TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_versions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES report_sessions(id) ON DELETE CASCADE,
      version_index INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      query_text TEXT NOT NULL,
      result_json TEXT NOT NULL,
      UNIQUE (session_id, version_index)
    );
    CREATE INDEX IF NOT EXISTS idx_report_sessions_viewer_updated
      ON report_sessions(viewer_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_report_versions_session_version
      ON report_versions(session_id, version_index ASC);
  `);

  return db;
}

function getDb(): Database.Database {
  if (!dbSingleton) dbSingleton = openDb();
  return dbSingleton;
}

function getHeader(request: NextRequest, name: string): string {
  return request.headers.get(name)?.trim() ?? '';
}

function getClientIp(request: NextRequest): string {
  const forwarded = getHeader(request, 'x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? '';
  }
  return getHeader(request, 'x-real-ip')
    || getHeader(request, 'cf-connecting-ip')
    || getHeader(request, 'x-client-ip');
}

function buildViewerFingerprint(request: NextRequest): string {
  const parts = [
    getClientIp(request),
    getHeader(request, 'user-agent'),
    getHeader(request, 'accept-language'),
    getHeader(request, 'sec-ch-ua'),
    getHeader(request, 'sec-ch-ua-platform'),
  ];

  return crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 32);
}

function normalizeViewerId(value: string | undefined): string | null {
  return normalizeEntityId(value);
}

export function resolveViewerId(request: NextRequest): {
  viewerId: string;
  cookieValue: string;
  shouldSetCookie: boolean;
} {
  const cookieValue = normalizeViewerId(request.cookies.get(VIEWER_COOKIE_NAME)?.value);
  if (cookieValue) {
    return { viewerId: cookieValue, cookieValue, shouldSetCookie: false };
  }

  const viewerId = `anon_${buildViewerFingerprint(request)}`;
  return { viewerId, cookieValue: viewerId, shouldSetCookie: true };
}

export function applyViewerCookie(
  response: NextResponse,
  viewer: { cookieValue: string; shouldSetCookie: boolean },
): void {
  if (!viewer.shouldSetCookie) return;
  response.cookies.set({
    name: VIEWER_COOKIE_NAME,
    value: viewer.cookieValue,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

function mapSummary(row: ChatSessionRow): SavedChatSummary {
  return {
    id: row.id,
    firstQuery: row.first_query,
    latestQuery: row.latest_query,
    turnCount: Number(row.turn_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pruneViewerChats(viewerId: string): void {
  const db = getDb();
  const staleIds = db
    .prepare(
      `SELECT id
       FROM report_sessions
       WHERE viewer_id = @viewerId
       ORDER BY updated_at DESC, created_at DESC, rowid DESC
       LIMIT -1 OFFSET @offset`,
    )
    .all({ viewerId, offset: MAX_CHATS_PER_VIEWER }) as { id: string }[];

  if (staleIds.length === 0) return;

  const deleteSession = db.prepare('DELETE FROM report_sessions WHERE id = ?');
  const tx = db.transaction((ids: string[]) => {
    ids.forEach(id => deleteSession.run(id));
  });
  tx(staleIds.map(row => row.id));
}

export function listViewerChats(viewerId: string, limit: number): SavedChatSummary[] {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(limit, MAX_CHATS_PER_VIEWER));
  const rows = db
    .prepare(
      `SELECT s.id,
              s.first_query,
              s.latest_query,
              s.created_at,
              s.updated_at,
              COUNT(v.id) AS turn_count
       FROM report_sessions s
       LEFT JOIN report_versions v ON v.session_id = s.id
       WHERE s.viewer_id = @viewerId
       GROUP BY s.id
       ORDER BY s.updated_at DESC
       LIMIT @limit`,
    )
    .all({ viewerId, limit: safeLimit }) as ChatSessionRow[];

  return rows.map(mapSummary);
}

export function getViewerChat(viewerId: string, chatId: string): SavedChatSession | null {
  const db = getDb();
  const session = db
    .prepare(
      `SELECT s.id,
              s.first_query,
              s.latest_query,
              s.created_at,
              s.updated_at,
              COUNT(v.id) AS turn_count
       FROM report_sessions s
       LEFT JOIN report_versions v ON v.session_id = s.id
       WHERE s.viewer_id = @viewerId AND s.id = @chatId
       GROUP BY s.id
       LIMIT 1`,
    )
    .get({ viewerId, chatId }) as ChatSessionRow | undefined;

  if (!session) return null;

  const turns = db
    .prepare(
      `SELECT id, version_index, created_at, query_text, result_json
       FROM report_versions
       WHERE session_id = @chatId
       ORDER BY version_index ASC`,
    )
    .all({ chatId }) as ChatTurnRow[];

  return {
    ...mapSummary(session),
    turns: turns.map(parseStoredTurn),
  };
}

export interface SaveViewerChatTurnParams {
  viewerId: string;
  chatId?: string;
  turn: SavedChatTurnInput;
}

export function saveViewerChatTurn(params: SaveViewerChatTurnParams): SavedChatSession {
  const db = getDb();
  const userQuery = truncateQuery(params.turn.userQuery);
  const nowIso = new Date().toISOString();
  const requestedChatId = normalizeEntityId(params.chatId);

  const tx = db.transaction(() => {
    const existingChatRow = requestedChatId
      ? db
          .prepare(
            `SELECT id, viewer_id
             FROM report_sessions
             WHERE id = @chatId
             LIMIT 1`,
          )
          .get({ chatId: requestedChatId }) as { id: string; viewer_id: string } | undefined
      : undefined;

    const chatId = !requestedChatId
      ? crypto.randomUUID()
      : !existingChatRow || existingChatRow.viewer_id === params.viewerId
        ? requestedChatId
        : crypto.randomUUID();

    const existing = db
      .prepare(
        `SELECT id
         FROM report_sessions
         WHERE id = @chatId AND viewer_id = @viewerId
         LIMIT 1`,
      )
      .get({ chatId, viewerId: params.viewerId }) as { id: string } | undefined;

    if (!existing) {
      db.prepare(
        `INSERT INTO report_sessions (id, viewer_id, first_query, latest_query, created_at, updated_at)
         VALUES (@id, @viewer_id, @first_query, @latest_query, @created_at, @updated_at)`,
      ).run({
        id: chatId,
        viewer_id: params.viewerId,
        first_query: userQuery,
        latest_query: userQuery,
        created_at: nowIso,
        updated_at: nowIso,
      });
    } else {
      db.prepare(
        `UPDATE report_sessions
         SET latest_query = @latest_query,
             updated_at = @updated_at
         WHERE id = @id AND viewer_id = @viewer_id`,
      ).run({
        id: chatId,
        viewer_id: params.viewerId,
        latest_query: userQuery,
        updated_at: nowIso,
      });
    }

    const nextIndexRow = db
      .prepare(
        `SELECT COALESCE(MAX(version_index), 0) AS max_version
         FROM report_versions
         WHERE session_id = @chatId`,
      )
      .get({ chatId }) as { max_version: number };

    db.prepare(
      `INSERT INTO report_versions (id, session_id, version_index, created_at, query_text, result_json)
       VALUES (@id, @session_id, @version_index, @created_at, @query_text, @result_json)`,
    ).run({
      id: crypto.randomUUID(),
      session_id: chatId,
      version_index: Number(nextIndexRow.max_version) + 1,
      created_at: nowIso,
      query_text: userQuery,
      result_json: JSON.stringify(toStoredEnvelope(params.turn, nowIso)),
    });

    return chatId;
  });

  const chatId = tx();
  pruneViewerChats(params.viewerId);

  const chat = getViewerChat(params.viewerId, chatId);
  if (!chat) {
    throw new Error('Не удалось прочитать сохраненный чат');
  }
  return chat;
}

// Backward-compatible export aliases used by older call sites.
export const listViewerReports = listViewerChats;
export const getViewerReport = getViewerChat;
export const saveViewerReportVersion = saveViewerChatTurn;
