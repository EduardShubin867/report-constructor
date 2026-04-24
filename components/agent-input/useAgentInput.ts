'use client';

import { useEffect, useReducer, useRef, useState, useMemo, type KeyboardEvent } from 'react';
import type { AgentResponse, SSEEvent } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import type { AgentDebugEntry, AgentDebugTone } from '../AgentDebugPanel';
import { AGENT_DEBUG_ENABLED, BASE_PATH } from '@/lib/constants';
import { isRecoverableSqlSchemaError, normalizeSuccessfulExplanation } from './agent-text-utils';
import { debugToneFromLevel, phaseDebugMessage } from './debug-utils';
import { BUILD_STEP_INDEX } from './stepper-steps';
import { DATA_SKILLS, MAX_RETRIES, SKILL_DETAILS, SKILL_LABELS } from './skill-config';
import type { AgentInputProps, AgentResultMode, DebugScope, WelcomeCard } from './types';
import { EXAMPLE_QUERIES, POPULAR_QUERY_ICON, truncateWelcomeTitle } from './welcome-examples';
import { initialRunState, runReducer } from './agentReducer';

export function useAgentInput({ onResult, disabled, activeVersion = null }: AgentInputProps) {
  const [run, dispatch] = useReducer(runReducer, initialRunState);
  const [query, setQuery] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [skipAutoRowLimit, setSkipAutoRowLimit] = useState(false);
  const [popularItems, setPopularItems] = useState<{ query: string; count: number }[]>([]);
  const [debugEntries, setDebugEntries] = useState<AgentDebugEntry[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeRunControllerRef = useRef<AbortController | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const debugSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${BASE_PATH}/api/agent/popular-queries?limit=6&days=30`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: { query: string; count: number }[] };
        if (cancelled || !Array.isArray(data.items)) return;
        setPopularItems(data.items);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => { activeRunControllerRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!activeVersion || isRunning) return;
    const nextSql = activeVersion.result.sql || null;
    const nextExplanation = activeVersion.result.explanation || null;
    const shouldSync =
      run.phase !== 'done' || nextSql !== run.lastSql || nextExplanation !== run.explanation;
    if (!shouldSync) return;
    dispatch({ type: 'SYNC_VERSION', sql: nextSql, explanation: nextExplanation, skillRounds: activeVersion.result.skillRounds ?? 0 });
    setShowSql(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVersion, run.phase, run.lastSql, run.explanation]);

  const isRunning =
    run.phase === 'thinking' ||
    run.phase === 'validating' ||
    run.phase === 'retrying' ||
    run.phase === 'self-checking';
  const isIterating = !!run.lastSql && run.phase === 'done';
  const showWelcome = !run.lastSql && run.phase === 'idle' && !query.trim();

  const welcomeCards = useMemo((): WelcomeCard[] => {
    const popularCards: WelcomeCard[] = popularItems.slice(0, 3).map((item, i) => ({
      key: `popular-${i}-${item.query.slice(0, 48)}`,
      title: truncateWelcomeTitle(item.query, 52),
      query: item.query,
      icon: POPULAR_QUERY_ICON,
    }));
    const staticNeeded =
      popularCards.length === 0 ? EXAMPLE_QUERIES.length : Math.max(0, 6 - popularCards.length);
    const staticCards: WelcomeCard[] = EXAMPLE_QUERIES.slice(0, staticNeeded).map(ex => ({
      key: `ex-${ex.title}`,
      title: ex.title,
      query: ex.query,
      icon: ex.icon,
    }));
    return [...popularCards, ...staticCards];
  }, [popularItems]);

  function appendDebugEntry(
    scope: DebugScope,
    message: string,
    tone: AgentDebugTone = 'info',
    data?: unknown,
  ) {
    if (!AGENT_DEBUG_ENABLED) return;
    const startedAt = runStartedAtRef.current ?? Date.now();
    const now = Date.now();
    setDebugEntries(prev => [
      ...prev.slice(-199),
      {
        id: `${now}-${debugSeqRef.current++}`,
        createdAt: new Date(now).toISOString(),
        scope,
        message,
        tone,
        elapsedMs: Math.max(0, now - startedAt),
        ...(data !== undefined ? { data } : {}),
      },
    ]);
  }

  function resetDebugEntries() {
    if (!AGENT_DEBUG_ENABLED) return;
    runStartedAtRef.current = Date.now();
    debugSeqRef.current = 0;
    setDebugEntries([]);
  }

  async function _callAgent(
    text: string,
    prevSql: string | undefined,
    retryCount: number,
    signal: AbortSignal,
    retryError: string | undefined,
    skipLimit: boolean,
  ): Promise<AgentResponse> {
    appendDebugEntry(
      'client',
      retryCount > 0
        ? `Открываю новый SSE-запрос для ретрая ${retryCount}/${MAX_RETRIES}`
        : 'Открываю SSE-запрос к агенту',
      'info',
      { mode: prevSql ? 'follow-up' : 'fresh', skipAutoRowLimit: skipLimit, hasPreviousSql: Boolean(prevSql), hasRetryError: Boolean(retryError) },
    );

    const res = await fetch(`${BASE_PATH}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: text,
        previousSql: prevSql,
        retryError,
        ...(skipLimit ? { skipAutoRowLimit: true } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error ?? `HTTP ${res.status}`);
    }

    appendDebugEntry('client', 'SSE-соединение установлено', 'success', { status: res.status });

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Streaming не поддерживается');

    const decoder = new TextDecoder();
    let buffer = '';
    let result: AgentResponse | null = null;
    let streamError: string | null = null;

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
        try { event = JSON.parse(jsonStr); } catch { continue; }

        switch (event.type) {
          case 'phase':
            appendDebugEntry('phase', phaseDebugMessage(event.phase, retryCount), 'info', { phase: event.phase });
            if (event.phase === 'thinking' && retryCount === 0) {
              dispatch({ type: 'START' });
            } else if (event.phase === 'finalizing') {
              dispatch({
                type: 'SET_STEP',
                step: BUILD_STEP_INDEX,
                detail: retryCount > 0 ? 'Собираю исправленный SQL-запрос…' : 'Формирую SQL-запрос…',
              });
            }
            break;
          case 'skill': {
            const skillName = event.name;
            const args = event.args as Record<string, unknown>;
            appendDebugEntry('tool', `Вызов инструмента ${SKILL_LABELS[skillName] ?? skillName}`, 'info', { skill: skillName, args });
            if (DATA_SKILLS.has(skillName)) {
              const detailFn = SKILL_DETAILS[skillName];
              dispatch({ type: 'SET_STEP', step: 1, detail: detailFn ? detailFn(args) : SKILL_LABELS[skillName] ?? skillName });
            } else if (skillName === 'validate_query') {
              dispatch({ type: 'SET_STEP', step: BUILD_STEP_INDEX, detail: 'Проверяю корректность запроса…' });
            }
            break;
          }
          case 'sub_agent':
            appendDebugEntry('orchestrator', `Выбран суб-агент ${event.name}`, 'success');
            break;
          case 'debug':
            appendDebugEntry(event.scope, event.message, debugToneFromLevel(event.level), event.data);
            break;
          case 'result':
            appendDebugEntry(
              'result',
              event.data.sql ? 'Агент вернул SQL и пояснение' : 'Агент вернул пояснение без SQL',
              'success',
              { hasSql: Boolean(event.data.sql), canRetry: event.data.canRetry, suggestions: event.data.suggestions, sqlLength: typeof event.data.sql === 'string' ? event.data.sql.length : 0 },
            );
            result = event.data as unknown as AgentResponse;
            break;
          case 'error':
            appendDebugEntry('error', `Ошибка SSE: ${event.error}`, 'error');
            streamError = event.error;
            break;
        }
      }
    }

    if (streamError) throw new Error(streamError);
    if (!result) throw new Error('Стрим завершился без результата');
    return result;
  }

  async function _run(
    text: string,
    prevSql: string | undefined,
    retry: number,
    signal: AbortSignal,
    resultMode: AgentResultMode,
    retryError: string | undefined,
    skipLimit: boolean,
  ): Promise<void> {
    if (retry > 0) {
      const retryLabel = retryError?.startsWith('EMPTY:')
        ? `Запрос вернул 0 строк — корректирую (${retry}/${MAX_RETRIES})`
        : `Исправляю ошибку (${retry}/${MAX_RETRIES})`;
      dispatch({ type: 'START_RETRY', step: BUILD_STEP_INDEX, detail: retryLabel });
      appendDebugEntry('client', retryLabel, 'warn', { retry, retryError });
    } else {
      dispatch({ type: 'START' });
      appendDebugEntry('client', 'Стартую новый прогон агента', 'info', { mode: resultMode, hasPreviousSql: Boolean(prevSql) });
    }

    const agentData = await _callAgent(text, prevSql, retry, signal, retryError, skipLimit);

    dispatch({ type: 'SET_SQL', sql: agentData.sql || null, suggestions: agentData.suggestions ?? [], skillRounds: agentData._skillRounds ?? 0 });

    if (!agentData.sql) {
      appendDebugEntry('result', 'Агент завершил ответ без SQL', 'warn', { explanation: agentData.explanation, suggestions: agentData.suggestions });
      dispatch({ type: 'DONE', explanation: agentData.explanation });
      return;
    }

    dispatch({ type: 'VALIDATING' });
    appendDebugEntry('query', 'Отправляю SQL на выполнение', 'info', { skipAutoRowLimit: skipLimit, sqlLength: agentData.sql.length, sqlPreview: agentData.sql });

    const queryRes = await fetch(`${BASE_PATH}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: agentData.sql, ...(skipLimit ? { skipAutoRowLimit: true } : {}) }),
      signal,
    });
    const queryData: QueryResult & { error?: string } = await queryRes.json();

    if (!queryRes.ok) {
      const execError = queryData.error ?? 'Ошибка выполнения запроса';
      const forceRetry = isRecoverableSqlSchemaError(execError);
      appendDebugEntry('query', `SQL выполнился с ошибкой: ${execError}`, 'error', { retry, canRetry: agentData.canRetry !== false || forceRetry, forceRetry });
      if (retry < MAX_RETRIES && (agentData.canRetry !== false || forceRetry)) {
        const retryHint = forceRetry
          ? `${execError}\n\nПодсказка: если ошибка связана с городом, территорией или территориальным регионом, попробуй lookup_territory и фильтрацию через LEFT JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID] вместо прямого обращения к колонке основной таблицы.`
          : execError;
        return _run(text, agentData.sql, retry + 1, signal, resultMode, retryHint, skipLimit);
      }
      throw new Error(execError);
    }

    if (queryData.rowCount === 0 && retry < MAX_RETRIES) {
      dispatch({ type: 'SELF_CHECKING' });
      appendDebugEntry('query', 'SQL отработал, но вернул 0 строк. Запускаю самокоррекцию', 'warn', { retry: retry + 1 });
      return _run(
        text,
        agentData.sql,
        retry + 1,
        signal,
        resultMode,
        'EMPTY: Запрос выполнился успешно, но вернул 0 строк. Вероятно, условия WHERE слишком жёсткие или значения фильтров неверны (неправильный код ДГ, формат даты, регистр). Если запрос связан с городом, территорией или территориальным регионом, проверь значения через lookup_territory и попробуй фильтрацию через JOIN с [dbo].[Территории] вместо прямого фильтра по основной таблице.',
        skipLimit,
      );
    }

    appendDebugEntry('query', 'SQL успешно выполнен', 'success', { rowCount: queryData.rowCount, columns: queryData.columns?.length ?? 0 });
    const finalExplanation = queryData.rowCount > 0
      ? normalizeSuccessfulExplanation(agentData.explanation, queryData.rowCount)
      : agentData.explanation;
    dispatch({ type: 'DONE', explanation: finalExplanation });
    onResult(
      { ...queryData, sql: agentData.sql, explanation: finalExplanation, skillRounds: agentData._skillRounds, ...(skipLimit ? { skipAutoRowLimit: true } : {}) },
      text,
      resultMode,
    );
  }

  async function runQuery(text: string, prevSql?: string, resultMode: AgentResultMode = 'replace') {
    if (!text.trim() || isRunning || disabled) return;
    const controller = new AbortController();
    activeRunControllerRef.current = controller;
    resetDebugEntries();
    dispatch({ type: 'CLEAR_ERROR' });
    dispatch({ type: 'SET_STEP', step: 0, detail: 'Анализирую ваш запрос…' });
    if (!prevSql) dispatch({ type: 'CLEAR_RESULT' });

    appendDebugEntry('client', 'Подготавливаю запуск свободного запроса', 'info', {
      query: text,
      mode: resultMode,
      hasPreviousSql: Boolean(prevSql),
      skipAutoRowLimit,
    });

    try {
      await _run(text, prevSql, 0, controller.signal, resultMode, undefined, skipAutoRowLimit);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        appendDebugEntry('client', 'Запрос остановлен пользователем', 'warn');
        dispatch({ type: 'ABORT' });
        return;
      }
      appendDebugEntry('error', e instanceof Error ? e.message : 'Неизвестная ошибка', 'error');
      dispatch({ type: 'ERROR', message: e instanceof Error ? e.message : 'Неизвестная ошибка' });
    } finally {
      if (activeRunControllerRef.current === controller) {
        activeRunControllerRef.current = null;
      }
    }
  }

  function placeQueryInInput(text: string) {
    setQuery(text);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = text.length;
      el.setSelectionRange(len, len);
    });
  }

  const handleSubmit        = () => runQuery(query, undefined, 'replace');
  const handleRefineCurrent = () => { if (run.lastSql) runQuery(query, run.lastSql, 'append'); };
  const handleSuggestion    = (s: string) => placeQueryInInput(s);
  const handleExample       = (q: string) => placeQueryInInput(q);
  const handleStop          = () => {
    appendDebugEntry('client', 'Пользователь остановил выполнение', 'warn');
    activeRunControllerRef.current?.abort();
  };
  const reset = () => {
    activeRunControllerRef.current?.abort();
    activeRunControllerRef.current = null;
    dispatch({ type: 'ABORT' });
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
  };

  return {
    phase:         run.phase,
    lastSql:       run.lastSql,
    explanation:   run.explanation,
    suggestions:   run.suggestions,
    skillRounds:   run.skillRounds,
    error:         run.error,
    activeStep:    run.activeStep,
    stepStatuses:  run.stepStatuses,
    stepDetail:    run.stepDetail,
    isRetrying:    run.isRetrying,
    query,         setQuery,
    showSql,       setShowSql,
    skipAutoRowLimit, setSkipAutoRowLimit,
    debugEntries,
    isRunning,
    isIterating,
    showWelcome,
    welcomeCards,
    textareaRef,
    handleSubmit,
    handleRefineCurrent,
    handleSuggestion,
    handleExample,
    handleStop,
    reset,
    handleKeyDown,
  };
}
