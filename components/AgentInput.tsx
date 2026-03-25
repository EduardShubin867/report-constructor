'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentResponse, SSEEvent } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import SqlHighlight from './SqlHighlight';
import { BASE_PATH } from '@/lib/constants';

const MAX_RETRIES = 2;

/* Human-readable labels for agent skills */
const SKILL_LABELS: Record<string, string> = {
  lookup_dg: 'Поиск ДГ',
  lookup_territory: 'Поиск территории',
  list_column_values: 'Просмотр значений колонки',
  get_krm_krp_values: 'Загрузка КРМ/КРП',
  validate_query: 'Проверка запроса',
  read_instruction: 'Чтение инструкции',
};

interface ActivityEntry {
  id: number;
  label: string;
  detail?: string;
  status: 'active' | 'done';
}

const EXAMPLE_QUERIES = [
  'Количество договоров и сумма премий по каждому агенту за прошлый месяц',
  'Динамика премий по месяцам за текущий год',
  'Топ-20 агентов по заработанной марже',
  'Данные по 150 ДГ за текущий год',
  'Распределение договоров по территориям в Москве',
  'Средний КБМ и тариф в разрезе марок автомобилей',
];

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

export default function AgentInput({ onResult, disabled }: AgentInputProps) {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSql, setLastSql] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSql, setShowSql] = useState(false);
  const [skillRounds, setSkillRounds] = useState(0);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const activityIdRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      // Non-streaming error (e.g. 400/500 before stream starts)
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

      // Parse SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep incomplete line in buffer

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
              const id = ++activityIdRef.current;
              setActivityLog(prev => {
                const updated = prev.map(e => e.status === 'active' ? { ...e, status: 'done' as const } : e);
                return [...updated, { id, label: 'Анализ запроса', status: 'active' }];
              });
            } else if (event.phase === 'finalizing') {
              const id = ++activityIdRef.current;
              setActivityLog(prev => {
                const updated = prev.map(e => e.status === 'active' ? { ...e, status: 'done' as const } : e);
                return [...updated, { id, label: 'Формирование ответа', status: 'active' }];
              });
            }
            break;
          case 'skill': {
            const id = ++activityIdRef.current;
            const label = SKILL_LABELS[event.name] ?? event.name;
            // Extract a short detail from args
            const argVals = Object.values(event.args);
            const detail = argVals.length > 0 ? String(argVals[0]).slice(0, 60) : undefined;
            setActivityLog(prev => {
              const updated = prev.map(e => e.status === 'active' ? { ...e, status: 'done' as const } : e);
              return [...updated, { id, label, detail, status: 'active' }];
            });
            break;
          }
          case 'result':
            result = event.data;
            setActivityLog(prev => prev.map(e => e.status === 'active' ? { ...e, status: 'done' as const } : e));
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

  async function _run(text: string, prevSql: string | undefined, retryCount: number, retryError?: string): Promise<void> {
    if (retryCount > 0) {
      setPhase('retrying');
      const retryLabel = retryError?.startsWith('EMPTY:')
        ? `Запрос вернул 0 строк — корректирую (${retryCount}/${MAX_RETRIES})`
        : `Исправляю ошибку (${retryCount}/${MAX_RETRIES})`;

      const id = ++activityIdRef.current;
      setActivityLog(prev => {
        const updated = prev.map(e => e.status === 'active' ? { ...e, status: 'done' as const } : e);
        return [...updated, { id, label: retryLabel, status: 'active' }];
      });
    } else {
      setPhase('thinking');
    }

    const agentData = await _callAgent(text, prevSql, retryError);

    setLastSql(agentData.sql);
    setExplanation(agentData.explanation);
    setSuggestions(agentData.suggestions ?? []);
    setSkillRounds(agentData._skillRounds ?? 0);

    setPhase('validating');
    {
      const id = ++activityIdRef.current;
      setActivityLog(prev => {
        const updated = prev.map(e => e.status === 'active' ? { ...e, status: 'done' as const } : e);
        return [...updated, { id, label: 'Выполнение запроса', status: 'active' }];
      });
    }
    const queryRes = await fetch(`${BASE_PATH}/api/query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: agentData.sql }),
    });
    const queryData: QueryResult & { error?: string } = await queryRes.json();

    if (!queryRes.ok) {
      const execError = queryData.error ?? 'Ошибка выполнения запроса';
      if (retryCount < MAX_RETRIES && agentData.canRetry !== false) {
        return _run(text, agentData.sql, retryCount + 1, execError);
      }
      throw new Error(execError);
    }

    // Self-validation: if query returned 0 rows, ask agent to fix it
    if (queryData.rowCount === 0 && retryCount < MAX_RETRIES) {
      setPhase('self-checking');
      return _run(
        text,
        agentData.sql,
        retryCount + 1,
        'EMPTY: Запрос выполнился успешно, но вернул 0 строк. Вероятно, условия WHERE слишком жёсткие или значения фильтров неверны (неправильный код ДГ, формат даты, регистр). Проверь значения через скиллы и исправь запрос.',
      );
    }


    setActivityLog(prev => prev.map(e => e.status === 'active' ? { ...e, status: 'done' as const } : e));
    setPhase('done');
    onResult({ ...queryData, sql: agentData.sql, explanation: agentData.explanation, skillRounds: agentData._skillRounds }, text);
  }

  async function runQuery(text: string, prevSql?: string) {
    if (!text.trim() || isRunning || disabled) return;
    setError(null);

    setActivityLog([]);
    activityIdRef.current = 0;

    // Don't reset explanation/sql if we're iterating — feels smoother
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
  const reset = () => { setPhase('idle'); setError(null); setActivityLog([]); };

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

        {/* Examples (only before first result) */}
        <AnimatePresence>
          {!lastSql && phase === 'idle' && (
            <motion.div {...fade} className="flex flex-wrap gap-1.5 mt-3">
              {EXAMPLE_QUERIES.map(q => (
                <button key={q} type="button"
                  onClick={() => { setQuery(q); textareaRef.current?.focus(); }}
                  disabled={isRunning}
                  className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50 truncate max-w-sm">
                  {q}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live activity log */}
        <AnimatePresence>
          {isRunning && activityLog.length > 0 && (
            <motion.div {...fade} className="mt-3 flex flex-col gap-1">
              {activityLog.map(entry => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 text-xs"
                >
                  {entry.status === 'active' ? (
                    <svg className="w-3 h-3 shrink-0 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className={entry.status === 'active' ? 'text-purple-700 font-medium' : 'text-gray-400'}>
                    {entry.label}
                  </span>
                  {entry.detail && (
                    <span className="text-gray-300 truncate max-w-[200px]">{entry.detail}</span>
                  )}
                </motion.div>
              ))}
              {/* Progress bar */}
              <div className="mt-1 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${phase === 'retrying' || phase === 'self-checking' ? 'bg-amber-400' : 'bg-purple-400'}`}
                  initial={{ width: '0%' }}
                  animate={{ width: phase === 'thinking' ? '40%' : phase === 'validating' ? '75%' : phase === 'self-checking' ? '85%' : '90%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

        {/* Success */}
        {phase === 'done' && explanation && (
          <motion.div {...fade} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Explanation */}
            <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50/60 border-b border-emerald-100">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-emerald-800 leading-relaxed">{explanation}</p>
                {skillRounds > 0 && (
                  <p className="mt-1 text-xs text-emerald-600/70 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Использовано справочников: {skillRounds}
                  </p>
                )}
              </div>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 mb-2">Продолжить работу с текущим отчётом:</p>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map(s => (
                    <button key={s} type="button" onClick={() => handleSuggestion(s)} disabled={isRunning}
                      title={s}
                      className="text-left text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 hover:bg-purple-100 transition-colors disabled:opacity-50">
                      <span className="text-purple-400 mr-1">+</span> {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SQL (subtle) */}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

