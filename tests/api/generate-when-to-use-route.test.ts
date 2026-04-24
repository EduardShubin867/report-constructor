import { generateText } from 'ai';
import { POST } from '@/app/api/admin/sources/generate-when-to-use/route';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import { createJsonRequest } from '../helpers/next-request';

jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@/lib/llm/openrouter-factory', () => ({
  createAppOpenRouter: jest.fn(() => jest.fn(modelId => ({ modelId }))),
}));

jest.mock('@/lib/agents/registry', () => ({
  resolveWhenToUseGeneratorModel: jest.fn(() => 'test/model'),
}));

describe('/api/admin/sources/generate-when-to-use POST', () => {
  const mockedGenerateText = generateText as jest.MockedFunction<typeof generateText>;
  const mockedCreateAppOpenRouter = createAppOpenRouter as jest.MockedFunction<typeof createAppOpenRouter>;
  const originalApiKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockedGenerateText.mockReset();
    mockedCreateAppOpenRouter.mockClear();
  });

  afterAll(() => {
    process.env.OPENROUTER_API_KEY = originalApiKey;
  });

  it('returns a local fallback when the LLM call fails', async () => {
    mockedGenerateText.mockRejectedValue(new Error('Connect Timeout Error'));

    const response = await POST(
      createJsonRequest('/api/admin/sources/generate-when-to-use', {
        body: {
          name: 'Заявки',
          draft: 'заявки, статусы и очередь обработки',
          tables: ['Requests'],
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      whenToUse:
        'Используй для запросов: заявки, статусы и очередь обработки. Гранулярность и поля сверяй по таблицам: Requests. Примеры: «покажи данные источника Заявки», «сводка по источнику Заявки».',
      fallback: true,
      warning: 'Connect Timeout Error',
    });
    expect(response.status).toBe(200);
  });

  it('returns a local fallback without calling the LLM when OpenRouter is not configured', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const response = await POST(
      createJsonRequest('/api/admin/sources/generate-when-to-use', {
        body: {
          name: 'Заявки',
          tables: ['Requests'],
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      whenToUse:
        'Используй для запросов по источнику «Заявки». Гранулярность и поля сверяй по таблицам: Requests. Примеры: «покажи данные источника Заявки», «сводка по источнику Заявки».',
      fallback: true,
      warning: 'OPENROUTER_API_KEY не настроен',
    });
    expect(response.status).toBe(200);
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });
});
