import { generateText, Output, stepCountIs, NoObjectGeneratedError } from 'ai';
import { runAgent } from '@/lib/agents/runner';
import { resolveAgentModel, resolveAgentModelCandidates } from '@/lib/agents/registry';
import { createAppOpenRouter } from '@/lib/llm/openrouter-factory';
import type { AgentEvent, AgentContext, SubAgentConfig } from '@/lib/agents/types';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn(({ schema }: { schema: unknown }) => ({ schema })),
  },
  stepCountIs: jest.fn((count: number) => ({ count })),
  NoObjectGeneratedError: {
    isInstance: jest.fn(() => false),
  },
}));

jest.mock('@/lib/agents/registry', () => ({
  resolveAgentModel: jest.fn(() => 'primary/agent-model'),
  resolveAgentModelCandidates: jest.fn(() => ['primary/agent-model', 'fallback/agent-model']),
}));

jest.mock('@/lib/llm/openrouter-factory', () => ({
  createAppOpenRouter: jest.fn(() => jest.fn((modelId: string) => ({ modelId }))),
}));

jest.mock('@/lib/skills/registry', () => ({
  buildAgentToolSet: jest.fn(() => ({})),
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

jest.mock('@/lib/agents/agent-response-schema', () => ({
  agentResponseSchema: { type: 'mock-schema' },
  filterTechnicalExplanation: jest.fn((_sql: string, explanation: string) => explanation),
  tryParseAgentResponseFromText: jest.fn(() => null),
}));

describe('runAgent', () => {
  const mockedGenerateText = generateText as jest.MockedFunction<typeof generateText>;
  const mockedOutputObject = Output.object as unknown as jest.Mock;
  const mockedStepCountIs = stepCountIs as unknown as jest.Mock;
  const mockedNoObjectGeneratedError = NoObjectGeneratedError as { isInstance: jest.Mock };
  const mockedResolveAgentModel = resolveAgentModel as jest.MockedFunction<typeof resolveAgentModel>;
  const mockedResolveAgentModelCandidates = resolveAgentModelCandidates as jest.MockedFunction<typeof resolveAgentModelCandidates>;
  const mockedCreateAppOpenRouter = createAppOpenRouter as jest.MockedFunction<typeof createAppOpenRouter>;

  function createAgent(): SubAgentConfig {
    return {
      name: 'sql-analyst',
      description: 'General SQL analyst',
      buildSystemPrompt: () => 'system prompt',
      buildUserMessage: (ctx) => ctx.query,
    };
  }

  function createContext(): AgentContext {
    return {
      requestId: 'req-1',
      today: '2026-04-24',
      query: 'Покажи LR по филиалам',
    };
  }

  beforeEach(() => {
    mockedGenerateText.mockReset();
    mockedOutputObject.mockClear();
    mockedStepCountIs.mockClear();
    mockedNoObjectGeneratedError.isInstance.mockReturnValue(false);
    mockedResolveAgentModel.mockReset();
    mockedResolveAgentModel.mockReturnValue('primary/agent-model');
    mockedResolveAgentModelCandidates.mockReset();
    mockedResolveAgentModelCandidates.mockReturnValue(['primary/agent-model', 'fallback/agent-model']);
    mockedCreateAppOpenRouter.mockClear();
  });

  it('accepts SQL only when the final SQL was validated via validate_query', async () => {
    const events: AgentEvent[] = [];

    mockedGenerateText
      .mockRejectedValueOnce(new Error('Network error from primary model'))
      .mockImplementationOnce(async (input: Record<string, unknown>) => {
        const onStepFinish = input.onStepFinish as ((step: { toolCalls: Array<{ toolName: string; input: Record<string, unknown> }> }) => void) | undefined;
        onStepFinish?.({
          toolCalls: [{ toolName: 'validate_query', input: { sql: 'SELECT 1' } }],
        });
        return {
          output: {
            sql: 'SELECT 1',
            explanation: 'Готово',
            suggestions: ['Уточни период'],
            canRetry: true,
          },
        } as never;
      });

    await runAgent({
      agent: createAgent(),
      ctx: createContext(),
      send: event => events.push(event),
    });

    expect(mockedGenerateText).toHaveBeenCalledTimes(2);
    expect(mockedGenerateText.mock.calls[0]?.[0].model).toEqual({ modelId: 'primary/agent-model' });
    expect(mockedGenerateText.mock.calls[1]?.[0].model).toEqual({ modelId: 'fallback/agent-model' });
    expect(events).toContainEqual(expect.objectContaining({
      type: 'result',
      data: expect.objectContaining({
        sql: 'SELECT 1',
        explanation: 'Готово',
      }),
    }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }));
  });

  it('blocks SQL results when the agent skipped validate_query', async () => {
    const events: AgentEvent[] = [];

    mockedResolveAgentModelCandidates.mockReturnValue(['primary/agent-model']);
    mockedGenerateText.mockResolvedValue({
      output: {
        sql: 'SELECT 1',
        explanation: 'Готово',
        suggestions: ['Уточни период'],
        canRetry: true,
      },
    } as never);

    await runAgent({
      agent: createAgent(),
      ctx: createContext(),
      send: event => events.push(event),
    });

    expect(events).toContainEqual(expect.objectContaining({
      type: 'error',
      error: expect.stringContaining('validate_query'),
    }));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'result' }));
  });
});
