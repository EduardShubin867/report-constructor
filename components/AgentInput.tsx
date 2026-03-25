'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentResponse } from '@/app/api/agent/route';
import type { QueryResult } from '@/app/api/query/route';
import SqlHighlight from './SqlHighlight';
import { BASE_PATH } from '@/lib/constants';

const MAX_RETRIES = 2;

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
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const [skillRounds, setSkillRounds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRunning = phase === 'thinking' || phase === 'validating' || phase === 'retrying' || phase === 'self-checking';
  const isIterating = !!lastSql && phase === 'done';

  async function _run(text: string, prevSql: string | undefined, retryCount: number, retryError?: string): Promise<void> {
    setPhase(retryCount > 0 ? 'retrying' : 'thinking');
    if (retryCount > 0) setRetryInfo(
      retryError?.startsWith('EMPTY:')
        ? `Запрос вернул 0 строк — корректирую (${retryCount}/${MAX_RETRIES})…`
        : `Исправляю ошибку (${retryCount}/${MAX_RETRIES})…`
    );

    const agentRes = await fetch(`${BASE_PATH}/api/agent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, previousSql: prevSql, retryError }),
    });
    const agentData: AgentResponse & { error?: string } = await agentRes.json();
    if (!agentRes.ok) throw new Error(agentData.error ?? 'Ошибка AI-сервиса');

    setLastSql(agentData.sql);
    setExplanation(agentData.explanation);
    setSuggestions(agentData.suggestions ?? []);
    setSkillRounds(agentData._skillRounds ?? 0);

    setPhase('validating');
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

    setRetryInfo(null);
    setPhase('done');
    onResult({ ...queryData, sql: agentData.sql, explanation: agentData.explanation, skillRounds: agentData._skillRounds }, text);
  }

  async function runQuery(text: string, prevSql?: string) {
    if (!text.trim() || isRunning || disabled) return;
    setError(null);
    setRetryInfo(null);

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
  const reset = () => { setPhase('idle'); setError(null); setRetryInfo(null); };

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

        {/* Progress bar */}
        <AnimatePresence>
          {isRunning && (
            <motion.div {...fade} className="mt-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ProgressSteps phase={phase} retryInfo={retryInfo} />
              </div>
              <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${phase === 'retrying' || phase === 'self-checking' ? 'bg-amber-500' : 'bg-purple-500'}`}
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

/* ───────────────── Progress steps ───────────────────────────────── */
function ProgressSteps({ phase, retryInfo }: { phase: Phase; retryInfo: string | null }) {
  const steps: { key: Phase; label: string }[] = [
    { key: 'thinking', label: 'Генерация SQL' },
    { key: 'validating', label: 'Проверка и выполнение' },
  ];

  if (phase === 'self-checking') {
    steps.push({ key: 'self-checking', label: retryInfo ?? 'Самопроверка результата' });
  } else if (phase === 'retrying') {
    steps.push({ key: 'retrying', label: retryInfo ?? 'Исправление' });
  }

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => {
        const isDone = steps.findIndex(s => s.key === phase) > i;
        const isActive = step.key === phase;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && <div className="w-4 h-px bg-gray-300" />}
            <div className="flex items-center gap-1">
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold
                ${isDone ? 'bg-emerald-500 text-white' : isActive ? ((phase === 'retrying' || phase === 'self-checking') ? 'bg-amber-500 text-white animate-pulse' : 'bg-purple-500 text-white animate-pulse') : 'bg-gray-200 text-gray-400'}`}>
                {isDone ? '✓' : ''}
              </div>
              <span className={`${isDone ? 'text-emerald-600' : isActive ? ((phase === 'retrying' || phase === 'self-checking') ? 'text-amber-600 font-medium' : 'text-purple-600 font-medium') : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
