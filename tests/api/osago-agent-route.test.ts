import { createJsonRequest } from '../helpers/next-request';

jest.mock('@/lib/osago-agent-client', () => ({
  requestOsagoAgentMessage: jest.fn(),
  rewriteOsagoChartUrls: jest.fn((content: string) => content.replace(
    '/api/charts/files/chart.jpg',
    '/constructor/api/osago-agent/charts/chart.jpg',
  )),
}));

const mockedClient = jest.mocked(jest.requireMock('@/lib/osago-agent-client') as {
  requestOsagoAgentMessage: jest.Mock;
  rewriteOsagoChartUrls: jest.Mock;
});

async function readSse(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => JSON.parse(line.slice(6)));
}

function createSseEventReader(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  return {
    async readEvent(): Promise<Record<string, unknown>> {
      while (true) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary >= 0) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLine = rawEvent.split('\n').find(line => line.startsWith('data: '));
          if (dataLine) return JSON.parse(dataLine.slice(6));
        }

        const { done, value } = await reader.read();
        if (done) throw new Error('SSE stream closed before next event');
        buffer += decoder.decode(value, { stream: true });
      }
    },

    async cancel() {
      await reader.cancel();
    },
  };
}

describe('/api/osago-agent', () => {
  beforeEach(() => {
    mockedClient.requestOsagoAgentMessage.mockReset();
    mockedClient.rewriteOsagoChartUrls.mockClear();
    delete process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS;
    jest.useRealTimers();
  });

  afterEach(() => {
    delete process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS;
    jest.useRealTimers();
  });

  it('wraps OSAGO agent responses in the chat SSE result shape', async () => {
    mockedClient.requestOsagoAgentMessage.mockResolvedValue({
      id: 'msg_1',
      session_id: 'chat-1',
      content: 'Ответ ![chart](/api/charts/files/chart.jpg)',
      role: 'assistant',
      created_at: '2026-04-22T00:00:00Z',
      metadata: {
        fact_count: 2,
        chart_specs: [
          {
            id: 'lr_trend',
            type: 'line',
            title: 'LR тренд',
            xKey: 'month',
            valueType: 'percent',
            series: [{ key: 'lr', label: 'LR %' }],
            data: [{ month: '2026-01', lr: 61.2 }],
          },
        ],
      },
    });
    const route = await import('@/app/api/osago-agent/route');

    const response = await route.POST(createJsonRequest('/api/osago-agent', {
      body: { query: 'Покажи маржу', chatId: 'chat-1' },
    }));

    expect(response.status).toBe(200);
    const events = await readSse(response);
    expect(events).toEqual([
      expect.objectContaining({ type: 'phase', phase: 'thinking' }),
      expect.objectContaining({ type: 'trace', scope: 'osago-agent' }),
      expect.objectContaining({
        type: 'result',
        data: {
          explanation: 'Ответ ![chart](/constructor/api/osago-agent/charts/chart.jpg)',
          suggestions: [],
          format: 'markdown',
          charts: [
            {
              id: 'lr_trend',
              type: 'line',
              title: 'LR тренд',
              xKey: 'month',
              valueType: 'percent',
              series: [{ key: 'lr', label: 'LR %' }],
              data: [{ month: '2026-01', lr: 61.2 }],
            },
          ],
          sessionId: 'chat-1',
          messageId: 'msg_1',
          metadata: {
            fact_count: 2,
            chart_specs: [
              {
                id: 'lr_trend',
                type: 'line',
                title: 'LR тренд',
                xKey: 'month',
                valueType: 'percent',
                series: [{ key: 'lr', label: 'LR %' }],
                data: [{ month: '2026-01', lr: 61.2 }],
              },
            ],
          },
        },
      }),
    ]);
    expect(mockedClient.requestOsagoAgentMessage).toHaveBeenCalledWith({
      query: 'Покажи маржу',
      chatId: 'chat-1',
    });
  });

  it('keeps the SSE connection alive while the OSAGO agent is still processing', async () => {
    process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS = '5';

    let resolveAgent!: (value: {
      id: string;
      session_id: string;
      content: string;
      role: string;
      created_at: string;
    }) => void;
    mockedClient.requestOsagoAgentMessage.mockImplementation(() => new Promise(resolve => {
      resolveAgent = resolve;
    }));

    const route = await import('@/app/api/osago-agent/route');
    const response = await route.POST(createJsonRequest('/api/osago-agent', {
      body: { query: 'Долгий расчет', chatId: 'chat-long' },
    }));
    const sse = createSseEventReader(response);

    await expect(sse.readEvent()).resolves.toEqual(expect.objectContaining({
      type: 'phase',
      phase: 'thinking',
    }));
    await expect(sse.readEvent()).resolves.toEqual(expect.objectContaining({
      type: 'trace',
      scope: 'osago-agent',
    }));

    const heartbeatPromise = Promise.race([
      sse.readEvent().then(event => ({ status: 'heartbeat', event })),
      new Promise(resolve => setTimeout(() => resolve({ status: 'missing' }), 50)),
    ]);
    const heartbeatStatus = await heartbeatPromise;

    expect(heartbeatStatus).toEqual({
      status: 'heartbeat',
      event: expect.objectContaining({
        type: 'trace',
        scope: 'osago-agent',
        message: expect.stringContaining('всё ещё считает'),
      }),
    });

    resolveAgent({
      id: 'msg_long',
      session_id: 'chat-long',
      content: 'Готово',
      role: 'assistant',
      created_at: '2026-04-23T00:00:00Z',
    });

    await expect(sse.readEvent()).resolves.toEqual(expect.objectContaining({
      type: 'result',
      data: expect.objectContaining({ explanation: 'Готово' }),
    }));
    await sse.cancel();
  });

  it('rejects empty requests', async () => {
    const route = await import('@/app/api/osago-agent/route');

    const response = await route.POST(createJsonRequest('/api/osago-agent', {
      body: { query: '', chatId: 'chat-1' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Запрос не может быть пустым' });
  });
});
