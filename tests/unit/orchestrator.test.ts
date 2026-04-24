import { generateText, Output } from 'ai';
import { orchestrate } from '@/lib/agents/orchestrator';
import { getAllAgents, getAgent, getAgentCatalog, resolveRouterModelCandidates } from '@/lib/agents/registry';
import { runAgent } from '@/lib/agents/runner';
import { pickDataSource } from '@/lib/agents/source-router';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import type { AgentContext, AgentEvent, SubAgentConfig } from '@/lib/agents/types';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn(({ schema }: { schema: unknown }) => ({ schema })),
  },
}));

jest.mock('@/lib/llm/openrouter-factory', () => ({
  createAppOpenRouter: jest.fn(() => jest.fn((modelId: string) => ({ modelId }))),
}));

jest.mock('@/lib/agents/registry', () => ({
  getAllAgents: jest.fn(),
  getAgent: jest.fn(),
  getAgentCatalog: jest.fn(),
  resolveRouterModelCandidates: jest.fn(() => ['primary/router-model', 'fallback/router-model']),
}));

jest.mock('@/lib/agents/source-router', () => ({
  pickDataSource: jest.fn(),
}));

jest.mock('@/lib/agents/runner', () => ({
  runAgent: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/constants', () => ({
  AGENT_DEBUG_ENABLED: false,
}));

type LegacyAgent = SubAgentConfig & {
  match?: jest.Mock<number, [AgentContext]>;
};

function createAgent(
  name: string,
  extras: Partial<LegacyAgent> = {},
): LegacyAgent {
  return {
    name,
    description: `Routes ${name} queries`,
    buildSystemPrompt: () => '',
    buildUserMessage: (ctx) => ctx.query,
    ...extras,
  };
}

function createContext(query = 'Покажи аналитику по ОСАГО'): AgentContext {
  return {
    requestId: 'req-1',
    today: '2026-04-24',
    query,
  };
}

describe('orchestrator', () => {
  const mockedGenerateText = generateText as jest.MockedFunction<typeof generateText>;
  const mockedOutputObject = Output.object as unknown as jest.Mock;
  const mockedGetAllAgents = getAllAgents as jest.MockedFunction<typeof getAllAgents>;
  const mockedGetAgent = getAgent as jest.MockedFunction<typeof getAgent>;
  const mockedGetAgentCatalog = getAgentCatalog as jest.MockedFunction<typeof getAgentCatalog>;
  const mockedResolveRouterModelCandidates = resolveRouterModelCandidates as jest.MockedFunction<typeof resolveRouterModelCandidates>;
  const mockedPickDataSource = pickDataSource as jest.MockedFunction<typeof pickDataSource>;
  const mockedRunAgent = runAgent as jest.MockedFunction<typeof runAgent>;
  const mockedCreateAppOpenRouter = createAppOpenRouter as jest.MockedFunction<typeof createAppOpenRouter>;

  beforeEach(() => {
    mockedGenerateText.mockReset();
    mockedOutputObject.mockClear();
    mockedGetAllAgents.mockReset();
    mockedGetAgent.mockReset();
    mockedGetAgentCatalog.mockReset();
    mockedResolveRouterModelCandidates.mockReset();
    mockedPickDataSource.mockReset();
    mockedRunAgent.mockReset();
    mockedCreateAppOpenRouter.mockClear();

    mockedPickDataSource.mockResolvedValue({
      sourceId: 'main',
      sourceName: 'Main source',
      reason: 'llm',
    });
    mockedResolveRouterModelCandidates.mockReturnValue(['primary/router-model', 'fallback/router-model']);
  });

  it('always routes through the LLM and ignores legacy match scoring', async () => {
    const legacyMatch = jest.fn(() => 0.99);
    const regexAgent = createAgent('regex-agent', { match: legacyMatch });
    const llmAgent = createAgent('llm-agent');
    const agents = [regexAgent, llmAgent];
    const events: AgentEvent[] = [];

    mockedGetAllAgents.mockReturnValue(agents);
    mockedGetAgentCatalog.mockReturnValue(agents.map(agent => ({
      name: agent.name,
      description: agent.description,
    })));
    mockedGetAgent.mockImplementation(name => agents.find(agent => agent.name === name));
    mockedGenerateText.mockResolvedValue({
      output: {
        agent: llmAgent.name,
        confidence: 0.93,
        reason: 'LLM selected the best specialist',
      },
    } as never);

    await orchestrate({
      ctx: createContext(),
      send: event => events.push(event),
    });

    expect(legacyMatch).not.toHaveBeenCalled();
    expect(mockedGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0,
      output: expect.anything(),
      messages: [{ role: 'user', content: 'Покажи аналитику по ОСАГО' }],
    }));
    expect(mockedOutputObject).toHaveBeenCalledTimes(1);
    expect(mockedRunAgent).toHaveBeenCalledTimes(1);
    expect(mockedRunAgent.mock.calls[0]?.[0].agent).toBe(llmAgent);
    expect(mockedRunAgent.mock.calls[0]?.[0].ctx.selectedSourceId).toBe('main');
    expect(events).toContainEqual({ type: 'sub_agent', name: llmAgent.name });
  });

  it('falls back to the first registered agent when structured routing returns an unknown agent', async () => {
    const firstAgent = createAgent('first-agent');
    const secondAgent = createAgent('second-agent');
    const agents = [firstAgent, secondAgent];

    mockedGetAllAgents.mockReturnValue(agents);
    mockedGetAgentCatalog.mockReturnValue(agents.map(agent => ({
      name: agent.name,
      description: agent.description,
    })));
    mockedGetAgent.mockImplementation(name => agents.find(agent => agent.name === name));
    mockedGenerateText.mockResolvedValue({
      output: {
        agent: 'ghost-agent',
        confidence: 0.11,
        reason: 'Incorrect LLM choice',
      },
    } as never);

    await orchestrate({
      ctx: createContext('Неоднозначный запрос'),
      send: () => {},
    });

    expect(mockedRunAgent).toHaveBeenCalledTimes(1);
    expect(mockedRunAgent.mock.calls[0]?.[0].agent).toBe(firstAgent);
  });

  it('retries routing with the fallback model when the primary router model rejects structured output', async () => {
    const firstAgent = createAgent('first-agent');
    const fallbackChosenAgent = createAgent('fallback-chosen-agent');
    const agents = [firstAgent, fallbackChosenAgent];

    mockedGetAllAgents.mockReturnValue(agents);
    mockedGetAgentCatalog.mockReturnValue(agents.map(agent => ({
      name: agent.name,
      description: agent.description,
    })));
    mockedGetAgent.mockImplementation(name => agents.find(agent => agent.name === name));
    mockedGenerateText
      .mockRejectedValueOnce(new Error('[DeepSeek] This response_format type is unavailable now'))
      .mockResolvedValueOnce({
        output: {
          agent: fallbackChosenAgent.name,
          confidence: 0.82,
          reason: 'Fallback router model succeeded',
        },
      } as never);

    await orchestrate({
      ctx: createContext('Выбери подходящего аналитика'),
      send: () => {},
    });

    expect(mockedGenerateText).toHaveBeenCalledTimes(2);
    expect(mockedGenerateText.mock.calls[0]?.[0].model).toEqual({ modelId: 'primary/router-model' });
    expect(mockedGenerateText.mock.calls[1]?.[0].model).toEqual({ modelId: 'fallback/router-model' });
    expect(mockedRunAgent).toHaveBeenCalledTimes(1);
    expect(mockedRunAgent.mock.calls[0]?.[0].agent).toBe(fallbackChosenAgent);
  });

  it('includes prior chat history and analysis context when routing a short follow-up', async () => {
    const osagoAgent = createAgent('osago-analyst');
    const sqlAgent = createAgent('sql-analyst');
    const agents = [osagoAgent, sqlAgent];

    mockedGetAllAgents.mockReturnValue(agents);
    mockedGetAgentCatalog.mockReturnValue(agents.map(agent => ({
      name: agent.name,
      description: agent.description,
    })));
    mockedGetAgent.mockImplementation(name => agents.find(agent => agent.name === name));
    mockedGenerateText.mockResolvedValue({
      output: {
        agent: osagoAgent.name,
        confidence: 0.91,
        reason: 'Follow-up should continue the same analytical thread',
      },
    } as never);

    await orchestrate({
      ctx: {
        ...createContext('А по москве?'),
        history: [
          { role: 'user', content: 'Покажи маржинальность ОСАГО по Тюмени за последний год' },
          { role: 'assistant', content: JSON.stringify({
            sql: '',
            explanation: 'Данные по Тюмени не вернулись — попробуй другой регион.',
            suggestions: [],
          }) },
        ],
        analysisContext: {
          source: { id: 'osago-margin', name: 'ОСАГО маржа' },
          filters: { territories: ['Тюмень'] },
          metrics: ['маржа'],
          lastQuestion: 'Покажи маржинальность ОСАГО по Тюмени за последний год',
          lastExplanation: 'Данные по Тюмени не вернулись — попробуй другой регион.',
        },
      },
      send: () => {},
    });

    expect(mockedGenerateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining('Контекст предыдущего анализа'),
      messages: [
        { role: 'user', content: 'Покажи маржинальность ОСАГО по Тюмени за последний год' },
        {
          role: 'assistant',
          content: JSON.stringify({
            sql: '',
            explanation: 'Данные по Тюмени не вернулись — попробуй другой регион.',
            suggestions: [],
          }),
        },
        { role: 'user', content: 'А по москве?' },
      ],
    }));
  });
});
