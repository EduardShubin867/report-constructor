import { extractCookie, createJsonRequest, createNextRequest } from '../helpers/next-request';
import { createTempDbPath } from '../helpers/temp-path';

async function importHistoryRoutes(dbPath: string) {
  process.env.REPORT_HISTORY_DB = dbPath;
  jest.resetModules();

  return {
    detailRoute: await import('@/app/api/report-history/[id]/route'),
    historyRoute: await import('@/app/api/report-history/route'),
  };
}

describe('/api/report-history routes', () => {
  afterEach(() => {
    delete process.env.REPORT_HISTORY_DB;
    jest.resetModules();
  });

  it('issues a viewer cookie when listing chats for a new visitor', async () => {
    const dbPath = createTempDbPath();
    const { historyRoute } = await importHistoryRoutes(dbPath);

    const response = await historyRoute.GET(createNextRequest('/api/report-history?limit=99'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [] });
    expect(extractCookie(response, 'constructor_viewer_id')).toMatch(/^constructor_viewer_id=anon_[a-f0-9]{32}$/);
  });

  it('round-trips saved chats for the same viewer cookie', async () => {
    const dbPath = createTempDbPath();
    const { detailRoute, historyRoute } = await importHistoryRoutes(dbPath);

    const createResponse = await historyRoute.POST(
      createJsonRequest('/api/report-history', {
        body: {
          turn: {
            userQuery: 'Покажи маржу',
            assistant: {
              kind: 'text',
              suggestions: ['Уточнить период'],
              text: 'Готово',
            },
          },
        },
      }),
    );

    expect(createResponse.status).toBe(200);
    const cookie = extractCookie(createResponse, 'constructor_viewer_id');
    expect(cookie).not.toBeNull();

    const createdBody = await createResponse.json();
    expect(createdBody.chat.turns).toHaveLength(1);

    const detailResponse = await detailRoute.GET(
      createNextRequest(`/api/report-history/${createdBody.chat.id}`, {
        headers: { cookie: cookie! },
      }),
      { params: Promise.resolve({ id: createdBody.chat.id }) } as never,
    );

    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.chat.id).toBe(createdBody.chat.id);
    expect(detailBody.chat.turns[0].assistant.text).toBe('Готово');

    const listResponse = await historyRoute.GET(
      createNextRequest('/api/report-history', {
        headers: { cookie: cookie! },
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].id).toBe(createdBody.chat.id);
  });

  it('lists and loads chats only for the requested mode', async () => {
    const dbPath = createTempDbPath();
    const { detailRoute, historyRoute } = await importHistoryRoutes(dbPath);

    const constructorResponse = await historyRoute.POST(
      createJsonRequest('/api/report-history', {
        body: {
          mode: 'constructor',
          turn: {
            userQuery: 'Обычный режим',
            assistant: {
              kind: 'text',
              suggestions: [],
              text: 'constructor',
            },
          },
        },
      }),
    );
    const cookie = extractCookie(constructorResponse, 'constructor_viewer_id');
    const constructorBody = await constructorResponse.json();

    const osagoResponse = await historyRoute.POST(
      createJsonRequest('/api/report-history', {
        headers: { cookie: cookie! },
        body: {
          mode: 'osago-agent',
          turn: {
            userQuery: 'ML режим',
            assistant: {
              kind: 'text',
              format: 'markdown',
              suggestions: [],
              text: '**osago**',
            },
          },
        },
      }),
    );
    const osagoBody = await osagoResponse.json();

    const constructorList = await historyRoute.GET(
      createNextRequest('/api/report-history?mode=constructor', {
        headers: { cookie: cookie! },
      }),
    );
    const osagoList = await historyRoute.GET(
      createNextRequest('/api/report-history?mode=osago-agent', {
        headers: { cookie: cookie! },
      }),
    );

    await expect(constructorList.json()).resolves.toMatchObject({
      items: [{ id: constructorBody.chat.id, mode: 'constructor' }],
    });
    await expect(osagoList.json()).resolves.toMatchObject({
      items: [{ id: osagoBody.chat.id, mode: 'osago-agent' }],
    });

    const wrongModeDetail = await detailRoute.GET(
      createNextRequest(`/api/report-history/${osagoBody.chat.id}?mode=constructor`, {
        headers: { cookie: cookie! },
      }),
      { params: Promise.resolve({ id: osagoBody.chat.id }) } as never,
    );
    expect(wrongModeDetail.status).toBe(404);
  });

  it('rejects malformed assistant payloads', async () => {
    const dbPath = createTempDbPath();
    const { historyRoute } = await importHistoryRoutes(dbPath);

    const response = await historyRoute.POST(
      createJsonRequest('/api/report-history', {
        body: {
          turn: {
            userQuery: 'Покажи отчёт',
            assistant: {
              kind: 'artifact',
              suggestions: [],
              text: 'bad',
              artifact: {},
            },
          },
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Некорректные данные ответа' });
  });

  it('returns 404 when another viewer asks for чужой chat', async () => {
    const dbPath = createTempDbPath();
    const { detailRoute, historyRoute } = await importHistoryRoutes(dbPath);

    const createResponse = await historyRoute.POST(
      createJsonRequest('/api/report-history', {
        body: {
          turn: {
            userQuery: 'Покажи прибыль',
            assistant: {
              kind: 'text',
              suggestions: [],
              text: 'ok',
            },
          },
        },
      }),
    );
    const createdBody = await createResponse.json();

    const response = await detailRoute.GET(
      createNextRequest(`/api/report-history/${createdBody.chat.id}`, {
        headers: { cookie: 'constructor_viewer_id=anon_ffffffffffffffffffffffffffffffff' },
      }),
      { params: Promise.resolve({ id: createdBody.chat.id }) } as never,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Чат не найден' });
  });
});
