import { runConstructorAttempt } from '@/components/agent-chat-workspace/agent-runners';
import type { OsagoChartSpec } from '@/lib/report-history-types';

function createSseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  const payload = events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('runConstructorAttempt', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('preserves OSAGO charts for text-only agent responses', async () => {
    const charts: OsagoChartSpec[] = [
      {
        id: 'lr-trend',
        type: 'line',
        title: 'LR trend',
        xKey: 'month',
        valueType: 'percent',
        series: [{ key: 'lr', label: 'LR' }],
        data: [{ month: '2026-01', lr: 61.2 }],
      },
    ];

    global.fetch = jest.fn().mockResolvedValue(createSseResponse([
      { type: 'phase', phase: 'thinking', id: 'p1' },
      {
        type: 'result',
        id: 'r1',
        data: {
          sql: '',
          explanation: 'Ответ с графиком ![fallback](/constructor/api/osago-agent/charts/lr.jpg)',
          suggestions: ['Уточни регион'],
          format: 'markdown',
          charts,
        },
      },
    ])) as typeof fetch;

    const result = await runConstructorAttempt(
      'Покажи LR по Тюмени',
      undefined,
      0,
      new AbortController().signal,
      undefined,
      false,
      'chat-1',
      [],
      undefined,
      false,
      {
        appendDebug: () => {},
        setPhase: () => {},
        setIsRetrying: () => {},
        setStepper: () => {},
      },
    );

    expect(result).toMatchObject({
      kind: 'text',
      text: 'Ответ с графиком ![fallback](/constructor/api/osago-agent/charts/lr.jpg)',
      suggestions: ['Уточни регион'],
      format: 'markdown',
      charts,
    });
  });
});
