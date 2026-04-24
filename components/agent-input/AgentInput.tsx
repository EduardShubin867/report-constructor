'use client';

import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleStop,
  FlaskConical,
  History,
  LoaderCircle,
  MessageSquareMore,
  RefreshCw,
  SlidersHorizontal,
  WandSparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SqlHighlight from '../SqlHighlight';
import AgentDebugPanel from '../AgentDebugPanel';
import AgentStepper from '../AgentStepper';
import { AGENT_DEBUG_ENABLED } from '@/lib/constants';
import { fade } from './animation';
import { STEPPER_STEPS } from './stepper-steps';
import type { AgentInputProps } from './types';
import { useAgentInput } from './useAgentInput';

export default function AgentInput(props: AgentInputProps) {
  const {
    phase,
    lastSql,
    explanation,
    suggestions,
    skillRounds,
    error,
    activeStep,
    stepStatuses,
    stepDetail,
    isRetrying,
    query,        setQuery,
    showSql,      setShowSql,
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
  } = useAgentInput(props);

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
                    disabled={isRunning || props.disabled}
                    className="min-h-[84px] w-full resize-none border-none bg-transparent font-headline text-lg font-medium leading-8 text-on-surface placeholder:text-outline-variant/75 focus:outline-none focus:ring-0 disabled:opacity-60 md:text-[1.15rem]"
                  />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <label className="flex cursor-pointer items-start gap-2 text-xs text-on-surface-variant sm:max-w-[min(100%,20rem)]">
                        <input
                          type="checkbox"
                          checked={skipAutoRowLimit}
                          onChange={e => setSkipAutoRowLimit(e.target.checked)}
                          disabled={isRunning || props.disabled}
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
                          disabled={!query.trim() || isRunning || props.disabled}
                          className="ui-button-secondary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <SlidersHorizontal className="h-4 w-4 text-primary" strokeWidth={2.1} />
                          Уточнить текущий
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!query.trim() || isRunning || props.disabled}
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

      <AnimatePresence>
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

              {lastSql && (
                <div className="border-t border-outline-variant/10 px-3 py-1.5">
                  <button type="button" onClick={() => setShowSql(s => !s)}
                    className="ui-button-ghost rounded-md px-2 py-1 text-[11px]">
                    {showSql ? 'Скрыть SQL' : 'SQL'}
                  </button>
                  <AnimatePresence>
                    {showSql && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                        className="overflow-hidden mt-2"
                      >
                        <SqlHighlight sql={lastSql} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

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
