import { rewriteOsagoChartUrls, requestOsagoAgentMessage } from '@/lib/osago-agent-client';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

describe('osago-agent-client', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.OSAGO_AGENT_BASE_URL = 'http://osago.test';
    process.env.OSAGO_AGENT_USERNAME = 'admin';
    process.env.OSAGO_AGENT_PASSWORD = 'secret';
    delete process.env.OSAGO_AGENT_TIMEOUT_MS;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OSAGO_AGENT_BASE_URL;
    delete process.env.OSAGO_AGENT_USERNAME;
    delete process.env.OSAGO_AGENT_PASSWORD;
    delete process.env.OSAGO_AGENT_TIMEOUT_MS;
    jest.resetModules();
  });

  it('rewrites protected chart URLs to the constructor chart proxy', () => {
    const rewritten = rewriteOsagoChartUrls(
      'График: ![LR](/api/charts/files/lr_trend_abc123.jpg)',
      '/constructor',
    );

    expect(rewritten).toBe('График: ![LR](/constructor/api/osago-agent/charts/lr_trend_abc123.jpg)');
  });

  it('logs in server-side and retries message requests once after a 401', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        token_type: 'bearer',
      }))
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        token_type: 'bearer',
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'msg_1',
        session_id: 'chat-1',
        content: 'Ответ агента',
        role: 'assistant',
        created_at: '2026-04-22T00:00:00Z',
      }));
    global.fetch = fetchMock;

    await expect(requestOsagoAgentMessage({
      query: 'Покажи маржинальность',
      chatId: 'chat-1',
    })).resolves.toMatchObject({
      content: 'Ответ агента',
      session_id: 'chat-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer access-1' });
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({ Authorization: 'Bearer access-2' });
  });

  it('fails fast when ML agent credentials are not configured', async () => {
    delete process.env.OSAGO_AGENT_USERNAME;

    await expect(requestOsagoAgentMessage({
      query: 'Покажи маржинальность',
      chatId: 'chat-1',
    })).rejects.toThrow('OSAGO_AGENT_USERNAME is not set');
  });
});
