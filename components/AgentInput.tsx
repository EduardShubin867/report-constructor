'use client';

import {
  ArrowRight,
  Braces,
  CarFront,
  ChartColumn,
  Check,
  CircleAlert,
  CircleCheckBig,
  CircleStop,
  FileText,
  FlaskConical,
  History,
  LoaderCircle,
  MapPinned,
  MessageSquareMore,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo, type ReactNode, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentResponse, SSEEvent } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import SqlHighlight from './SqlHighlight';
import AgentDebugPanel, { type AgentDebugEntry, type AgentDebugTone } from './AgentDebugPanel';
import AgentStepper, { type StepStatus } from './AgentStepper';
import { AGENT_DEBUG_ENABLED, BASE_PATH } from '@/lib/constants';

const MAX_RETRIES = 2;

/* Human-readable labels for agent skills */
const SKILL_LABELS: Record<string, string> = {
  lookup_dg: 'Поиск ДГ',
  lookup_territory: 'Поиск территории',
  list_column_values: 'Просмотр значений',
  get_krm_krp_values: 'Загрузка КРМ/КРП',
  validate_query: 'Проверка запроса',
  read_instruction: 'Чтение инструкции',
};

/* Detail messages for skills (user-friendly) */
const SKILL_DETAILS: Record<string, (args: Record<string, unknown>) => string> = {
  lookup_dg: (a) => `Ищу ДГ${a.query ? `: ${String(a.query).slice(0, 40)}` : ''}`,
  lookup_territory: (a) => `Ищу территорию${(a.search ?? a.query) ? `: ${String(a.search ?? a.query).slice(0, 40)}` : ''}`,
  list_column_values: (a) => `Просматриваю значения${a.column ? ` «${a.column}»` : ''}`,
  get_krm_krp_values: () => 'Загружаю справочники КРМ/КРП',
  validate_query: () => 'Проверяю корректность запроса',
  read_instruction: (a) => `Читаю инструкцию${a.name ? `: ${a.name}` : ''}`,
};

export interface AgentQueryResult extends QueryResult {
  sql: string;
  explanation: string;
  skillRounds?: number;
  /** Matches request: validator did not inject TOP/LIMIT. */
  skipAutoRowLimit?: boolean;
}

export type AgentResultMode = 'replace' | 'append';

interface AgentInputProps {
  onResult: (result: AgentQueryResult, queryText: string, mode: AgentResultMode) => void;
  disabled?: boolean;
  activeVersion?: {
    id: string;
    query: string;
    result: AgentQueryResult;
  } | null;
}

type Phase = 'idle' | 'thinking' | 'validating' | 'retrying' | 'self-checking' | 'done' | 'error';
type DebugScope = 'client' | 'phase' | 'tool' | 'result' | 'error' | 'orchestrator' | 'runner' | 'query';

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.15 } };
const welcomeIconProps = { className: 'h-5 w-5', strokeWidth: 1.8 } as const;
const stepIconProps = { className: 'h-4 w-4', strokeWidth: 2 } as const;

/* ── Example queries for welcome screen ────────────────────────── */
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

const POPULAR_QUERY_ICON = <TrendingUp {...welcomeIconProps} />;

function truncateWelcomeTitle(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type WelcomeCard = { key: string; title: string; query: string; icon: ReactNode };

/* ── Stepper step definitions ──────────────────────────────────── */
const STEPPER_STEPS = [
  {
    label: 'Анализ',
    icon: <Sparkles {...stepIconProps} />,
  },
  {
    label: 'Уточнение',
    icon: <Search {...stepIconProps} />,
  },
  {
    label: 'Построение',
    icon: <Braces {...stepIconProps} />,
  },
  {
    label: 'Выполнение',
    icon: <Zap {...stepIconProps} />,
  },
  {
    label: 'Готово',
    icon: <CircleCheckBig {...stepIconProps} />,
  },
];

/* Skills that map to step 1 (Уточнение) — i.e. data gathering tools */
const DATA_SKILLS = new Set(['lookup_dg', 'lookup_territory', 'list_column_values', 'get_krm_krp_values', 'read_instruction']);

const BUILD_STEP_INDEX = 2;
const EXECUTION_STEP_INDEX = 3;
const FINAL_STEP_INDEX = STEPPER_STEPS.length - 1;

function buildStepStatuses(activeIndex: number): StepStatus[] {
  return STEPPER_STEPS.map((_, idx) => {
    if (idx < activeIndex) return 'done';
    if (idx === activeIndex) return 'active';
    return 'pending';
  });
}

function looksLikeDiagnosticExplanation(text: string): boolean {
  return /(ошибк|не удалось|невозможно|несуществующ|не найден|не найдены|связана с|в таблице используются значения|поле\s+[«"][^«"]+[»"]|колонк\w+|данные\s+за\s+прошл\w+\s+\w+\s+отсутствуют|нет\s+договоров)/i.test(text);
}

function formatRecordCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count.toLocaleString('ru-RU')} запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count.toLocaleString('ru-RU')} записи`;
  }
  return `${count.toLocaleString('ru-RU')} записей`;
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

function debugToneFromLevel(level?: string): AgentDebugTone {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  return 'info';
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

export default function AgentInput({ onResult, disabled, activeVersion = null }: AgentInputProps) {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSql, setLastSql] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSql, setShowSql] = useState(false);
  const [skillRounds, setSkillRounds] = useState(0);
  const [skipAutoRowLimit, setSkipAutoRowLimit] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeRunControllerRef = useRef<AbortController | null>(null);

  /* ── Stepper state ─────────────────────────────────────────────── */
  const [activeStep, setActiveStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() => buildStepStatuses(0));
  const [stepDetail, setStepDetail] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [popularItems, setPopularItems] = useState<{ query: string; count: number }[]>([]);
  const [debugEntries, setDebugEntries] = useState<AgentDebugEntry[]>([]);
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
      activeRunControllerRef.current?.abort();
    };
  }, []);

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

  const isRunning = phase === 'thinking' || phase === 'validating' || phase === 'retrying' || phase === 'self-checking';
  const isIterating = !!lastSql && phase === 'done';

  useEffect(() => {
    if (!activeVersion || isRunning) return;
    const nextSql = activeVersion.result.sql || null;
    const nextExplanation = activeVersion.result.explanation || null;
    const shouldSync = phase !== 'done'
      || nextSql !== lastSql
      || nextExplanation !== explanation;

    if (!shouldSync) return;

    setLastSql(nextSql);
    setExplanation(nextExplanation);
    setSuggestions([]);
    setSkillRounds(activeVersion.result.skillRounds ?? 0);
    setError(null);
    setPhase('done');
    setIsRetrying(false);
    setActiveStep(FINAL_STEP_INDEX);
    setStepStatuses(buildStepStatuses(FINAL_STEP_INDEX));
    setStepDetail('');
    setShowSql(false);
  }, [
    activeVersion,
    explanation,
    isRunning,
    lastSql,
    phase,
  ]);

  function setStepperState(nextStep: number, detailText: string) {
    setActiveStep(nextStep);
    setStepStatuses(buildStepStatuses(nextStep));
    setStepDetail(detailText);
  }

  function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  function appendDebugEntry(
    scope: DebugScope,
    message: string,
    tone: AgentDebugTone = 'info',
    data?: unknown,
  ) {
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
  }

  function resetDebugEntries() {
    if (!AGENT_DEBUG_ENABLED) return;
    runStartedAtRef.current = Date.now();
    debugSeqRef.current = 0;
    setDebugEntries([]);
  }

  /** Read SSE stream from /api/agent and return the AgentResponse */
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
      retryCount > 0 ? `Открываю новый SSE-запрос для ретрая ${retryCount}/${MAX_RETRIES}` : 'Открываю SSE-запрос к агенту',
      'info',
      {
        mode: prevSql ? 'follow-up' : 'fresh',
        skipAutoRowLimit: skipLimit,
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
        ...(skipLimit ? { skipAutoRowLimit: true } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error ?? `HTTP ${res.status}`);
    }

    appendDebugEntry('client', 'SSE-соединение установлено', 'success', {
      status: res.status,
    });

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
            appendDebugEntry('phase', phaseDebugMessage(event.phase, retryCount), 'info', {
              phase: event.phase,
            });
            if (event.phase === 'thinking') {
              if (retryCount === 0) {
                setPhase('thinking');
                setStepperState(0, 'Анализирую ваш запрос…');
              }
            } else if (event.phase === 'finalizing') {
              setStepperState(
                BUILD_STEP_INDEX,
                retryCount > 0 ? 'Собираю исправленный SQL-запрос…' : 'Формирую SQL-запрос…',
              );
            }
            break;
          case 'skill': {
            const skillName = event.name;
            const args = event.args as Record<string, unknown>;
            appendDebugEntry(
              'tool',
              `Вызов инструмента ${SKILL_LABELS[skillName] ?? skillName}`,
              'info',
              {
                skill: skillName,
                args,
              },
            );

            if (DATA_SKILLS.has(skillName)) {
              const detailFn = SKILL_DETAILS[skillName];
              setStepperState(1, detailFn ? detailFn(args) : SKILL_LABELS[skillName] ?? skillName);
            } else if (skillName === 'validate_query') {
              setStepperState(BUILD_STEP_INDEX, 'Проверяю корректность запроса…');
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
      setPhase('retrying');
      setIsRetrying(true);
      const retryLabel = retryError?.startsWith('EMPTY:')
        ? `Запрос вернул 0 строк — корректирую (${retry}/${MAX_RETRIES})`
        : `Исправляю ошибку (${retry}/${MAX_RETRIES})`;
      setStepperState(BUILD_STEP_INDEX, retryLabel);
      appendDebugEntry('client', retryLabel, 'warn', {
        retry,
        retryError,
      });
    } else {
      setPhase('thinking');
      setIsRetrying(false);
      setStepperState(0, 'Анализирую ваш запрос…');
      appendDebugEntry('client', 'Стартую новый прогон агента', 'info', {
        mode: resultMode,
        hasPreviousSql: Boolean(prevSql),
      });
    }

    const agentData = await _callAgent(text, prevSql, retry, signal, retryError, skipLimit);

    setLastSql(agentData.sql || null);
    setSuggestions(agentData.suggestions ?? []);
    setSkillRounds(agentData._skillRounds ?? 0);

    // Agent couldn't build SQL — show explanation only
    if (!agentData.sql) {
      appendDebugEntry('result', 'Агент завершил ответ без SQL', 'warn', {
        explanation: agentData.explanation,
        suggestions: agentData.suggestions,
      });
      setIsRetrying(false);
      setExplanation(agentData.explanation);
      setStepperState(FINAL_STEP_INDEX, '');
      setPhase('done');
      return;
    }

    // Step 3: executing SQL
    setPhase('validating');
    setStepperState(EXECUTION_STEP_INDEX, 'Выполняю запрос к базе данных…');
    appendDebugEntry('query', 'Отправляю SQL на выполнение', 'info', {
      skipAutoRowLimit: skipLimit,
      sqlLength: agentData.sql.length,
      sqlPreview: agentData.sql,
    });

    const queryRes = await fetch(`${BASE_PATH}/api/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: agentData.sql,
        ...(skipLimit ? { skipAutoRowLimit: true } : {}),
      }),
      signal,
    });
    const queryData: QueryResult & { error?: string } = await queryRes.json();

    if (!queryRes.ok) {
      const execError = queryData.error ?? 'Ошибка выполнения запроса';
      const forceRetry = isRecoverableSqlSchemaError(execError);
      appendDebugEntry('query', `SQL выполнился с ошибкой: ${execError}`, 'error', {
        retry,
        canRetry: agentData.canRetry !== false || forceRetry,
        forceRetry,
      });
      if (retry < MAX_RETRIES && (agentData.canRetry !== false || forceRetry)) {
        const retryHint = forceRetry
          ? `${execError}\n\nПодсказка: если ошибка связана с городом, территорией или территориальным регионом, попробуй lookup_territory и фильтрацию через LEFT JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID] вместо прямого обращения к колонке основной таблицы.`
          : execError;
        return _run(text, agentData.sql, retry + 1, signal, resultMode, retryHint, skipLimit);
      }
      throw new Error(execError);
    }

    // Self-validation: 0 rows → retry
    if (queryData.rowCount === 0 && retry < MAX_RETRIES) {
      setPhase('self-checking');
      appendDebugEntry('query', 'SQL отработал, но вернул 0 строк. Запускаю самокоррекцию', 'warn', {
        retry: retry + 1,
      });
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

    // Step 4: done
    appendDebugEntry('query', 'SQL успешно выполнен', 'success', {
      rowCount: queryData.rowCount,
      columns: queryData.columns?.length ?? 0,
    });
    const finalExplanation = queryData.rowCount > 0
      ? normalizeSuccessfulExplanation(agentData.explanation, queryData.rowCount)
      : agentData.explanation;
    setIsRetrying(false);
    setExplanation(finalExplanation);
    setStepperState(FINAL_STEP_INDEX, '');
    setPhase('done');
    onResult({
      ...queryData,
      sql: agentData.sql,
      explanation: finalExplanation,
      skillRounds: agentData._skillRounds,
      ...(skipLimit ? { skipAutoRowLimit: true } : {}),
    }, text, resultMode);
  }

  async function runQuery(text: string, prevSql?: string, resultMode: AgentResultMode = 'replace') {
    if (!text.trim() || isRunning || disabled) return;
    const controller = new AbortController();
    activeRunControllerRef.current = controller;
    resetDebugEntries();
    setError(null);
    setStepperState(0, 'Анализирую ваш запрос…');

    appendDebugEntry('client', 'Подготавливаю запуск свободного запроса', 'info', {
      query: text,
      mode: resultMode,
      hasPreviousSql: Boolean(prevSql),
      skipAutoRowLimit,
    });

    if (!prevSql) {
      setLastSql(null);
      setExplanation(null);
      setSuggestions([]);
    }

    try {
      await _run(text, prevSql, 0, controller.signal, resultMode, undefined, skipAutoRowLimit);
    }
    catch (e) {
      if (isAbortError(e)) {
        appendDebugEntry('client', 'Запрос остановлен пользователем', 'warn');
        setPhase('idle');
        setIsRetrying(false);
        setError(null);
        setActiveStep(0);
        setStepStatuses(buildStepStatuses(0));
        setStepDetail('');
        return;
      }
      appendDebugEntry('error', e instanceof Error ? e.message : 'Неизвестная ошибка', 'error');
      setIsRetrying(false);
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      if (activeRunControllerRef.current === controller) {
        activeRunControllerRef.current = null;
      }
    }
  }

  const handleSubmit = () => runQuery(query, undefined, 'replace');
  const handleRefineCurrent = () => {
    if (!lastSql) return;
    runQuery(query, lastSql, 'append');
  };
  /** Подставить текст в поле без автозапуска — пользователь жмёт «Анализировать» или Ctrl/⌘+Enter */
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
  const handleSuggestion = (s: string) => placeQueryInInput(s);
  const handleExample = (q: string) => placeQueryInInput(q);
  const handleStop = () => {
    appendDebugEntry('client', 'Пользователь остановил выполнение', 'warn');
    activeRunControllerRef.current?.abort();
  };
  const reset = () => {
    activeRunControllerRef.current?.abort();
    activeRunControllerRef.current = null;
    setPhase('idle');
    setError(null);
    setIsRetrying(false);
    setActiveStep(0);
    setStepStatuses(buildStepStatuses(0));
    setStepDetail('');
  };
  const showWelcome = !lastSql && phase === 'idle' && !query.trim();

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={AGENT_DEBUG_ENABLED ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start' : ''}>
        <div className="flex min-w-0 flex-col gap-6">
          <section className="relative">
            <div
              className={`ui-panel rounded-[28px] p-5 transition-all duration-300 sm:p-6 ${
                isIterating ? 'border-primary/25' : ''
              }`}
            >
              <AnimatePresence>
                {isIterating && (
                  <motion.div
                    {...fade}
                    className="ui-chip-accent mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
                  >
                    <RefreshCw className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.1} />
                    <span>Текущий отчёт можно уточнить отдельной кнопкой, а обычный запуск создаст новый отчёт</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-start gap-3">
                <WandSparkles className="mt-1 h-[1.35rem] w-[1.35rem] shrink-0 text-primary/75" strokeWidth={2.1} />
                <div className="min-w-0 flex-1">
                  <textarea
                    ref={textareaRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isIterating
                      ? 'Новый вопрос или уточнение текущего отчёта: колонка, группировка, фильтры…'
                      : 'Например: сравни премии по регионам за прошлый квартал…'}
                    rows={2}
                    disabled={isRunning || disabled}
                    className="min-h-[84px] w-full resize-none border-none bg-transparent font-headline text-lg font-medium leading-8 text-on-surface placeholder:text-outline-variant/75 focus:outline-none focus:ring-0 disabled:opacity-60 md:text-[1.15rem]"
                  />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <label className="flex cursor-pointer items-start gap-2 text-xs text-on-surface-variant sm:max-w-[min(100%,20rem)]">
                        <input
                          type="checkbox"
                          checked={skipAutoRowLimit}
                          onChange={e => setSkipAutoRowLimit(e.target.checked)}
                          disabled={isRunning || disabled}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-outline-variant text-primary focus:ring-primary"
                        />
                        <span>
                          Без лимита 5&nbsp;000 строк
                          <span className="mt-0.5 block font-normal text-on-surface-variant/80">
                            Больше строк; таймаут выполнения увеличен в 4 раза (до 60&nbsp;с для запроса, до 4&nbsp;мин для Excel)
                          </span>
                        </span>
                      </label>
                      <span className="ui-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium">
                        <History className="h-3.5 w-3.5" strokeWidth={2.1} />
                        Ctrl/⌘ + Enter — запуск
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 self-start sm:flex-row sm:items-center sm:self-auto">
                      {isRunning && (
                        <button
                          type="button"
                          onClick={handleStop}
                          className="ui-button-secondary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface active:scale-[0.98]"
                        >
                          <CircleStop className="h-4 w-4 text-on-surface" strokeWidth={2.1} />
                          Остановить
                        </button>
                      )}
                      {isIterating && (
                        <button
                          type="button"
                          onClick={handleRefineCurrent}
                          disabled={!query.trim() || isRunning || disabled}
                          className="ui-button-secondary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <SlidersHorizontal className="h-4 w-4 text-primary" strokeWidth={2.1} />
                          Уточнить текущий
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!query.trim() || isRunning || disabled}
                        className="ui-button-primary group flex items-center gap-2 rounded-xl px-6 py-2.5 font-headline text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                      >
                        {isRunning ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-on-primary transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
                        )}
                        {isRunning
                          ? (phase === 'retrying' ? 'Исправляю…' : phase === 'self-checking' ? 'Проверяю…' : phase === 'thinking' ? 'Генерирую…' : 'Выполняю…')
                          : isIterating ? 'Новый запрос' : 'Анализировать'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <AnimatePresence>
            {isRunning && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="ui-panel-muted overflow-hidden rounded-3xl p-5 sm:p-6"
              >
                <AgentStepper
                  steps={STEPPER_STEPS}
                  activeStep={activeStep}
                  statuses={stepStatuses}
                  detail={stepDetail}
                  isRetrying={isRetrying}
                />
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showWelcome && (
              <motion.div {...fade}>
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.12em] text-on-surface-variant/70">
                  Или выберите готовый пример ниже
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {welcomeCards.map(ex => (
                    <button
                      key={ex.key}
                      type="button"
                      onClick={() => handleExample(ex.query)}
                      disabled={isRunning}
                      className="ui-panel group flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-outline-variant/30 hover:bg-white disabled:opacity-50"
                    >
                      <div className="ui-chip-accent flex h-9 w-9 items-center justify-center rounded-xl transition-colors group-hover:bg-primary-fixed">
                        {ex.icon}
                      </div>
                      <div>
                        <p className="font-headline text-sm font-semibold text-on-surface">{ex.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-on-surface-variant">{ex.query}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {AGENT_DEBUG_ENABLED && (
          <AgentDebugPanel entries={debugEntries} isRunning={isRunning} />
        )}
      </div>

      {/* ── Status / result cards ──────────────────────────────────── */}
      <AnimatePresence>
        {/* Error */}
        {phase === 'error' && error && (
          <motion.div {...fade}
            className="flex items-center justify-between rounded-xl border border-error/30 bg-error-container/50 px-4 py-3 text-sm text-error">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.1} />
              {error}
            </div>
            <button type="button" onClick={reset} className="shrink-0 text-xs font-semibold text-error underline-offset-2 hover:underline">
              Повторить
            </button>
          </motion.div>
        )}

        {/* Success / Agent message */}
        {phase === 'done' && explanation && (
          <motion.div {...fade} className="flex flex-col gap-2">
            <div className="ui-panel overflow-hidden rounded-xl">
              <div className={`flex items-start gap-3 px-4 py-3 ${lastSql ? 'bg-emerald-500/8' : 'bg-tertiary-fixed/22'}`}>
                {lastSql ? (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.6} />
                  </div>
                ) : (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed/50">
                    <MessageSquareMore className="h-3.5 w-3.5 text-tertiary" strokeWidth={2} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-6 ${lastSql ? 'text-emerald-900' : 'text-on-tertiary-fixed-variant'}`}>
                    {explanation}
                  </p>
                  {lastSql && skillRounds > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700/80">
                      <FlaskConical className="h-3 w-3" strokeWidth={2.2} />
                      Использовано справочников: {skillRounds}
                    </p>
                  )}
                </div>
              </div>

              {/* SQL toggle */}
              {lastSql && (
                <div className="border-t border-outline-variant/10 px-3 py-1.5">
                  <button type="button" onClick={() => setShowSql(s => !s)}
                    className="ui-button-ghost rounded-md px-2 py-1 text-[11px]">
                    {showSql ? 'Скрыть SQL' : 'SQL'}
                  </button>
                  <AnimatePresence>
                    {showSql && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                        className="overflow-hidden mt-2">
                        <SqlHighlight sql={lastSql} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* ── Suggestions — next steps ─────────────────────────── */}
            {suggestions.length > 0 && (
              <motion.div {...fade} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 self-center text-[11px] font-medium uppercase tracking-[0.08em] text-on-surface-variant/70">
                  Дальше
                </span>
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => handleSuggestion(s)} disabled={isRunning}
                    title={s}
                    className="ui-chip-accent max-w-xs truncate rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-primary-fixed disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
