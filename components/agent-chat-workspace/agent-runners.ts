import type { AgentResponse, SSEEvent } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import {
  DATA_SKILLS,
  MAX_RETRIES,
  SKILL_DETAILS,
  SKILL_LABELS,
} from '@/components/agent-chat/skill-meta';
import type { DebugScope, Phase } from '@/components/agent-chat/types';
import {
  debugToneFromLevel,
  isRecoverableSqlSchemaError,
  normalizeSuccessfulExplanation,
  phaseDebugMessage,
} from '@/components/agent-chat/utils';
import {
  deriveAnalysisContextFromArtifact,
  deriveAnalysisContextFromText,
} from '@/lib/analysis-context';
import { BASE_PATH } from '@/lib/constants';
import type { AnalysisContext, SavedChatAssistantMessage } from '@/lib/report-history-types';
import type { ModelMessage } from 'ai';
import type { OsagoAgentResult } from './types';

type Stepper = (step: number, detail: string) => void;

type RunnerLog = {
  appendDebug: (
    scope: DebugScope,
    message: string,
    tone: 'info' | 'success' | 'warn' | 'error',
    data?: unknown,
  ) => void;
};

type CallAgentContext = RunnerLog & {
  setPhase: (p: Phase) => void;
  setStepper: Stepper;
};

export async function runOsagoAgentStream(
  text: string,
  chatId: string,
  signal: AbortSignal,
  ctx: RunnerLog & {
    setIsRetrying: (v: boolean) => void;
    setStepper: Stepper;
    setPhase: (p: Phase) => void;
  },
): Promise<SavedChatAssistantMessage> {
  const { appendDebug, setIsRetrying, setStepper, setPhase } = ctx;
  setPhase('thinking');
  setIsRetrying(false);
  setStepper(0, 'Отправляю запрос ОСАГО-агенту…');
  appendDebug('client', 'Открываю SSE-запрос к ОСАГО-агенту', 'info', { chatId });

  const res = await fetch(`${BASE_PATH}/api/osago-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: text, chatId }),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error ?? `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming не поддерживается');

  appendDebug('client', 'SSE-соединение с ML-агентом установлено', 'success', { status: res.status });

  const decoder = new TextDecoder();
  let buffer = '';
  let result: OsagoAgentResult | null = null;
  let streamError: string | null = null;
  const seenEventIds = new Set<string>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6);
      if (!jsonStr) continue;

      let event: SSEEvent;
      try {
        event = JSON.parse(jsonStr) as SSEEvent;
      } catch {
        continue;
      }

      if (event.id) {
        if (seenEventIds.has(event.id)) continue;
        seenEventIds.add(event.id);
      }

      switch (event.type) {
        case 'phase':
          appendDebug('phase', `ОСАГО-агент: ${event.phase}`, 'info', { phase: event.phase });
          setStepper(0, 'ОСАГО-агент анализирует запрос…');
          break;
        case 'trace':
          appendDebug(
            (event.scope as DebugScope) ?? 'osago-agent',
            event.message,
            'info',
            event.data ?? (typeof event.durationMs === 'number' ? { durationMs: event.durationMs } : undefined),
          );
          setStepper(1, event.message);
          break;
        case 'result':
          result = event.data as OsagoAgentResult;
          appendDebug('result', 'ОСАГО-агент вернул ответ', 'success', {
            hasMarkdown: result?.format === 'markdown',
            metadata: result?.metadata,
          });
          break;
        case 'error':
          streamError = event.error;
          appendDebug('error', `Ошибка ОСАГО-агента: ${event.error}`, 'error');
          break;
      }
    }
  }

  if (streamError) throw new Error(streamError);
  if (!result?.explanation) throw new Error('ОСАГО-агент завершился без результата');

  setStepper(4, '');
  setPhase('done');

  return {
    kind: 'text',
    text: result.explanation,
    suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
    format: result.format === 'plain' ? 'plain' : 'markdown',
    ...(Array.isArray(result.charts) && result.charts.length > 0 ? { charts: result.charts } : {}),
  };
}

export async function callAgentStream(
  text: string,
  prevSql: string | undefined,
  retryCount: number,
  signal: AbortSignal,
  retryError: string | undefined,
  unlimitedRows: boolean,
  chatSessionId: string,
  history: ModelMessage[],
  analysisContext: AnalysisContext | undefined,
  ctx: CallAgentContext,
): Promise<AgentResponse> {
  const { appendDebug, setPhase, setStepper } = ctx;
  appendDebug(
    'client',
    retryCount > 0 ? `Открываю новый SSE-запрос для ретрая ${retryCount}/${MAX_RETRIES}` : 'Открываю SSE-запрос к агенту',
    'info',
    {
      mode: prevSql ? 'follow-up' : 'fresh',
      skipAutoRowLimit: unlimitedRows,
      hasPreviousSql: Boolean(prevSql),
      hasRetryError: Boolean(retryError),
    },
  );

  const res = await fetch(`${BASE_PATH}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: text,
      previousSql: prevSql,
      retryError,
      chatSessionId,
      ...(unlimitedRows ? { skipAutoRowLimit: true } : {}),
      ...(history.length > 0 ? { history } : {}),
      ...(analysisContext ? { analysisContext } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error ?? `HTTP ${res.status}`);
  }

  appendDebug('client', 'SSE-соединение установлено', 'success', { status: res.status });

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming не поддерживается');

  const decoder = new TextDecoder();
  let buffer = '';
  let result: AgentResponse | null = null;
  let streamError: string | null = null;
  let selectedSource: AgentResponse['_selectedSource'];
  const seenEventIds = new Set<string>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6);
      if (!jsonStr) continue;

      let event: SSEEvent;
      try {
        event = JSON.parse(jsonStr) as SSEEvent;
      } catch {
        continue;
      }

      if (event.id) {
        if (seenEventIds.has(event.id)) continue;
        seenEventIds.add(event.id);
      }

      switch (event.type) {
        case 'phase':
          appendDebug('phase', phaseDebugMessage(event.phase, retryCount), 'info', {
            phase: event.phase,
          });
          if (event.phase === 'thinking' && retryCount === 0) {
            setPhase('thinking');
            setStepper(0, 'Анализирую ваш запрос…');
          } else if (event.phase === 'finalizing') {
            setStepper(
              2,
              retryCount > 0 ? 'Собираю исправленный SQL-запрос…' : 'Формирую SQL-запрос…',
            );
          }
          break;
        case 'skill': {
          const args = event.args as Record<string, unknown>;
          appendDebug(
            'tool',
            `Вызов инструмента ${SKILL_LABELS[event.name] ?? event.name}`,
            'info',
            { skill: event.name, args },
          );
          if (DATA_SKILLS.has(event.name)) {
            const detailFn = SKILL_DETAILS[event.name];
            setStepper(1, detailFn ? detailFn(args) : SKILL_LABELS[event.name] ?? event.name);
          } else if (event.name === 'validate_query') {
            setStepper(2, 'Проверяю корректность запроса…');
          }
          break;
        }
        case 'sub_agent':
          appendDebug('orchestrator', `Выбран суб-агент ${event.name}`, 'success');
          break;
        case 'source_selected':
          selectedSource = { sourceId: event.sourceId, sourceName: event.sourceName };
          appendDebug('orchestrator', `Выбран источник данных: ${event.sourceName}`, 'success', {
            sourceId: event.sourceId,
          });
          break;
        case 'debug':
          appendDebug(
            event.scope,
            event.message,
            debugToneFromLevel(event.level),
            event.data,
          );
          break;
        case 'result':
          appendDebug(
            'result',
            event.data.sql ? 'Агент вернул SQL и пояснение' : 'Агент вернул пояснение без SQL',
            'success',
            {
              hasSql: Boolean(event.data.sql),
              canRetry: event.data.canRetry,
              suggestions: event.data.suggestions,
              sqlLength: typeof event.data.sql === 'string' ? event.data.sql.length : 0,
            },
          );
          result = event.data as unknown as AgentResponse;
          break;
        case 'trace':
          appendDebug(
            (event.scope as DebugScope) ?? 'orchestrator',
            event.message,
            'info',
            event.data ?? (typeof event.durationMs === 'number' ? { durationMs: event.durationMs } : undefined),
          );
          break;
        case 'error':
          appendDebug('error', `Ошибка SSE: ${event.error}`, 'error');
          streamError = event.error;
          break;
      }
    }
  }

  if (streamError) throw new Error(streamError);
  if (!result) throw new Error('Стрим завершился без результата');
  return {
    ...result,
    ...(selectedSource ? { _selectedSource: selectedSource } : {}),
  };
}

type RunAttemptContext = CallAgentContext & {
  setIsRetrying: (v: boolean) => void;
};

export async function runConstructorAttempt(
  text: string,
  prevSql: string | undefined,
  retry: number,
  signal: AbortSignal,
  retryError: string | undefined,
  unlimitedRows: boolean,
  chatSessionId: string,
  history: ModelMessage[],
  analysisContext: AnalysisContext | undefined,
  alreadyRetriedEmpty: boolean,
  ctx: RunAttemptContext,
): Promise<SavedChatAssistantMessage> {
  const { appendDebug, setPhase, setIsRetrying, setStepper } = ctx;
  if (retry > 0) {
    setPhase('retrying');
    setIsRetrying(true);
    const retryLabel = retryError?.startsWith('EMPTY:')
      ? `Запрос вернул 0 строк — корректирую (${retry}/${MAX_RETRIES})`
      : `Исправляю ошибку (${retry}/${MAX_RETRIES})`;
    setStepper(2, retryLabel);
    appendDebug('client', retryLabel, 'warn', { retry, retryError });
  } else {
    setPhase('thinking');
    setIsRetrying(false);
    setStepper(0, 'Анализирую ваш запрос…');
    appendDebug('client', 'Стартую новый прогон агента', 'info', {
      hasPreviousSql: Boolean(prevSql),
    });
  }

  const agentData = await callAgentStream(
    text,
    prevSql,
    retry,
    signal,
    retryError,
    unlimitedRows,
    chatSessionId,
    history,
    analysisContext,
    ctx,
  );

  if (!agentData.sql) {
    appendDebug('result', 'Агент завершил ответ без SQL', 'warn', {
      explanation: agentData.explanation,
      suggestions: agentData.suggestions,
    });
    const nextAnalysisContext = deriveAnalysisContextFromText({
      previous: analysisContext,
      query: text,
      assistantText: agentData.explanation,
      selectedSource: agentData._selectedSource,
      createdAt: new Date().toISOString(),
    });
    setIsRetrying(false);
    setStepper(4, '');
    setPhase('done');
    return {
      kind: 'text',
      text: agentData.explanation,
      suggestions: agentData.suggestions ?? [],
      ...(agentData.format === 'plain' ? { format: 'plain' as const } : agentData.format === 'markdown' ? { format: 'markdown' as const } : {}),
      ...(Array.isArray(agentData.charts) && agentData.charts.length > 0 ? { charts: agentData.charts } : {}),
      ...(nextAnalysisContext ? { analysisContext: nextAnalysisContext } : {}),
    };
  }

  setPhase('validating');
  setStepper(3, 'Выполняю запрос к базе данных…');
  appendDebug('query', 'Отправляю SQL на выполнение', 'info', {
    skipAutoRowLimit: unlimitedRows,
    sqlLength: agentData.sql.length,
    sqlPreview: agentData.sql,
  });

  const queryRes = await fetch(`${BASE_PATH}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: agentData.sql,
      ...(unlimitedRows ? { skipAutoRowLimit: true } : {}),
    }),
    signal,
  });
  const queryData = (await queryRes.json()) as QueryResult & { error?: string };

  if (!queryRes.ok) {
    const executionError = queryData.error ?? 'Ошибка выполнения запроса';
    const forceRetry = isRecoverableSqlSchemaError(executionError);
    appendDebug('query', `SQL выполнился с ошибкой: ${executionError}`, 'error', {
      retry,
      canRetry: agentData.canRetry !== false || forceRetry,
      forceRetry,
    });
    if (retry < MAX_RETRIES && (agentData.canRetry !== false || forceRetry)) {
      const retryHint = forceRetry
        ? `${executionError}\n\nПодсказка: если ошибка связана с городом, территорией или территориальным регионом, попробуй lookup_territory и фильтрацию через LEFT JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID] вместо прямого обращения к колонке основной таблицы.`
        : executionError;
      return runConstructorAttempt(
        text,
        agentData.sql,
        retry + 1,
        signal,
        retryHint,
        unlimitedRows,
        chatSessionId,
        history,
        analysisContext,
        alreadyRetriedEmpty,
        ctx,
      );
    }
    setIsRetrying(false);
    setStepper(4, '');
    setPhase('done');
    return {
      kind: 'text',
      tone: 'error',
      text: 'Не удалось построить рабочий запрос. Попробуйте переформулировать вопрос или уточнить фильтры.',
      suggestions: agentData.suggestions ?? [],
      detail: `${executionError}\n\nSQL:\n${agentData.sql}`,
    };
  }

  if (queryData.rowCount === 0 && !alreadyRetriedEmpty) {
    setPhase('self-checking');
    appendDebug('query', 'SQL отработал, но вернул 0 строк. Запускаю одну самокоррекцию', 'warn', {
      retry: retry + 1,
    });
    return runConstructorAttempt(
      text,
      agentData.sql,
      retry + 1,
      signal,
      'EMPTY: Запрос выполнился успешно, но вернул 0 строк. Проверь только конкретные ошибки: опечатка в коде ДГ, неверный регистр строки, не тот справочник. Если запрос связан с городом/территорией — попробуй JOIN с [dbo].[Территории] вместо прямого фильтра. Если после проверки ты уверен что фильтры корректны — верни тот же SQL, это валидный результат (данных действительно нет).',
      unlimitedRows,
      chatSessionId,
      history,
      analysisContext,
      true,
      ctx,
    );
  }

  if (queryData.rowCount === 0) {
    appendDebug('query', 'SQL вернул 0 строк после самокоррекции — возвращаю текстовый ответ', 'warn');
    setIsRetrying(false);
    setStepper(4, '');
    setPhase('done');
    return {
      kind: 'text',
      tone: 'warning',
      text: 'По вашему запросу данных не нашлось. Попробуйте расширить период или ослабить фильтры.',
      suggestions: agentData.suggestions ?? [],
      detail: agentData.sql,
    };
  }

  appendDebug('query', 'SQL успешно выполнен', 'success', {
    rowCount: queryData.rowCount,
    columns: queryData.columns?.length ?? 0,
  });

  const finalExplanation = queryData.rowCount > 0
    ? normalizeSuccessfulExplanation(agentData.explanation, queryData.rowCount)
    : agentData.explanation;
  const nextAnalysisContext = deriveAnalysisContextFromArtifact({
    previous: analysisContext,
    query: text,
    assistantText: finalExplanation,
    sql: agentData.sql,
    result: {
      columns: queryData.columns,
      rowCount: queryData.rowCount,
    },
    selectedSource: agentData._selectedSource,
    createdAt: new Date().toISOString(),
  });

  setIsRetrying(false);
  setStepper(4, '');
  setPhase('done');

  return {
    kind: 'artifact',
    text: finalExplanation,
    suggestions: agentData.suggestions ?? [],
    ...(nextAnalysisContext ? { analysisContext: nextAnalysisContext } : {}),
    artifact: {
      ...queryData,
      sql: agentData.sql,
      explanation: finalExplanation,
      ...(typeof agentData._skillRounds === 'number' ? { skillRounds: agentData._skillRounds } : {}),
      ...(unlimitedRows ? { skipAutoRowLimit: true } : {}),
    },
  };
}
