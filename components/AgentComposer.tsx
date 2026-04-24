'use client';

import { ArrowRight, CircleStop, Infinity as InfinityIcon, SlidersHorizontal, WandSparkles, X } from 'lucide-react';
import { useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react';

// Single-source platform detection that plays nicely with SSR + React 19 rules:
// useSyncExternalStore returns the server snapshot (null) during SSR and the
// first client render, then switches to the client snapshot after hydration.
const subscribeNoop = () => () => {};
const getShortcutSnapshot = (): string | null => {
  if (typeof navigator === 'undefined') return null;
  const ua = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
  return /Mac|iPhone|iPad|iPod/.test(ua) ? '⌘ + Enter' : 'Ctrl + Enter';
};
const getShortcutServerSnapshot = (): string | null => null;

interface FollowUpContext {
  label: string;
}

interface AgentComposerProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  compact?: boolean;
  disabled?: boolean;
  isRunning: boolean;
  runButtonLabel: string;
  skipAutoRowLimit: boolean;
  onSkipAutoRowLimitChange: (value: boolean) => void;
  showSkipAutoRowLimit?: boolean;
  placeholder?: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  followUpContext?: FollowUpContext | null;
  onClearFollowUp?: () => void;
}

export default function AgentComposer({
  query,
  onQueryChange,
  onSubmit,
  onStop,
  compact = false,
  disabled,
  isRunning,
  runButtonLabel,
  skipAutoRowLimit,
  onSkipAutoRowLimitChange,
  showSkipAutoRowLimit = true,
  placeholder,
  textareaRef,
  followUpContext,
  onClearFollowUp,
}: AgentComposerProps) {
  // Null on SSR and first client render; real label after hydration.
  const shortcutLabel = useSyncExternalStore(
    subscribeNoop,
    getShortcutSnapshot,
    getShortcutServerSnapshot,
  );

  const panelClass = compact
    ? 'ui-panel rounded-[24px] p-3 sm:p-4'
    : 'ui-panel rounded-[28px] p-4 sm:p-5';
  const iconClass = compact
    ? 'ui-chip-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-xl'
    : 'ui-chip-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl';
  const textareaClass = compact
    ? 'min-h-[56px] w-full resize-none border-none bg-transparent font-headline text-base font-medium leading-7 text-on-surface placeholder:text-outline-variant/75 focus:outline-none focus:ring-0 disabled:opacity-60 md:text-[1.02rem]'
    : 'min-h-[84px] w-full resize-none border-none bg-transparent font-headline text-base font-medium leading-7 text-on-surface placeholder:text-outline-variant/75 focus:outline-none focus:ring-0 disabled:opacity-60 md:text-[1.08rem]';

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmit();
    }
  }

  const sendTooltip = shortcutLabel ? `${runButtonLabel} · ${shortcutLabel}` : runButtonLabel;
  const noLimitTooltip = skipAutoRowLimit
    ? 'Лимит 5 000 строк отключён. Таймаут запроса — до 60 с, Excel — до 4 мин.'
    : 'Убирает лимит 5 000 строк. Таймаут запроса — до 60 с, Excel — до 4 мин.';

  return (
    <section className={panelClass}>
      <div className="flex items-start gap-3">
        <div className={iconClass}>
          <WandSparkles className="h-4 w-4 text-primary" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          {followUpContext && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="ui-chip-accent inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.1} />
                Уточнение артефакта: {followUpContext.label}
                <button
                  type="button"
                  onClick={onClearFollowUp}
                  className="rounded-full p-0.5 text-on-primary-fixed-variant/70 transition-colors hover:bg-primary-fixed hover:text-on-primary-fixed"
                  aria-label="Очистить контекст уточнения"
                >
                  <X className="h-3 w-3" strokeWidth={2.2} />
                </button>
              </span>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={compact ? 1 : 2}
            disabled={disabled || isRunning}
            placeholder={followUpContext
              ? 'Опишите, что именно нужно уточнить в этом артефакте…'
              : placeholder ?? 'Например: сравни премии по регионам за прошлый квартал…'}
            className={textareaClass}
          />

          <div className="mt-2 flex items-center justify-end gap-2">
            {showSkipAutoRowLimit ? (
              <button
                type="button"
                onClick={() => onSkipAutoRowLimitChange(!skipAutoRowLimit)}
                disabled={disabled || isRunning}
                aria-pressed={skipAutoRowLimit}
                title={noLimitTooltip}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  skipAutoRowLimit ? 'ui-chip-accent' : 'ui-chip text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <InfinityIcon className="h-3.5 w-3.5" strokeWidth={2.1} />
                Без лимита
              </button>
            ) : null}

            {isRunning && (
              <button
                type="button"
                onClick={onStop}
                className="ui-button-secondary flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-on-surface active:scale-[0.98]"
              >
                <CircleStop className="h-4 w-4 text-on-surface" strokeWidth={2.1} />
                Остановить
              </button>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={!query.trim() || disabled || isRunning}
              title={sendTooltip}
              aria-label={sendTooltip}
              suppressHydrationWarning
              className="ui-button-primary group flex items-center gap-2 rounded-xl px-4 py-1.5 font-headline text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              <ArrowRight className="h-4 w-4 text-on-primary transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
              {runButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
