'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentResponse, SSEEvent } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import SqlHighlight from './SqlHighlight';
import AgentStepper from './AgentStepper';
import { BASE_PATH } from '@/lib/constants';

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
  lookup_territory: (a) => `Ищу территорию${a.query ? `: ${String(a.query).slice(0, 40)}` : ''}`,
  list_column_values: (a) => `Просматриваю значения${a.column ? ` «${a.column}»` : ''}`,
  get_krm_krp_values: () => 'Загружаю справочники КРМ/КРП',
  validate_query: () => 'Проверяю корректность запроса',
  read_instruction: (a) => `Читаю инструкцию${a.name ? `: ${a.name}` : ''}`,
};

export interface AgentQueryResult extends QueryResult {
  sql: string;
  explanation: string;
  skillRounds?: number;
}

interface AgentInputProps {
  onResult: (result: AgentQueryResult, queryText: string) => void;
  disabled?: boolean;
}

type Phase = 'idle' | 'thinking' | 'validating' | 'retrying' | 'self-checking' | 'done' | 'error';

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.15 } };

/* ── Example queries for welcome screen ────────────────────────── */
const EXAMPLE_QUERIES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-1.997M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: 'Отчёт по агентам',
    query: 'Количество договоров и сумма премий по каждому агенту за прошлый месяц',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Динамика премий',
    query: 'Динамика премий по месяцам за текущий год',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" />
      </svg>
    ),
    title: 'Топ агентов',
    query: 'Топ-20 агентов по заработанной марже',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: 'По конкретному ДГ',
    query: 'Данные по 150 ДГ за текущий год',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    title: 'По территориям',
    query: 'Распределение договоров по территориям в Москве',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-3m0 0V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125" />
      </svg>
    ),
    title: 'КБМ и тарифы',
    query: 'Средний КБМ и тариф в разрезе марок автомобилей',
  },
];

/* ── Stepper step definitions ──────────────────────────────────── */
const STEPPER_STEPS = [
  {
    label: 'Анализ',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    label: 'Уточнение',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    label: 'Построение',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    label: 'Выполнение',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    label: 'Готово',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/* Skills that map to step 1 (Уточнение) — i.e. data gathering tools */
const DATA_SKILLS = new Set(['lookup_dg', 'lookup_territory', 'list_column_values', 'get_krm_krp_values', 'read_instruction']);

export default function AgentInput({ onResult, disabled }: AgentInputProps) {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSql, setLastSql] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSql, setShowSql] = useState(false);
  const [skillRounds, setSkillRounds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Stepper state ─────────────────────────────────────────────── */
  const [activeStep, setActiveStep] = useState(0);
  const [stepDetail, setStepDetail] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hadDataSkills, setHadDataSkills] = useState(false);

  const isRunning = phase === 'thinking' || phase === 'validating' || phase === 'retrying' || phase === 'self-checking';
  const isIterating = !!lastSql && phase === 'done';

  /** Read SSE stream from /api/agent and return the AgentResponse */
  async function _callAgent(text: string, prevSql: string | undefined, retryError?: string): Promise<AgentResponse> {
    const res = await fetch(`${BASE_PATH}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, previousSql: prevSql, retryError }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error ?? `HTTP ${res.status}`);
    }

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
            if (event.phase === 'thinking') {
              setPhase('thinking');
              setActiveStep(0);
              setStepDetail('Анализирую ваш запрос…');
            } else if (event.phase === 'finalizing') {
              setActiveStep(2);
              setStepDetail('Формирую SQL-запрос…');
            }
            break;
          case 'skill': {
            const skillName = event.name;
            const args = event.args as Record<string, unknown>;

            if (DATA_SKILLS.has(skillName)) {
              setHadDataSkills(true);
              setActiveStep(1);
              const detailFn = SKILL_DETAILS[skillName];
              setStepDetail(detailFn ? detailFn(args) : SKILL_LABELS[skillName] ?? skillName);
            } else if (skillName === 'validate_query') {
              setActiveStep(2);
              setStepDetail('Проверяю корректность запроса…');
            }
            break;
          }
          case 'result':
            result = event.data as unknown as AgentResponse;
            break;
          case 'error':
            streamError = event.error;
            break;
        }
      }
    }

    if (streamError) throw new Error(streamError);
    if (!result) throw new Error('Стрим завершился без результата');
    return result;
  }

  async function _run(text: string, prevSql: string | undefined, retry: number, retryError?: string): Promise<void> {
    if (retry > 0) {
      setPhase('retrying');
      setIsRetrying(true);
      setRetryCount(retry);
      setActiveStep(0);
      const retryLabel = retryError?.startsWith('EMPTY:')
        ? `Запрос вернул 0 строк — корректирую (${retry}/${MAX_RETRIES})`
        : `Исправляю ошибку (${retry}/${MAX_RETRIES})`;
      setStepDetail(retryLabel);
    } else {
      setPhase('thinking');
      setIsRetrying(false);
      setRetryCount(0);
    }

    const agentData = await _callAgent(text, prevSql, retryError);

    setLastSql(agentData.sql || null);
    setExplanation(agentData.explanation);
    setSuggestions(agentData.suggestions ?? []);
    setSkillRounds(agentData._skillRounds ?? 0);

    // Agent couldn't build SQL — show explanation only
    if (!agentData.sql) {
      setActiveStep(4);
      setStepDetail('');
      setPhase('done');
      return;
    }

    // Step 3: executing SQL
    setPhase('validating');
    setActiveStep(3);
    setStepDetail('Выполняю запрос к базе данных…');

    const queryRes = await fetch(`${BASE_PATH}/api/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: agentData.sql }),
    });
    const queryData: QueryResult & { error?: string } = await queryRes.json();

    if (!queryRes.ok) {
      const execError = queryData.error ?? 'Ошибка выполнения запроса';
      if (retry < MAX_RETRIES && agentData.canRetry !== false) {
        return _run(text, agentData.sql, retry + 1, execError);
      }
      throw new Error(execError);
    }

    // Self-validation: 0 rows → retry
    if (queryData.rowCount === 0 && retry < MAX_RETRIES) {
      setPhase('self-checking');
      return _run(
        text,
        agentData.sql,
        retry + 1,
        'EMPTY: Запрос выполнился успешно, но вернул 0 строк. Вероятно, условия WHERE слишком жёсткие или значения фильтров неверны (неправильный код ДГ, формат даты, регистр). Проверь значения через скиллы и исправь запрос.',
      );
    }

    // Step 4: done
    setActiveStep(4);
    setStepDetail('');
    setPhase('done');
    onResult({ ...queryData, sql: agentData.sql, explanation: agentData.explanation, skillRounds: agentData._skillRounds }, text);
  }

  async function runQuery(text: string, prevSql?: string) {
    if (!text.trim() || isRunning || disabled) return;
    setError(null);
    setHadDataSkills(false);
    setActiveStep(0);
    setStepDetail('Анализирую ваш запрос…');

    if (!prevSql) {
      setLastSql(null);
      setExplanation(null);
      setSuggestions([]);
    }

    try { await _run(text, prevSql, 0); }
    catch (e) { setPhase('error'); setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
  }

  const handleSubmit = () => runQuery(query, lastSql ?? undefined);
  const handleSuggestion = (s: string) => { setQuery(s); runQuery(s, lastSql ?? undefined); };
  const handleExample = (q: string) => { setQuery(q); runQuery(q); };
  const reset = () => { setPhase('idle'); setError(null); setActiveStep(0); setStepDetail(''); };
  const showWelcome = !lastSql && phase === 'idle';

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Input card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {/* Iteration badge */}
        <AnimatePresence>
          {isIterating && (
            <motion.div {...fade}
              className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-700">
              <svg className="w-3.5 h-3.5 shrink-0 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Режим уточнения — ваш запрос создаст новую версию отчёта</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea + button */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isIterating
              ? 'Уточните отчёт: добавь колонку, измени группировку, отфильтруй по…'
              : 'Опишите нужный отчёт на естественном языке…'}
            rows={2}
            disabled={isRunning || disabled}
            className="w-full px-4 py-3 pr-28 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white resize-none disabled:opacity-60 transition-all"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!query.trim() || isRunning || disabled}
            className="absolute right-2 bottom-2 flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {isRunning
              ? (phase === 'retrying' ? 'Исправляю…' : phase === 'self-checking' ? 'Проверяю…' : phase === 'thinking' ? 'Генерирую…' : 'Выполняю…')
              : isIterating ? 'Уточнить' : 'Анализировать'}
            {!isRunning && <span className="text-purple-300 text-[10px] ml-0.5">⌘↵</span>}
          </button>
        </div>

        {/* ── Stepper (while running) ──────────────────────────────── */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <AgentStepper
                steps={STEPPER_STEPS}
                activeStep={activeStep}
                detail={stepDetail}
                isRetrying={isRetrying}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Welcome: example cards ─────────────────────────────────── */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div {...fade}>
            <div className="text-center mb-5 mt-2">
              <h2 className="text-base font-semibold text-gray-800">Что вы хотите узнать?</h2>
              <p className="text-sm text-gray-400 mt-1">Выберите пример или опишите запрос своими словами</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {EXAMPLE_QUERIES.map(ex => (
                <button
                  key={ex.title}
                  type="button"
                  onClick={() => handleExample(ex.query)}
                  disabled={isRunning}
                  className="group flex flex-col items-start gap-2 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md hover:shadow-purple-100/50 transition-all duration-200 text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                    {ex.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-purple-700 transition-colors">{ex.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{ex.query}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status / result cards ──────────────────────────────────── */}
      <AnimatePresence>
        {/* Error */}
        {phase === 'error' && error && (
          <motion.div {...fade}
            className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
            <button type="button" onClick={reset} className="text-xs font-medium text-red-600 hover:text-red-800 underline-offset-2 hover:underline shrink-0">
              Повторить
            </button>
          </motion.div>
        )}

        {/* Success / Agent message */}
        {phase === 'done' && explanation && (
          <motion.div {...fade} className="flex flex-col gap-3">
            {/* ── Explanation card ─────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className={`flex items-start gap-3 px-4 py-3 ${lastSql ? 'bg-emerald-50/60' : 'bg-amber-50/60'}`}>
                {lastSql ? (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <p className={`text-sm leading-relaxed ${lastSql ? 'text-emerald-800' : 'text-amber-900'}`}>
                    {explanation}
                  </p>
                  {lastSql && skillRounds > 0 && (
                    <p className="mt-1.5 text-xs text-emerald-600/70 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      Использовано справочников: {skillRounds}
                    </p>
                  )}
                </div>
              </div>

              {/* SQL toggle */}
              {lastSql && (
                <div className="px-4 py-2 border-t border-gray-100">
                  <button type="button" onClick={() => setShowSql(s => !s)}
                    className="text-[11px] text-gray-400 hover:text-gray-500 transition-colors">
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
              <motion.div {...fade} className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-400 self-center mr-1">Продолжить:</span>
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => handleSuggestion(s)} disabled={isRunning}
                    title={s}
                    className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1.5 hover:bg-purple-100 transition-colors disabled:opacity-50 truncate max-w-xs">
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
