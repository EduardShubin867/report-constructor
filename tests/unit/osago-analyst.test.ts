import osagoAnalyst from '@/lib/agents/osago-analyst';
import { requestOsagoAgentMessage, rewriteOsagoChartUrls } from '@/lib/osago-agent-client';
import { normalizeOsagoChartSpecs } from '@/lib/osago-chart-specs';
import type { AgentContext, AgentEvent } from '@/lib/agents/types';

jest.mock('@/lib/osago-agent-client', () => ({
  requestOsagoAgentMessage: jest.fn(),
  rewriteOsagoChartUrls: jest.fn((content: string) => content),
}));

jest.mock('@/lib/osago-chart-specs', () => ({
  normalizeOsagoChartSpecs: jest.fn(() => []),
}));

function createContext(query = 'Покажи маржинальность ОСАГО в Тюмени'): AgentContext {
  return {
    requestId: 'osago-run-1',
    chatSessionId: 'osago-chat-1',
    today: '2026-04-24',
    query,
  };
}

describe('osago-analyst', () => {
  const mockedRequestOsagoAgentMessage = requestOsagoAgentMessage as jest.MockedFunction<typeof requestOsagoAgentMessage>;
  const mockedRewriteOsagoChartUrls = rewriteOsagoChartUrls as jest.MockedFunction<typeof rewriteOsagoChartUrls>;
  const mockedNormalizeOsagoChartSpecs = normalizeOsagoChartSpecs as jest.MockedFunction<typeof normalizeOsagoChartSpecs>;
  const originalHeartbeatMs = process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS;

  beforeEach(() => {
    jest.useFakeTimers();
    mockedRequestOsagoAgentMessage.mockReset();
    mockedRewriteOsagoChartUrls.mockClear();
    mockedNormalizeOsagoChartSpecs.mockClear();
    process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS = '5';
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    process.env.OSAGO_AGENT_SSE_HEARTBEAT_MS = originalHeartbeatMs;
  });

  it('emits heartbeat trace events while the OSAGO backend is still processing', async () => {
    const events: AgentEvent[] = [];
    let resolveResponse!: (value: {
      id: string;
      session_id: string;
      content: string;
      role: string;
      created_at: string;
      metadata?: Record<string, unknown>;
    }) => void;

    mockedRequestOsagoAgentMessage.mockImplementation(() => new Promise(resolve => {
      resolveResponse = resolve;
    }));

    const runPromise = osagoAnalyst.run!(createContext(), event => events.push(event));

    await Promise.resolve();
    jest.advanceTimersByTime(10);
    await Promise.resolve();

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'phase', phase: 'thinking' }),
      expect.objectContaining({
        type: 'trace',
        scope: 'osago-agent',
        message: 'Отправляю запрос ОСАГО-агенту',
      }),
      expect.objectContaining({
        type: 'trace',
        scope: 'osago-agent',
        message: expect.stringContaining('всё ещё считает'),
      }),
    ]));

    resolveResponse({
      id: 'msg-1',
      session_id: 'chat-1',
      content: 'Готово',
      role: 'assistant',
      created_at: '2026-04-24T00:00:00Z',
    });
    await runPromise;

    expect(events).toContainEqual(expect.objectContaining({
      type: 'result',
      data: expect.objectContaining({ explanation: 'Готово' }),
    }));
  });

  it('reuses the stable chat session id and enriches short follow-up queries with prior context', async () => {
    mockedRequestOsagoAgentMessage.mockResolvedValue({
      id: 'msg-2',
      session_id: 'chat-42',
      content: 'Ответ по Москве',
      role: 'assistant',
      created_at: '2026-04-24T00:00:00Z',
    });

    await osagoAnalyst.run!({
      ...createContext('А по москве?'),
      chatSessionId: 'chat-42',
      analysisContext: {
        source: { id: 'osago-margin', name: 'ОСАГО маржа' },
        filters: {
          territories: ['Тюмень'],
          period: { label: 'последний год' },
        },
        metrics: ['маржа'],
        lastQuestion: 'Покажи маржинальность ОСАГО по Тюмени за последний год',
        lastExplanation: 'Данные по Тюмени не вернулись — попробуй другой регион.',
      },
    }, () => {});

    expect(mockedRequestOsagoAgentMessage).toHaveBeenCalledWith(expect.objectContaining({
      chatId: 'chat-42',
      query: expect.stringContaining('Контекст предыдущего анализа'),
    }));
    expect(mockedRequestOsagoAgentMessage.mock.calls[0]?.[0].query).toContain('А по москве?');
  });
});
