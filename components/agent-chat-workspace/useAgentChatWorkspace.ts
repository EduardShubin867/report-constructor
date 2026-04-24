import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ModelMessage } from 'ai';
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
  generateId,
  truncateTitle,
} from '@/components/agent-chat/utils';
import {
  EXAMPLE_QUERIES,
  OSAGO_AGENT_EXAMPLE_QUERIES,
  POPULAR_QUERY_ICON,
  STEPPER_STEP_COUNT,
} from '@/components/agent-chat/welcome-and-stepper';
import { getLatestAnalysisContextFromTurns } from '@/lib/analysis-context';
import { AGENT_DEBUG_ENABLED, BASE_PATH } from '@/lib/constants';
import type {
  ArtifactPayload,
  ChatMode,
  SavedChatSession,
  SavedChatSummary,
  SavedChatTurn,
} from '@/lib/report-history-types';
import type { StepStatus } from '@/components/AgentStepper';
import type { AgentDebugEntry, AgentDebugTone } from '@/components/AgentDebugPanel';
import { runConstructorAttempt, runOsagoAgentStream } from './agent-runners';
import { exportChatArtifact, persistChatTurn } from './persistence';

export function useAgentChatWorkspace() {
  const [query, setQuery] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('constructor');
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
  const isOsagoAgentMode = chatMode === 'osago-agent';

  const welcomeCards = useMemo((): WelcomeCard[] => {
    if (isOsagoAgentMode) {
      return OSAGO_AGENT_EXAMPLE_QUERIES.map(item => ({
        key: `osago-${item.title}`,
        title: item.title,
        query: item.query,
        icon: item.icon,
      }));
    }

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
  }, [isOsagoAgentMode, popularItems]);

  const sidebarChats = useMemo(() => {
    if (!activeChat) return savedChats;
    const optimisticSummary: SavedChatSummary = {
      id: activeChat.id,
      mode: chatMode,
      firstQuery: activeChat.firstQuery,
      latestQuery: activeChat.latestQuery,
      turnCount: activeChat.turnCount,
      createdAt: activeChat.createdAt,
      updatedAt: activeChat.updatedAt,
    };
    const others = savedChats.filter(chat => chat.id !== optimisticSummary.id);
    return [optimisticSummary, ...others].slice(0, 6);
  }, [activeChat, chatMode, savedChats]);

  const showEmptyState = !activeChat?.turns.length && !pendingTurn;
  const activeChatId = activeChat?.id ?? currentChatIdRef.current;
  const chatHeading = showEmptyState
    ? isOsagoAgentMode ? 'ОСАГО-агент' : 'Чат'
    : truncateTitle(activeChat?.firstQuery ?? pendingTurn?.userQuery ?? 'Новый чат', 92);
  const chatSubheading = showEmptyState
    ? null
    : isOsagoAgentMode
      ? 'История вопросов к ОСАГО-агенту сохраняется отдельно от обычного AI-аналитика.'
      : 'История вопросов и артефактов сохраняется автоматически внутри текущего диалога.';

  const layoutId = openArtifactTurn ? `artifact-${openArtifactTurn.id}` : null;

  useEffect(() => {
    if (isOsagoAgentMode) {
      setPopularItems([]);
      return;
    }

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
  }, [isOsagoAgentMode]);

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
      const res = await fetch(`${BASE_PATH}/api/report-history?mode=${chatMode}&limit=6`);
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
            const chatRes = await fetch(`${BASE_PATH}/api/report-history/${firstId}?mode=${chatMode}`);
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
  }, [applySavedChat, chatMode]);

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
      const res = await fetch(`${BASE_PATH}/api/report-history/${chatId}?mode=${chatMode}`);
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
  }, [applySavedChat, chatMode, stopActiveRun]);

  const handleNewChat = useCallback(() => {
    stopActiveRun();
    didHydrateInitialHistoryRef.current = true;
    loadRequestSeqRef.current += 1;
    bumpActiveChatToken();
    currentChatIdRef.current = null;
    setActiveChat(null);
    setPendingTurn(null);
    setFollowUpContext(null);
    setSkipAutoRowLimit(false);
    setQuery('');
    setSaveState('idle');
    setSavedAt(null);
    setDrawerOpen(false);
    setOpenArtifactTurn(null);
    setExportingTurnId(null);
    resetRunnerUi();
  }, [bumpActiveChatToken, resetRunnerUi, stopActiveRun]);

  const handleChatModeChange = useCallback((nextMode: ChatMode) => {
    if (nextMode === chatMode) return;

    stopActiveRun();
    didHydrateInitialHistoryRef.current = false;
    loadRequestSeqRef.current += 1;
    bumpActiveChatToken();
    currentChatIdRef.current = null;
    setChatMode(nextMode);
    setSavedChats([]);
    setSavedChatsLoading(true);
    setActiveChat(null);
    setPendingTurn(null);
    setFollowUpContext(null);
    setQuery('');
    setSaveState('idle');
    setSavedAt(null);
    setDrawerOpen(false);
    setOpenArtifactTurn(null);
    setExportingTurnId(null);
    resetDebugEntries();
    resetRunnerUi();
  }, [bumpActiveChatToken, chatMode, resetDebugEntries, resetRunnerUi, stopActiveRun]);

  const exportArtifact = useCallback((artifact: ArtifactPayload, turnId: string) => {
    void exportChatArtifact({
      basePath: BASE_PATH,
      artifact,
      turnId,
      setExportingTurnId,
      setRunnerError,
    });
  }, []);

  const onPersistTurn = useCallback(
    (chatId: string, turn: SavedChatTurn, chatToken: number) => {
      void persistChatTurn({
        basePath: BASE_PATH,
        chatId,
        mode: chatMode,
        turn,
        chatToken,
        activeChatTokenRef,
        currentChatIdRef,
        setSavedChats,
        setActiveChat,
        setSaveState,
        setSavedAt,
      });
    },
    [chatMode],
  );

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

  const handleSubmit = useCallback(async () => {
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

    const queryContext = isOsagoAgentMode ? null : followUpContext;
    setFollowUpContext(null);

    const history: ModelMessage[] = isOsagoAgentMode
      ? []
      : (activeChat?.turns ?? []).flatMap(turn => {
          const assistantContent = turn.assistant.kind === 'artifact'
            ? JSON.stringify({
                sql: turn.assistant.artifact.sql,
                explanation: turn.assistant.text,
                suggestions: turn.assistant.suggestions ?? [],
                analysisContext: turn.assistant.analysisContext,
              })
            : JSON.stringify({
                sql: '',
                explanation: turn.assistant.text,
                suggestions: turn.assistant.suggestions ?? [],
                analysisContext: turn.assistant.analysisContext,
              });
          return [
            { role: 'user' as const, content: turn.userQuery },
            { role: 'assistant' as const, content: assistantContent },
          ];
        });

    const analysisContext = isOsagoAgentMode
      ? undefined
      : getLatestAnalysisContextFromTurns(activeChat?.turns);

    const runnerCtx = {
      appendDebug: (
        scope: DebugScope,
        message: string,
        tone: 'info' | 'success' | 'warn' | 'error' = 'info',
        data?: unknown,
      ) => {
        appendDebugEntry(scope, message, tone, data);
      },
      setPhase,
      setStepper: setStepperState,
      setIsRetrying,
    };

    try {
      const assistant = isOsagoAgentMode
        ? await runOsagoAgentStream(trimmedQuery, targetChatId, controller.signal, runnerCtx)
        : await runConstructorAttempt(
            trimmedQuery,
            queryContext?.sql,
            0,
            controller.signal,
            undefined,
            skipAutoRowLimit,
            targetChatId,
            history,
            analysisContext,
            false,
            runnerCtx,
          );

      const localTurn: SavedChatTurn = {
        id: `local-${Date.now()}`,
        createdAt,
        userQuery: trimmedQuery,
        assistant,
      };

      setPendingTurn(null);
      setActiveChat(current => buildOptimisticChat(current, targetChatId, localTurn, chatMode));
      const chatToken = activeChatTokenRef.current;
      onPersistTurn(targetChatId, localTurn, chatToken);
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
  }, [
    query,
    isRunning,
    isOsagoAgentMode,
    followUpContext,
    activeChat?.turns,
    skipAutoRowLimit,
    chatMode,
    appendDebugEntry,
    resetDebugEntries,
    resetRunnerUi,
    onPersistTurn,
    setPhase,
    setStepperState,
    setIsRetrying,
  ]);

  const handleStop = useCallback(() => {
    appendDebugEntry('client', 'Пользователь остановил выполнение', 'warn');
    stopActiveRun(pendingTurn?.userQuery ?? query);
  }, [appendDebugEntry, pendingTurn?.userQuery, query, stopActiveRun]);

  const handleExportOpenArtifact = useCallback(() => {
    if (openArtifactTurn?.assistant.kind === 'artifact') {
      exportArtifact(openArtifactTurn.assistant.artifact, openArtifactTurn.id);
    }
  }, [exportArtifact, openArtifactTurn]);

  const closeArtifactModal = useCallback(() => {
    setOpenArtifactTurn(null);
  }, []);

  return {
    layoutId,
    query,
    setQuery,
    chatMode,
    skipAutoRowLimit,
    setSkipAutoRowLimit,
    phase,
    runnerError,
    setRunnerError,
    activeStep,
    stepStatuses,
    stepDetail,
    isRetrying,
    isRunning,
    isOsagoAgentMode,
    debugEntries,
    savedChatsLoading,
    loadingChatId,
    activeChat,
    saveState,
    savedAt,
    pendingTurn,
    followUpContext,
    setFollowUpContext,
    drawerOpen,
    setDrawerOpen,
    exportingTurnId,
    openArtifactTurn,
    setOpenArtifactTurn,
    textareaRef,
    threadEndRef,
    welcomeCards,
    sidebarChats,
    showEmptyState,
    activeChatId,
    chatHeading,
    chatSubheading,
    onLoadSavedChat: loadSavedChat,
    onNewChat: handleNewChat,
    onChatModeChange: handleChatModeChange,
    onSubmit: handleSubmit,
    onStop: handleStop,
    placeQueryInComposer,
    focusComposer,
    exportArtifact,
    onCloseArtifactModal: closeArtifactModal,
    onExportOpenArtifact: handleExportOpenArtifact,
  };
}

export type AgentChatWorkspaceViewModel = ReturnType<typeof useAgentChatWorkspace>;
