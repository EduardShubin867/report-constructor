'use client';

import {
  ArrowUpRight,
  Bot,
  CarFront,
  ChartColumn,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  FileText,
  LoaderCircle,
  MapPinned,
  MessageSquareMore,
  PanelLeft,
  Plus,
  Search,
  Sparkles,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import type { AgentResponse, SSEEvent } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import AgentArtifactCard from '@/components/AgentArtifactCard';
import AgentArtifactModal from '@/components/AgentArtifactModal';
import AgentComposer from '@/components/AgentComposer';
import AgentDebugPanel, { type AgentDebugEntry, type AgentDebugTone } from '@/components/AgentDebugPanel';
import AgentStepper, { type StepStatus } from '@/components/AgentStepper';
import { AGENT_DEBUG_ENABLED, BASE_PATH } from '@/lib/constants';
import type {
  ArtifactPayload,
  SavedChatAssistantMessage,
  SavedChatSession,
  SavedChatSummary,
  SavedChatTurn,
} from '@/lib/report-history-types';

const MAX_RETRIES = 2;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Phase = 'idle' | 'thinking' | 'validating' | 'retrying' | 'self-checking' | 'done' | 'error';
type DebugScope = 'client' | 'phase' | 'tool' | 'result' | 'error' | 'orchestrator' | 'runner' | 'query';

type PendingTurn = {
  id: string;
  createdAt: string;
  userQuery: string;
  targetChatId: string;
};

type FollowUpContext = {
  label: string;
  sql: string;
};

type WelcomeCard = {
  key: string;
  title: string;
  query: string;
  icon: ReactNode;
};

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15 },
};

const welcomeIconProps = { className: 'h-5 w-5', strokeWidth: 1.8 } as const;
const stepIconProps = { className: 'h-4 w-4', strokeWidth: 2 } as const;

const EXAMPLE_QUERIES = [
  {
    icon: <Users {...welcomeIconProps} />,
    title: 'Отчёт по агентам',
    query: 'Количество договоров и сумма премий по каждому агенту за прошлый месяц',
  },
  {
    icon: <ChartColumn {...welcomeIconProps} />,
    title: 'Динамика премий',
    query: 'Динамика премий по месяцам за текущий год',
  },
  {
    icon: <Trophy {...welcomeIconProps} />,
    title: 'Топ агентов',
    query: 'Топ-20 агентов по заработанной марже',
  },
  {
    icon: <FileText {...welcomeIconProps} />,
    title: 'По конкретному ДГ',
    query: 'Данные по 150 ДГ за текущий год',
  },
  {
    icon: <MapPinned {...welcomeIconProps} />,
    title: 'По территориям',
    query: 'Распределение договоров по территориям в Москве',
  },
  {
    icon: <CarFront {...welcomeIconProps} />,
    title: 'КБМ и тарифы',
    query: 'Средний КБМ и тариф в разрезе марок автомобилей',
  },
];

const STEPPER_STEPS = [
  { label: 'Анализ', icon: <Sparkles {...stepIconProps} /> },
  { label: 'Уточнение', icon: <Search {...stepIconProps} /> },
  { label: 'Построение', icon: <MessageSquareMore {...stepIconProps} /> },
  { label: 'Выполнение', icon: <ArrowUpRight {...stepIconProps} /> },
  { label: 'Готово', icon: <CircleCheckBig {...stepIconProps} /> },
];

const POPULAR_QUERY_ICON = <TrendingUp {...welcomeIconProps} />;
const DATA_SKILLS = new Set([
  'lookup_dg',
  'lookup_territory',
  'list_column_values',
  'get_krm_krp_values',
  'read_instruction',
]);

const SKILL_LABELS: Record<string, string> = {
  lookup_dg: 'Поиск ДГ',
  lookup_territory: 'Поиск территории',
  list_column_values: 'Просмотр значений',
  get_krm_krp_values: 'Загрузка КРМ/КРП',
  validate_query: 'Проверка запроса',
  read_instruction: 'Чтение инструкции',
};

const SKILL_DETAILS: Record<string, (args: Record<string, unknown>) => string> = {
  lookup_dg: args => `Ищу ДГ${args.query ? `: ${String(args.query).slice(0, 40)}` : ''}`,
  lookup_territory: args => `Ищу территорию${(args.search ?? args.query) ? `: ${String(args.search ?? args.query).slice(0, 40)}` : ''}`,
  list_column_values: args => `Просматриваю значения${args.column ? ` «${args.column}»` : ''}`,
  get_krm_krp_values: () => 'Загружаю справочники КРМ/КРП',
  validate_query: () => 'Проверяю корректность запроса',
  read_instruction: args => `Читаю инструкцию${args.name ? `: ${args.name}` : ''}`,
};

function truncateTitle(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildStepStatuses(activeIndex: number): StepStatus[] {
  return STEPPER_STEPS.map((_, index) => {
    if (index < activeIndex) return 'done';
    if (index === activeIndex) return 'active';
    return 'pending';
  });
}

function formatReportTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatClockTime(value: string): string {
  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function formatTurnCount(count: number): string {
  return `${count} ${pluralize(count, 'сообщение', 'сообщения', 'сообщений')}`;
}

function formatRecordCount(count: number): string {
  return `${count.toLocaleString('ru-RU')} ${pluralize(count, 'запись', 'записи', 'записей')}`;
}

function looksLikeDiagnosticExplanation(text: string): boolean {
  return /(ошибк|не удалось|невозможно|несуществующ|не найден|не найдены|связана с|в таблице используются значения|поле\s+[«"][^«"]+[»"]|колонк\w+|данные\s+за\s+прошл\w+\s+\w+\s+отсутствуют|нет\s+договоров)/i.test(text);
}

function normalizeSuccessfulExplanation(explanation: string, rowCount: number): string {
  const trimmed = explanation.trim();
  if (!trimmed) {
    return `Отчёт сформирован. В выборке ${formatRecordCount(rowCount)}.`;
  }
  if (!looksLikeDiagnosticExplanation(trimmed)) {
    return trimmed;
  }
  return `Отчёт сформирован. В выборке ${formatRecordCount(rowCount)}.`;
}

function isRecoverableSqlSchemaError(text: string): boolean {
  return /(invalid column name|invalid object name|ambiguous column name|multi-part identifier .* could not be bound|неверное имя столбца|неверное имя объекта|не удалось привязать multipart identifier|ошибка валидации: недопустимые таблицы)/i.test(text);
}

function phaseDebugMessage(phase: string, retryCount: number): string {
  if (phase === 'thinking') {
    return retryCount > 0 ? 'Агент начал повторный анализ запроса' : 'Агент начал анализ запроса';
  }
  if (phase === 'finalizing') {
    return retryCount > 0 ? 'Агент собирает исправленный SQL' : 'Агент формирует финальный SQL';
  }
  return `Фаза: ${phase}`;
}

function debugToneFromLevel(level?: string): AgentDebugTone {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  return 'info';
}

function buildOptimisticChat(
  current: SavedChatSession | null,
  chatId: string,
  turn: SavedChatTurn,
): SavedChatSession {
  if (!current || current.id !== chatId) {
    return {
      id: chatId,
      firstQuery: turn.userQuery,
      latestQuery: turn.userQuery,
      turnCount: 1,
      createdAt: turn.createdAt,
      updatedAt: turn.createdAt,
      turns: [turn],
    };
  }

  return {
    ...current,
    latestQuery: turn.userQuery,
    turnCount: current.turns.length + 1,
    updatedAt: turn.createdAt,
    turns: [...current.turns, turn],
  };
}

export default function AgentChatWorkspace() {
  const [query, setQuery] = useState('');
  const [skipAutoRowLimit, setSkipAutoRowLimit] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() => buildStepStatuses(0));
  const [stepDetail, setStepDetail] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [popularItems, setPopularItems] = useState<{ query: string; count: number }[]>([]);
  const [debugEntries, setDebugEntries] = useState<AgentDebugEntry[]>([]);
  const [savedChats, setSavedChats] = useState<SavedChatSummary[]>([]);
  const [savedChatsLoading, setSavedChatsLoading] = useState(true);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<SavedChatSession | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
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
    ? 'Задавайте вопросы в свободной форме. Ответ приходит как сообщение или артефакт с таблицей.'
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
    setStepStatuses(buildStepStatuses(0));
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
    setStepStatuses(buildStepStatuses(step));
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

    const agentData = await callAgent(text, prevSql, retry, signal, retryError, unlimitedRows);

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
        return runAttempt(text, agentData.sql, retry + 1, signal, retryHint, unlimitedRows);
      }
      throw new Error(executionError);
    }

    if (queryData.rowCount === 0 && retry < MAX_RETRIES) {
      setPhase('self-checking');
      appendDebugEntry('query', 'SQL отработал, но вернул 0 строк. Запускаю самокоррекцию', 'warn', {
        retry: retry + 1,
      });
      return runAttempt(
        text,
        agentData.sql,
        retry + 1,
        signal,
        'EMPTY: Запрос выполнился успешно, но вернул 0 строк. Вероятно, условия WHERE слишком жёсткие или значения фильтров неверны (неправильный код ДГ, формат даты, регистр). Если запрос связан с городом, территорией или территориальным регионом, проверь значения через lookup_territory и попробуй фильтрацию через JOIN с [dbo].[Территории] вместо прямого фильтра по основной таблице.',
        unlimitedRows,
      );
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

    try {
      const assistant = await runAttempt(
        trimmedQuery,
        queryContext?.sql,
        0,
        controller.signal,
        undefined,
        skipAutoRowLimit,
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

  function renderAssistant(turn: SavedChatTurn) {
    const artifact = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;

    return (
      <div className={artifact ? 'w-full max-w-none space-y-3' : 'max-w-[46rem] space-y-3'}>
        {artifact ? (
          <AgentArtifactCard
            artifact={artifact}
            summary={turn.assistant.text}
            exporting={exportingTurnId === turn.id}
            layoutId={`artifact-${turn.id}`}
            onOpen={() => setOpenArtifactTurn(turn)}
            onExport={() => void exportArtifact(artifact, turn.id)}
            onRefine={() => {
              setFollowUpContext({
                label: truncateTitle(turn.userQuery, 60),
                sql: artifact.sql,
              });
              focusComposer();
            }}
          />
        ) : (
          <div className="ui-panel max-w-[46rem] rounded-[28px] px-5 py-4 text-sm leading-6 text-on-surface">
            <div className="mb-2 flex items-center gap-2">
              <span className="ui-chip-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                <Bot className="h-3.5 w-3.5" strokeWidth={2.1} />
                Ответ
              </span>
            </div>
            <p>{turn.assistant.text}</p>
          </div>
        )}

        {turn.assistant.suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.08em] text-on-surface-variant/70">
              Дальше
            </span>
            {turn.assistant.suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  if (artifact) {
                    setFollowUpContext({
                      label: truncateTitle(turn.userQuery, 60),
                      sql: artifact.sql,
                    });
                  }
                  placeQueryInComposer(suggestion);
                }}
                disabled={isRunning}
                className="ui-chip-accent max-w-xs truncate rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-primary-fixed disabled:opacity-50"
                title={suggestion}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

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
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
            >
              <PanelLeft className="h-4 w-4 text-primary" strokeWidth={2.1} />
              Чаты
            </button>

            <button
              type="button"
              onClick={handleNewChat}
              className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4 text-primary" strokeWidth={2.1} />
              Новый чат
            </button>
          </div>

          <section className="ui-panel overflow-hidden rounded-[32px] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <div className="border-b border-outline-variant/10 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ui-chip inline-flex rounded-full px-3 py-1 text-[11px] font-medium tracking-wide">
                      AI-аналитик
                    </span>
                    {!showEmptyState ? (
                      <span className="text-xs text-on-surface-variant/80">
                        Активный диалог
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-1.5 max-w-5xl text-pretty font-headline text-[1.4rem] font-bold tracking-tight text-on-surface sm:text-[1.7rem]">
                    {chatHeading}
                  </h1>
                  <p className="mt-1 max-w-4xl text-xs leading-5 text-on-surface-variant sm:text-sm sm:leading-6">
                    {chatSubheading}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeChat ? (
                    <>
                      <span className="ui-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
                        <Clock3 className="h-3.5 w-3.5" strokeWidth={2.1} />
                        {formatTurnCount(activeChat.turnCount)}
                      </span>
                      <SaveStateBadge state={saveState} savedAt={savedAt} />
                    </>
                  ) : (
                    <span className="ui-chip inline-flex rounded-full px-3 py-1.5 text-xs">
                      Новый чат
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-h-[24rem] flex-col px-4 py-3 sm:px-5 lg:min-h-0 lg:flex-1 lg:px-6">
              <div className="flex-1 space-y-5 overflow-y-auto pr-1 lg:min-h-0">
                {showEmptyState ? (
                  <motion.div {...fadeSlide} className="flex flex-col justify-center gap-4 py-1">
                    <div className="max-w-2xl">
                      <span className="ui-chip-accent inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.1} />
                        Начните диалог
                      </span>
                      <h2 className="mt-3 font-headline text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                        Спросите про отчёт, аналитику или просто получите ответ
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                        Чат сохранит историю вопросов, а результативные ответы придут как артефакты, которые можно развернуть на весь экран.
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-on-surface-variant/70">
                        Популярные запросы
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                        {welcomeCards.map(card => (
                          <button
                            key={card.key}
                            type="button"
                            onClick={() => placeQueryInComposer(card.query)}
                            className="ui-panel group flex flex-col items-start gap-2 rounded-2xl p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-outline-variant/30 hover:bg-white"
                          >
                            <div className="ui-chip-accent flex h-8 w-8 items-center justify-center rounded-xl transition-colors group-hover:bg-primary-fixed">
                              {card.icon}
                            </div>
                            <div>
                              <p className="font-headline text-sm font-semibold text-on-surface">{card.title}</p>
                              <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-on-surface-variant sm:line-clamp-2">{card.query}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : null}

                {activeChat?.turns.map(turn => (
                  <div key={turn.id} className="space-y-3">
                    <div className="flex justify-end">
                      <div className="max-w-[min(84%,54rem)] rounded-[24px] bg-primary px-5 py-4 text-sm leading-6 text-on-primary shadow-[0_14px_28px_rgba(52,92,150,0.18)]">
                        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-on-primary/80">
                          <span>Вы</span>
                          <span>{formatClockTime(turn.createdAt)}</span>
                        </div>
                        <p>{turn.userQuery}</p>
                      </div>
                    </div>

                    <div className="flex justify-start">
                      {renderAssistant(turn)}
                    </div>
                  </div>
                ))}

                {pendingTurn ? (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <div className="max-w-[min(84%,54rem)] rounded-[24px] bg-primary px-5 py-4 text-sm leading-6 text-on-primary shadow-[0_14px_28px_rgba(52,92,150,0.18)]">
                        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-on-primary/80">
                          <span>Вы</span>
                          <span>{formatClockTime(pendingTurn.createdAt)}</span>
                        </div>
                        <p>{pendingTurn.userQuery}</p>
                      </div>
                    </div>

                    <div className="flex justify-start">
                      <div className="ui-panel w-full max-w-none rounded-[28px] px-5 py-4 sm:px-6">
                        <div className="mb-4 flex items-center gap-2">
                          <span className="ui-chip-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={2.1} />
                            Ассистент думает
                          </span>
                        </div>
                        <AgentStepper
                          steps={STEPPER_STEPS}
                          activeStep={activeStep}
                          statuses={stepStatuses}
                          detail={stepDetail}
                          isRetrying={isRetrying}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <AnimatePresence>
                  {phase === 'error' && runnerError ? (
                    <motion.div {...fade}>
                      <div className="rounded-2xl border border-error/20 bg-error-container/40 px-4 py-3 text-sm text-error">
                        <div className="flex items-start gap-2">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.1} />
                          <div>
                            <p>{runnerError}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setRunnerError(null);
                                focusComposer();
                              }}
                              className="mt-2 text-xs font-semibold underline-offset-2 hover:underline"
                            >
                              Вернуться к чату
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
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

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-[65] bg-slate-950/35 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full w-[min(22rem,calc(100%-1.5rem))] p-3"
              onClick={event => event.stopPropagation()}
            >
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
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

function ChatSidebar({
  chats,
  loading,
  activeChatId,
  loadingChatId,
  saveState,
  savedAt,
  onSelect,
  onCreate,
}: {
  chats: SavedChatSummary[];
  loading: boolean;
  activeChatId: string | null;
  loadingChatId: string | null;
  saveState: SaveState;
  savedAt: string | null;
  onSelect: (chatId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="ui-panel flex h-full min-h-[32rem] flex-col overflow-hidden rounded-[30px] p-4 sm:p-5 lg:min-h-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-on-surface">Последние чаты</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            История сохраняется отдельно для каждого пользователя
          </p>
        </div>
        <SaveStateBadge state={saveState} savedAt={savedAt} compact />
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="ui-button-primary mb-4 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
      >
        <Plus className="h-4 w-4 text-on-primary" strokeWidth={2.1} />
        Новый чат
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading && chats.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Загружаю чаты…</p>
        ) : chats.length === 0 ? (
          <div className="ui-panel-muted rounded-2xl border border-dashed border-outline-variant/25 p-5 text-sm text-on-surface-variant">
            Пока нет сохранённых чатов. Начните новый диалог, и он появится здесь.
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map(chat => {
              const isActive = chat.id === activeChatId;
              const isBusy = chat.id === loadingChatId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelect(chat.id)}
                  disabled={isBusy}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive
                      ? 'border-primary bg-primary text-on-primary shadow-[0_10px_26px_rgba(52,92,150,0.18)]'
                      : 'border-outline-variant/20 bg-white/70 text-on-surface hover:border-outline-variant/35 hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {chat.firstQuery}
                      </p>
                      <p className={`mt-1 truncate text-xs ${isActive ? 'text-on-primary/85' : 'text-on-surface-variant'}`}>
                        {chat.latestQuery}
                      </p>
                    </div>
                    {isBusy ? (
                      <LoaderCircle className={`mt-0.5 h-4 w-4 shrink-0 animate-spin ${isActive ? 'text-on-primary' : 'text-primary'}`} strokeWidth={2.1} />
                    ) : null}
                  </div>

                  <div className={`mt-2 flex items-center gap-2 text-[11px] ${isActive ? 'text-on-primary/80' : 'text-on-surface-variant/80'}`}>
                    <span>{formatTurnCount(chat.turnCount)}</span>
                    <span>·</span>
                    <span>{formatReportTime(chat.updatedAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveStateBadge({
  state,
  savedAt,
  compact = false,
}: {
  state: SaveState;
  savedAt: string | null;
  compact?: boolean;
}) {
  if (state === 'idle') return null;

  const className = compact
    ? 'rounded-full px-2.5 py-1 text-[10px] font-medium'
    : 'rounded-full px-2.5 py-1 text-[11px] font-medium';

  if (state === 'saving') {
    return (
      <span className={`${className} border border-primary/15 bg-primary-fixed/70 text-primary`}>
        Сохраняю…
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className={`${className} border border-error/20 bg-error-container/50 text-error`}>
        Не сохранено
      </span>
    );
  }

  return (
    <span
      className={`${className} border border-emerald-500/20 bg-emerald-500/10 text-emerald-700`}
      title={savedAt ? `Сохранено ${formatReportTime(savedAt)}` : 'Сохранено'}
    >
      {savedAt ? `Сохранено · ${formatClockTime(savedAt)}` : 'Сохранено'}
    </span>
  );
}
