'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import type { ModelMessage } from 'ai';
import type { AgentResponse, SSEEvent } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import AgentArtifactModal from '@/components/AgentArtifactModal';
import AgentChatAssistantMessage from '@/components/agent-chat/AgentChatAssistantMessage';
import AgentChatErrorAlert from '@/components/agent-chat/AgentChatErrorAlert';
import AgentChatMobileBar from '@/components/agent-chat/AgentChatMobileBar';
import AgentChatPanelHeader from '@/components/agent-chat/AgentChatPanelHeader';
import AgentChatSidebarDrawer from '@/components/agent-chat/AgentChatSidebarDrawer';
import AgentChatThinkingPanel from '@/components/agent-chat/AgentChatThinkingPanel';
import AgentChatUserBubble from '@/components/agent-chat/AgentChatUserBubble';
import AgentChatWelcomeGrid from '@/components/agent-chat/AgentChatWelcomeGrid';
import ChatSidebar from '@/components/agent-chat/ChatSidebar';
import {
  DATA_SKILLS,
  MAX_RETRIES,
  SKILL_DETAILS,
  SKILL_LABELS,
} from '@/components/agent-chat/skill-meta';
import type {
  DebugScope,
  FollowUpContext,
  PendingTurn,
  Phase,
  WelcomeCard,
} from '@/components/agent-chat/types';
import {
  buildOptimisticChat,
  buildStepStatuses,
  debugToneFromLevel,
  generateId,
  isRecoverableSqlSchemaError,
  normalizeSuccessfulExplanation,
  phaseDebugMessage,
  truncateTitle,
} from '@/components/agent-chat/utils';
import {
  EXAMPLE_QUERIES,
  POPULAR_QUERY_ICON,
  STEPPER_STEP_COUNT,
  STEPPER_STEPS,
} from '@/components/agent-chat/welcome-and-stepper';
import AgentComposer from '@/components/AgentComposer';
import AgentDebugPanel, { type AgentDebugEntry, type AgentDebugTone } from '@/components/AgentDebugPanel';
import type { StepStatus } from '@/components/AgentStepper';
import { AGENT_DEBUG_ENABLED, BASE_PATH } from '@/lib/constants';
import type {
  ArtifactPayload,
  SavedChatAssistantMessage,
  SavedChatSession,
  SavedChatSummary,
  SavedChatTurn,
} from '@/lib/report-history-types';

export default function AgentChatWorkspace() {
  const [query, setQuery] = useState('');
  const [skipAutoRowLimit, setSkipAutoRowLimit] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() =>
    buildStepStatuses(STEPPER_STEP_COUNT, 0),
  );
  const [stepDetail, setStepDetail] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [popularItems, setPopularItems] = useState<{ query: string; count: number }[]>([]);
  const [debugEntries, setDebugEntries] = useState<AgentDebugEntry[]>([]);
  const [savedChats, setSavedChats] = useState<SavedChatSummary[]>([]);
  const [savedChatsLoading, setSavedChatsLoading] = useState(true);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<SavedChatSession | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const [followUpContext, setFollowUpContext] = useState<FollowUpContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportingTurnId, setExportingTurnId] = useState<string | null>(null);
  const [openArtifactTurn, setOpenArtifactTurn] = useState<SavedChatTurn | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const activeRunControllerRef = useRef<AbortController | null>(null);
  const abortRestoreDraftRef = useRef<string | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const debugSeqRef = useRef(0);
  const didHydrateInitialHistoryRef = useRef(false);
  const loadRequestSeqRef = useRef(0);
  const currentChatIdRef = useRef<string | null>(null);
  const activeChatTokenRef = useRef(0);

  const isRunning = phase === 'thinking' || phase === 'validating' || phase === 'retrying' || phase === 'self-checking';

  const welcomeCards = useMemo((): WelcomeCard[] => {
    const popularCards: WelcomeCard[] = popularItems.slice(0, 3).map((item, index) => ({
      key: `popular-${index}-${item.query.slice(0, 48)}`,
      title: truncateTitle(item.query, 52),
      query: item.query,
      icon: POPULAR_QUERY_ICON,
    }));
    const staticNeeded =
      popularCards.length === 0 ? EXAMPLE_QUERIES.length : Math.max(0, 6 - popularCards.length);

    return [
      ...popularCards,
      ...EXAMPLE_QUERIES.slice(0, staticNeeded).map(item => ({
        key: `example-${item.title}`,
        title: item.title,
        query: item.query,
        icon: item.icon,
      })),
    ];
  }, [popularItems]);

  const sidebarChats = useMemo(() => {
    if (!activeChat) return savedChats;
    const optimisticSummary: SavedChatSummary = {
      id: activeChat.id,
      firstQuery: activeChat.firstQuery,
      latestQuery: activeChat.latestQuery,
      turnCount: activeChat.turnCount,
      createdAt: activeChat.createdAt,
      updatedAt: activeChat.updatedAt,
    };
    const others = savedChats.filter(chat => chat.id !== optimisticSummary.id);
    return [optimisticSummary, ...others].slice(0, 6);
  }, [activeChat, savedChats]);

  const showEmptyState = !activeChat?.turns.length && !pendingTurn;
  const activeChatId = activeChat?.id ?? currentChatIdRef.current;
  const chatHeading = showEmptyState
    ? 'Чат'
    : truncateTitle(activeChat?.firstQuery ?? pendingTurn?.userQuery ?? 'Новый чат', 92);
  const chatSubheading = showEmptyState
    ? null
    : 'История вопросов и артефактов сохраняется автоматически внутри текущего диалога.';

  const layoutId = openArtifactTurn ? `artifact-${openArtifactTurn.id}` : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${BASE_PATH}/api/agent/popular-queries?limit=6&days=30`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: { query: string; count: number }[] };
        if (!cancelled && Array.isArray(data.items)) {
          setPopularItems(data.items);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRestoreDraftRef.current = null;
      activeRunControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeChat?.turns.length, pendingTurn, isRunning, runnerError]);

  const bumpActiveChatToken = useCallback(() => {
    activeChatTokenRef.current += 1;
    return activeChatTokenRef.current;
  }, []);

  const resetRunnerUi = useCallback(() => {
    setPhase('idle');
    setRunnerError(null);
    setIsRetrying(false);
    setActiveStep(0);
    setStepStatuses(buildStepStatuses(STEPPER_STEP_COUNT, 0));
    setStepDetail('');
  }, []);

  const appendDebugEntry = useCallback((
    scope: DebugScope,
    message: string,
    tone: AgentDebugTone = 'info',
    data?: unknown,
  ) => {
    if (!AGENT_DEBUG_ENABLED) return;
    const startedAt = runStartedAtRef.current ?? Date.now();
    const now = Date.now();
    const nextEntry: AgentDebugEntry = {
      id: `${now}-${debugSeqRef.current++}`,
      createdAt: new Date(now).toISOString(),
      scope,
      message,
      tone,
      elapsedMs: Math.max(0, now - startedAt),
      ...(data !== undefined ? { data } : {}),
    };
    setDebugEntries(prev => [...prev.slice(-199), nextEntry]);
  }, []);

  const resetDebugEntries = useCallback(() => {
    if (!AGENT_DEBUG_ENABLED) return;
    runStartedAtRef.current = Date.now();
    debugSeqRef.current = 0;
    setDebugEntries([]);
  }, []);

  const setStepperState = useCallback((step: number, detailText: string) => {
    setActiveStep(step);
    setStepStatuses(buildStepStatuses(STEPPER_STEP_COUNT, step));
    setStepDetail(detailText);
  }, []);

  const applySavedChat = useCallback((chat: SavedChatSession) => {
    bumpActiveChatToken();
    currentChatIdRef.current = chat.id;
    setActiveChat(chat);
    setSaveState('saved');
    setSavedAt(chat.updatedAt);
    setPendingTurn(null);
    setFollowUpContext(null);
    setRunnerError(null);
    setOpenArtifactTurn(null);
    resetRunnerUi();
  }, [bumpActiveChatToken, resetRunnerUi]);

  const refreshSavedChats = useCallback(async () => {
    setSavedChatsLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/report-history?limit=6`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Не удалось загрузить историю');
      const payload = (await res.json()) as { items: SavedChatSummary[] };
      setSavedChats(payload.items);

      if (!didHydrateInitialHistoryRef.current) {
        didHydrateInitialHistoryRef.current = true;
        if (payload.items.length > 0) {
          const firstId = payload.items[0].id;
          const requestSeq = ++loadRequestSeqRef.current;
          setLoadingChatId(firstId);
          try {
            const chatRes = await fetch(`${BASE_PATH}/api/report-history/${firstId}`);
            if (chatRes.ok) {
              const chatPayload = (await chatRes.json()) as { chat: SavedChatSession };
              if (loadRequestSeqRef.current === requestSeq) {
                applySavedChat(chatPayload.chat);
              }
            }
          } finally {
            setLoadingChatId(current => (current === firstId ? null : current));
          }
        }
      }
    } catch {
      didHydrateInitialHistoryRef.current = true;
    } finally {
      setSavedChatsLoading(false);
    }
  }, [applySavedChat]);

  useEffect(() => {
    void refreshSavedChats();
  }, [refreshSavedChats]);

  const stopActiveRun = useCallback((restoreDraft: string | null = null) => {
    abortRestoreDraftRef.current = restoreDraft;
    activeRunControllerRef.current?.abort();
  }, []);

  const loadSavedChat = useCallback(async (chatId: string) => {
    stopActiveRun();
    const requestSeq = ++loadRequestSeqRef.current;
    setLoadingChatId(chatId);
    setRunnerError(null);
    setDrawerOpen(false);

    try {
      const res = await fetch(`${BASE_PATH}/api/report-history/${chatId}`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Не удалось загрузить чат');
      const payload = (await res.json()) as { chat: SavedChatSession };
      if (loadRequestSeqRef.current === requestSeq) {
        applySavedChat(payload.chat);
      }
    } catch (error) {
      if (loadRequestSeqRef.current === requestSeq) {
        setRunnerError(error instanceof Error ? error.message : 'Не удалось загрузить чат');
      }
    } finally {
      if (loadRequestSeqRef.current === requestSeq) {
        setLoadingChatId(current => (current === chatId ? null : current));
      }
    }
  }, [applySavedChat, stopActiveRun]);

  const handleNewChat = useCallback(() => {
    stopActiveRun();
    didHydrateInitialHistoryRef.current = true;
    loadRequestSeqRef.current += 1;
    bumpActiveChatToken();
    currentChatIdRef.current = null;
    setActiveChat(null);
    setPendingTurn(null);
    setFollowUpContext(null);
    setQuery('');
    setSaveState('idle');
    setSavedAt(null);
    setDrawerOpen(false);
    setOpenArtifactTurn(null);
    setExportingTurnId(null);
    resetRunnerUi();
  }, [bumpActiveChatToken, resetRunnerUi, stopActiveRun]);

  async function exportArtifact(artifact: ArtifactPayload, turnId: string) {
    setExportingTurnId(turnId);
    setRunnerError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/query/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: artifact.sql,
          ...(artifact.skipAutoRowLimit ? { skipAutoRowLimit: true } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка экспорта');
      const url = URL.createObjectURL(await res.blob());
      const anchor = Object.assign(document.createElement('a'), {
        href: url,
        download: `ai_artifact_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setRunnerError(error instanceof Error ? error.message : 'Ошибка экспорта');
    } finally {
      setExportingTurnId(null);
    }
  }

  async function persistTurn(chatId: string, turn: SavedChatTurn, chatToken: number) {
    try {
      setSaveState('saving');
      const res = await fetch(`${BASE_PATH}/api/report-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          turn: {
            createdAt: turn.createdAt,
            userQuery: turn.userQuery,
            assistant: turn.assistant,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Не удалось сохранить чат');
      const payload = (await res.json()) as { chat: SavedChatSession };

      setSavedChats(prev => {
        const nextSummary: SavedChatSummary = {
          id: payload.chat.id,
          firstQuery: payload.chat.firstQuery,
          latestQuery: payload.chat.latestQuery,
          turnCount: payload.chat.turnCount,
          createdAt: payload.chat.createdAt,
          updatedAt: payload.chat.updatedAt,
        };
        const others = prev.filter(item => item.id !== nextSummary.id);
        return [nextSummary, ...others].slice(0, 6);
      });

      if (activeChatTokenRef.current === chatToken) {
        currentChatIdRef.current = payload.chat.id;
        setActiveChat(payload.chat);
        setSaveState('saved');
        setSavedAt(payload.chat.updatedAt);
      }
    } catch (error) {
      console.error('Failed to persist chat turn:', error);
      if (activeChatTokenRef.current === chatToken) {
        setSaveState('error');
      }
    }
  }

  async function callAgent(
    text: string,
    prevSql: string | undefined,
    retryCount: number,
    signal: AbortSignal,
    retryError: string | undefined,
    unlimitedRows: boolean,
    history: ModelMessage[],
  ): Promise<AgentResponse> {
    appendDebugEntry(
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
        ...(unlimitedRows ? { skipAutoRowLimit: true } : {}),
        ...(history.length > 0 ? { history } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error ?? `HTTP ${res.status}`);
    }

    appendDebugEntry('client', 'SSE-соединение установлено', 'success', { status: res.status });

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Streaming не поддерживается');

    const decoder = new TextDecoder();
    let buffer = '';
    let result: AgentResponse | null = null;
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
            appendDebugEntry('phase', phaseDebugMessage(event.phase, retryCount), 'info', {
              phase: event.phase,
            });
            if (event.phase === 'thinking' && retryCount === 0) {
              setPhase('thinking');
              setStepperState(0, 'Анализирую ваш запрос…');
            } else if (event.phase === 'finalizing') {
              setStepperState(
                2,
                retryCount > 0 ? 'Собираю исправленный SQL-запрос…' : 'Формирую SQL-запрос…',
              );
            }
            break;
          case 'skill': {
            const args = event.args as Record<string, unknown>;
            appendDebugEntry(
              'tool',
              `Вызов инструмента ${SKILL_LABELS[event.name] ?? event.name}`,
              'info',
              { skill: event.name, args },
            );
            if (DATA_SKILLS.has(event.name)) {
              const detailFn = SKILL_DETAILS[event.name];
              setStepperState(1, detailFn ? detailFn(args) : SKILL_LABELS[event.name] ?? event.name);
            } else if (event.name === 'validate_query') {
              setStepperState(2, 'Проверяю корректность запроса…');
            }
            break;
          }
          case 'sub_agent':
            appendDebugEntry('orchestrator', `Выбран суб-агент ${event.name}`, 'success');
            break;
          case 'debug':
            appendDebugEntry(
              event.scope,
              event.message,
              debugToneFromLevel(event.level),
              event.data,
            );
            break;
          case 'result':
            appendDebugEntry(
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
            appendDebugEntry(
              (event.scope as DebugScope) ?? 'orchestrator',
              event.message,
              'info',
              event.data ?? (typeof event.durationMs === 'number' ? { durationMs: event.durationMs } : undefined),
            );
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

  async function runAttempt(
    text: string,
    prevSql: string | undefined,
    retry: number,
    signal: AbortSignal,
    retryError: string | undefined,
    unlimitedRows: boolean,
    history: ModelMessage[],
    alreadyRetriedEmpty = false,
  ): Promise<SavedChatAssistantMessage> {
    if (retry > 0) {
      setPhase('retrying');
      setIsRetrying(true);
      const retryLabel = retryError?.startsWith('EMPTY:')
        ? `Запрос вернул 0 строк — корректирую (${retry}/${MAX_RETRIES})`
        : `Исправляю ошибку (${retry}/${MAX_RETRIES})`;
      setStepperState(2, retryLabel);
      appendDebugEntry('client', retryLabel, 'warn', { retry, retryError });
    } else {
      setPhase('thinking');
      setIsRetrying(false);
      setStepperState(0, 'Анализирую ваш запрос…');
      appendDebugEntry('client', 'Стартую новый прогон агента', 'info', {
        hasPreviousSql: Boolean(prevSql),
      });
    }

    const agentData = await callAgent(text, prevSql, retry, signal, retryError, unlimitedRows, history);

    if (!agentData.sql) {
      appendDebugEntry('result', 'Агент завершил ответ без SQL', 'warn', {
        explanation: agentData.explanation,
        suggestions: agentData.suggestions,
      });
      setIsRetrying(false);
      setStepperState(4, '');
      setPhase('done');
      return {
        kind: 'text',
        text: agentData.explanation,
        suggestions: agentData.suggestions ?? [],
      };
    }

    setPhase('validating');
    setStepperState(3, 'Выполняю запрос к базе данных…');
    appendDebugEntry('query', 'Отправляю SQL на выполнение', 'info', {
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
      appendDebugEntry('query', `SQL выполнился с ошибкой: ${executionError}`, 'error', {
        retry,
        canRetry: agentData.canRetry !== false || forceRetry,
        forceRetry,
      });
      if (retry < MAX_RETRIES && (agentData.canRetry !== false || forceRetry)) {
        const retryHint = forceRetry
          ? `${executionError}\n\nПодсказка: если ошибка связана с городом, территорией или территориальным регионом, попробуй lookup_territory и фильтрацию через LEFT JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID] вместо прямого обращения к колонке основной таблицы.`
          : executionError;
        return runAttempt(text, agentData.sql, retry + 1, signal, retryHint, unlimitedRows, history, alreadyRetriedEmpty);
      }
      setIsRetrying(false);
      setStepperState(4, '');
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
      appendDebugEntry('query', 'SQL отработал, но вернул 0 строк. Запускаю одну самокоррекцию', 'warn', {
        retry: retry + 1,
      });
      return runAttempt(
        text,
        agentData.sql,
        retry + 1,
        signal,
        'EMPTY: Запрос выполнился успешно, но вернул 0 строк. Проверь только конкретные ошибки: опечатка в коде ДГ, неверный регистр строки, не тот справочник. Если запрос связан с городом/территорией — попробуй JOIN с [dbo].[Территории] вместо прямого фильтра. Если после проверки ты уверен что фильтры корректны — верни тот же SQL, это валидный результат (данных действительно нет).',
        unlimitedRows,
        history,
        true,
      );
    }

    if (queryData.rowCount === 0) {
      appendDebugEntry('query', 'SQL вернул 0 строк после самокоррекции — возвращаю текстовый ответ', 'warn');
      setIsRetrying(false);
      setStepperState(4, '');
      setPhase('done');
      return {
        kind: 'text',
        tone: 'warning',
        text: 'По вашему запросу данных не нашлось. Попробуйте расширить период или ослабить фильтры.',
        suggestions: agentData.suggestions ?? [],
        detail: agentData.sql,
      };
    }

    appendDebugEntry('query', 'SQL успешно выполнен', 'success', {
      rowCount: queryData.rowCount,
      columns: queryData.columns?.length ?? 0,
    });

    const finalExplanation = queryData.rowCount > 0
      ? normalizeSuccessfulExplanation(agentData.explanation, queryData.rowCount)
      : agentData.explanation;

    setIsRetrying(false);
    setStepperState(4, '');
    setPhase('done');

    return {
      kind: 'artifact',
      text: finalExplanation,
      suggestions: agentData.suggestions ?? [],
      artifact: {
        ...queryData,
        sql: agentData.sql,
        explanation: finalExplanation,
        ...(typeof agentData._skillRounds === 'number' ? { skillRounds: agentData._skillRounds } : {}),
        ...(unlimitedRows ? { skipAutoRowLimit: true } : {}),
      },
    };
  }

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    });
  }, []);

  const placeQueryInComposer = useCallback((text: string) => {
    setQuery(text);
    focusComposer();
  }, [focusComposer]);

  async function handleSubmit() {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isRunning) return;

    const targetChatId = currentChatIdRef.current ?? generateId();
    currentChatIdRef.current = targetChatId;

    const createdAt = new Date().toISOString();
    const pending: PendingTurn = {
      id: `pending-${Date.now()}`,
      createdAt,
      userQuery: trimmedQuery,
      targetChatId,
    };

    setPendingTurn(pending);
    setQuery('');
    setRunnerError(null);
    setOpenArtifactTurn(null);

    const controller = new AbortController();
    activeRunControllerRef.current = controller;
    abortRestoreDraftRef.current = null;
    resetDebugEntries();

    const queryContext = followUpContext;
    setFollowUpContext(null);

    const history: ModelMessage[] = (activeChat?.turns ?? []).flatMap(turn => {
      const assistantContent = turn.assistant.kind === 'artifact'
        ? JSON.stringify({
            sql: turn.assistant.artifact.sql,
            explanation: turn.assistant.text,
            suggestions: turn.assistant.suggestions ?? [],
          })
        : JSON.stringify({
            sql: '',
            explanation: turn.assistant.text,
            suggestions: turn.assistant.suggestions ?? [],
          });
      return [
        { role: 'user' as const, content: turn.userQuery },
        { role: 'assistant' as const, content: assistantContent },
      ];
    });

    try {
      const assistant = await runAttempt(
        trimmedQuery,
        queryContext?.sql,
        0,
        controller.signal,
        undefined,
        skipAutoRowLimit,
        history,
      );

      const localTurn: SavedChatTurn = {
        id: `local-${Date.now()}`,
        createdAt,
        userQuery: trimmedQuery,
        assistant,
      };

      setPendingTurn(null);
      setActiveChat(current => buildOptimisticChat(current, targetChatId, localTurn));
      const chatToken = activeChatTokenRef.current;
      void persistTurn(targetChatId, localTurn, chatToken);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const restoreDraft = abortRestoreDraftRef.current;
        if (restoreDraft) setQuery(restoreDraft);
        setPendingTurn(null);
        resetRunnerUi();
        return;
      }

      appendDebugEntry('error', error instanceof Error ? error.message : 'Неизвестная ошибка', 'error');
      setPendingTurn(null);
      setIsRetrying(false);
      setPhase('error');
      setRunnerError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      abortRestoreDraftRef.current = null;
      if (activeRunControllerRef.current === controller) {
        activeRunControllerRef.current = null;
      }
    }
  }

  const handleStop = useCallback(() => {
    appendDebugEntry('client', 'Пользователь остановил выполнение', 'warn');
    stopActiveRun(pendingTurn?.userQuery ?? query);
  }, [appendDebugEntry, pendingTurn?.userQuery, query, stopActiveRun]);

  return (
    <LayoutGroup>
      <div className="space-y-4">
        <div className="grid gap-5 lg:h-[calc(100dvh-7rem)] lg:grid-cols-[18.75rem_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[19.75rem_minmax(0,1fr)]">
          <aside className="hidden lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
            <ChatSidebar
              chats={sidebarChats}
              loading={savedChatsLoading}
              activeChatId={activeChatId}
              loadingChatId={loadingChatId}
              saveState={saveState}
              savedAt={savedAt}
              onSelect={chatId => void loadSavedChat(chatId)}
              onCreate={handleNewChat}
            />
          </aside>

          <div className="min-w-0 space-y-3 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
            <AgentChatMobileBar
              onOpenChats={() => setDrawerOpen(true)}
              onNewChat={handleNewChat}
            />

            <section className="ui-panel overflow-hidden rounded-[32px] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <AgentChatPanelHeader
                chatHeading={chatHeading}
                chatSubheading={chatSubheading}
                showEmptyState={showEmptyState}
                activeChat={activeChat}
                saveState={saveState}
                savedAt={savedAt}
              />

              <div className="flex min-h-0 flex-col px-4 py-3 sm:px-5 lg:min-h-0 lg:flex-1 lg:px-6">
                <div className="flex-1 space-y-5 overflow-y-auto pr-1 lg:min-h-0">
                  {showEmptyState ? (
                    <AgentChatWelcomeGrid cards={welcomeCards} onPickQuery={placeQueryInComposer} />
                  ) : null}

                  {activeChat?.turns.map(turn => (
                    <div key={turn.id} className="space-y-3">
                      <AgentChatUserBubble createdAt={turn.createdAt} text={turn.userQuery} />

                      <div className="flex justify-start">
                        <AgentChatAssistantMessage
                          turn={turn}
                          exporting={exportingTurnId === turn.id}
                          isRunning={isRunning}
                          onOpenArtifact={() => setOpenArtifactTurn(turn)}
                          onExport={() => {
                            const art = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;
                            if (art) void exportArtifact(art, turn.id);
                          }}
                          onRefine={() => {
                            const art = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;
                            if (!art) return;
                            setFollowUpContext({
                              label: truncateTitle(turn.userQuery, 60),
                              sql: art.sql,
                            });
                            focusComposer();
                          }}
                          onPickSuggestion={suggestion => {
                            const art = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;
                            if (art) {
                              setFollowUpContext({
                                label: truncateTitle(turn.userQuery, 60),
                                sql: art.sql,
                              });
                            }
                            placeQueryInComposer(suggestion);
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {pendingTurn ? (
                    <div className="space-y-3">
                      <AgentChatUserBubble createdAt={pendingTurn.createdAt} text={pendingTurn.userQuery} />
                      <AgentChatThinkingPanel
                        steps={STEPPER_STEPS}
                        activeStep={activeStep}
                        statuses={stepStatuses}
                        detail={stepDetail}
                        isRetrying={isRetrying}
                      />
                    </div>
                  ) : null}

                  <AnimatePresence>
                    {phase === 'error' && runnerError ? (
                      <AgentChatErrorAlert
                        message={runnerError}
                        onDismiss={() => {
                          setRunnerError(null);
                          focusComposer();
                        }}
                      />
                    ) : null}
                  </AnimatePresence>

                  <div ref={threadEndRef} />
                </div>
              </div>
            </section>

            <AgentComposer
              query={query}
              onQueryChange={setQuery}
              onSubmit={() => void handleSubmit()}
              onStop={handleStop}
              compact={!showEmptyState}
              disabled={loadingChatId !== null}
              isRunning={isRunning}
              runButtonLabel={isRunning ? 'Выполняю…' : 'Отправить'}
              skipAutoRowLimit={skipAutoRowLimit}
              onSkipAutoRowLimitChange={setSkipAutoRowLimit}
              textareaRef={textareaRef}
              followUpContext={followUpContext ? { label: followUpContext.label } : null}
              onClearFollowUp={() => setFollowUpContext(null)}
            />
          </div>
        </div>

        {AGENT_DEBUG_ENABLED ? (
          <AgentDebugPanel entries={debugEntries} isRunning={isRunning} />
        ) : null}
      </div>

      <AgentChatSidebarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        chats={sidebarChats}
        loading={savedChatsLoading}
        activeChatId={activeChatId}
        loadingChatId={loadingChatId}
        saveState={saveState}
        savedAt={savedAt}
        onSelectChat={chatId => void loadSavedChat(chatId)}
        onNewChat={handleNewChat}
      />

      <AgentArtifactModal
        open={Boolean(openArtifactTurn)}
        turn={openArtifactTurn}
        layoutId={layoutId}
        exporting={openArtifactTurn ? exportingTurnId === openArtifactTurn.id : false}
        onClose={() => setOpenArtifactTurn(null)}
        onExport={() => {
          if (openArtifactTurn?.assistant.kind === 'artifact') {
            void exportArtifact(openArtifactTurn.assistant.artifact, openArtifactTurn.id);
          }
        }}
      />
    </LayoutGroup>
  );
}
