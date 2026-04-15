import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { NextResponse } from 'next/server';
import { createNextRequest } from '../helpers/next-request';
import { createTempDbPath } from '../helpers/temp-path';

async function importReportHistory(dbPath: string) {
  process.env.REPORT_HISTORY_DB = dbPath;
  jest.resetModules();
  return import('@/lib/report-history');
}

describe('report-history', () => {
  afterEach(() => {
    delete process.env.REPORT_HISTORY_DB;
    jest.resetModules();
  });

  it('resolves viewer ids from cookies and generates anonymous fingerprints otherwise', async () => {
    const dbPath = createTempDbPath();
    const { resolveViewerId } = await importReportHistory(dbPath);
    const cookieValue = 'anon_1234567890abcdef1234567890abcd';

    const fromCookie = resolveViewerId(
      createNextRequest('/api/report-history', {
        headers: { cookie: `constructor_viewer_id=${cookieValue}` },
      }),
    );
    expect(fromCookie).toEqual({
      viewerId: cookieValue,
      cookieValue,
      shouldSetCookie: false,
    });

    const generated = resolveViewerId(
      createNextRequest('/api/report-history', {
        headers: {
          'accept-language': 'ru-RU',
          'user-agent': 'jest',
          'x-forwarded-for': '203.0.113.9',
        },
      }),
    );

    expect(generated.viewerId).toMatch(/^anon_[a-f0-9]{32}$/);
    expect(generated.cookieValue).toBe(generated.viewerId);
    expect(generated.shouldSetCookie).toBe(true);
  });

  it('applies the viewer cookie with a long-lived session', async () => {
    const dbPath = createTempDbPath();
    const { applyViewerCookie } = await importReportHistory(dbPath);
    const response = NextResponse.json({ ok: true });

    applyViewerCookie(response, {
      cookieValue: 'anon_1234567890abcdef1234567890abcd',
      shouldSetCookie: true,
    });

    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('constructor_viewer_id=anon_1234567890abcdef1234567890abcd');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
  });

  it('saves chats, appends turns, and prunes old sessions per viewer', async () => {
    const dbPath = createTempDbPath();
    const { getViewerChat, listViewerChats, saveViewerChatTurn } = await importReportHistory(dbPath);
    const viewerId = 'anon_1234567890abcdef1234567890abcd';

    let preservedChatId = '';

    for (let i = 0; i < 7; i += 1) {
      const chat = saveViewerChatTurn({
        viewerId,
        turn: {
          userQuery: `Запрос ${i}`,
          assistant: {
            kind: 'text',
            suggestions: [],
            text: `Ответ ${i}`,
          },
        },
      });

      if (i === 1) {
        preservedChatId = chat.id;
      }
    }

    const list = listViewerChats(viewerId, 99);
    expect(list).toHaveLength(6);
    expect(list.some(item => item.firstQuery === 'Запрос 0')).toBe(false);

    const updated = saveViewerChatTurn({
      viewerId,
      chatId: preservedChatId,
      turn: {
        userQuery: 'Уточнение',
        assistant: {
          kind: 'text',
          suggestions: ['Повтори'],
          text: 'Обновили ответ',
        },
      },
    });

    expect(updated.turns).toHaveLength(2);
    expect(updated.latestQuery).toBe('Уточнение');
    expect(updated.turns[1].assistant.suggestions).toEqual(['Повтори']);

    const stored = getViewerChat(viewerId, preservedChatId);
    expect(stored?.turns).toHaveLength(2);
  });

  it('parses legacy artifact payloads from older stored turns', async () => {
    const dbPath = createTempDbPath();
    const { getReportHistoryDbPath, getViewerChat, saveViewerChatTurn } = await importReportHistory(dbPath);
    const viewerId = 'anon_1234567890abcdef1234567890abcd';

    saveViewerChatTurn({
      viewerId,
      turn: {
        userQuery: 'Инициализация',
        assistant: {
          kind: 'text',
          suggestions: [],
          text: 'ok',
        },
      },
    });

    const db = new Database(getReportHistoryDbPath());
    const chatId = crypto.randomUUID();
    const turnId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO report_sessions (id, viewer_id, first_query, latest_query, created_at, updated_at)
       VALUES (@id, @viewerId, @firstQuery, @latestQuery, @createdAt, @updatedAt)`,
    ).run({
      id: chatId,
      viewerId,
      firstQuery: 'Legacy query',
      latestQuery: 'Legacy query',
      createdAt: now,
      updatedAt: now,
    });

    db.prepare(
      `INSERT INTO report_versions (id, session_id, version_index, created_at, query_text, result_json)
       VALUES (@id, @sessionId, @versionIndex, @createdAt, @queryText, @resultJson)`,
    ).run({
      id: turnId,
      sessionId: chatId,
      versionIndex: 1,
      createdAt: now,
      queryText: 'Legacy query',
      resultJson: JSON.stringify({
        columns: ['VIN'],
        data: [],
        explanation: 'Legacy explanation',
        rowCount: 0,
        sql: 'SELECT 1',
        validatedSql: 'SELECT 1',
      }),
    });

    db.close();

    const chat = getViewerChat(viewerId, chatId);
    expect(chat).not.toBeNull();
    expect(chat?.turns[0].assistant.kind).toBe('artifact');
    expect(chat?.turns[0].assistant.text).toBe('Legacy explanation');
    if (chat?.turns[0].assistant.kind === 'artifact') {
      expect(chat.turns[0].assistant.artifact.validatedSql).toBe('SELECT 1');
    }
  });
});
