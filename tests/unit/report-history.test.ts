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

  it('keeps constructor and OSAGO agent histories separate per viewer', async () => {
    const dbPath = createTempDbPath();
    const { getViewerChat, listViewerChats, saveViewerChatTurn } = await importReportHistory(dbPath);
    const viewerId = 'anon_1234567890abcdef1234567890abcd';

    const constructorChat = saveViewerChatTurn({
      viewerId,
      mode: 'constructor',
      turn: {
        userQuery: 'Построй SQL отчёт',
        assistant: {
          kind: 'text',
          suggestions: [],
          text: 'SQL режим',
        },
      },
    });

    const osagoChat = saveViewerChatTurn({
      viewerId,
      mode: 'osago-agent',
      turn: {
        userQuery: 'Проанализируй маржинальность Москвы',
        assistant: {
          kind: 'text',
          format: 'markdown',
          charts: [
            {
              id: 'margin',
              type: 'bar',
              title: 'Динамика маржи',
              xKey: 'month',
              valueType: 'money',
              series: [{ key: 'margin', label: 'Маржа' }],
              data: [{ month: '2026-01', margin: 1200000 }],
            },
          ],
          suggestions: [],
          text: '**ML режим**',
        },
      },
    });

    expect(listViewerChats(viewerId, 6, 'constructor').map(chat => chat.id)).toEqual([constructorChat.id]);
    expect(listViewerChats(viewerId, 6, 'osago-agent').map(chat => chat.id)).toEqual([osagoChat.id]);
    expect(getViewerChat(viewerId, constructorChat.id, 'osago-agent')).toBeNull();
    expect(getViewerChat(viewerId, osagoChat.id, 'constructor')).toBeNull();
    expect(getViewerChat(viewerId, osagoChat.id, 'osago-agent')?.turns[0].assistant).toMatchObject({
      kind: 'text',
      format: 'markdown',
      charts: [
        expect.objectContaining({
          id: 'margin',
          type: 'bar',
          data: [{ month: '2026-01', margin: 1200000 }],
        }),
      ],
      text: '**ML режим**',
    });
  });

  it('round-trips analysis context on saved assistant messages', async () => {
    const dbPath = createTempDbPath();
    const { getViewerChat, saveViewerChatTurn } = await importReportHistory(dbPath);
    const viewerId = 'anon_1234567890abcdef1234567890abcd';

    const saved = saveViewerChatTurn({
      viewerId,
      mode: 'constructor',
      turn: {
        userQuery: 'Покажи маржу по ДГ 131',
        assistant: {
          kind: 'artifact',
          text: 'Маржа по ДГ 131.',
          suggestions: [],
          analysisContext: {
            source: { id: 'osago-margin', name: 'ОСАГО маржа' },
            filters: { dg: ['131'] },
            metrics: ['маржа'],
            dimensions: ['ДГ'],
            lastSql: 'SELECT 1',
            lastQuestion: 'Покажи маржу по ДГ 131',
            lastRowCount: 1,
          },
          artifact: {
            data: [{ ДГ: '131', Маржа: 1000 }],
            columns: ['ДГ', 'Маржа'],
            rowCount: 1,
            validatedSql: 'SELECT 1',
            sql: 'SELECT 1',
            explanation: 'Маржа по ДГ 131.',
          },
        },
      },
    });

    const reloaded = getViewerChat(viewerId, saved.id);
    expect(reloaded?.turns[0].assistant).toMatchObject({
      kind: 'artifact',
      analysisContext: {
        source: { id: 'osago-margin', name: 'ОСАГО маржа' },
        filters: { dg: ['131'] },
        metrics: ['маржа'],
        dimensions: ['ДГ'],
        lastRowCount: 1,
      },
    });
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
