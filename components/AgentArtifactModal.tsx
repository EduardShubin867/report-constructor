'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileSpreadsheet, Rows3, Sparkles, X } from 'lucide-react';
import SqlHighlight from '@/components/SqlHighlight';
import MarkdownText from '@/components/agent-chat/MarkdownText';
import UnifiedReportTable from '@/components/unified-report-table';
import { resolveAiColumnHeader } from '@/lib/column-header';
import type { SavedChatTurn } from '@/lib/report-history-types';

interface AgentArtifactModalProps {
  open: boolean;
  turn: SavedChatTurn | null;
  layoutId: string | null;
  exporting: boolean;
  onClose: () => void;
  onExport: () => void;
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function formatRows(count: number): string {
  return `${count.toLocaleString('ru-RU')} ${pluralize(count, 'строка', 'строки', 'строк')}`;
}

function formatColumns(count: number): string {
  return `${count} ${pluralize(count, 'колонка', 'колонки', 'колонок')}`;
}

export default function AgentArtifactModal({
  open,
  turn,
  layoutId,
  exporting,
  onClose,
  onExport,
}: AgentArtifactModalProps) {
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);

  const showSql = turn ? expandedTurnId === turn.id : false;

  const handleClose = useCallback(() => {
    setExpandedTurnId(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleClose]);

  const artifact = turn?.assistant.kind === 'artifact' ? turn.assistant.artifact : null;

  return (
    <AnimatePresence>
      {open && turn && artifact && layoutId ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-md sm:px-6 sm:py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            layoutId={layoutId}
            className="relative flex h-full w-full max-w-none flex-col overflow-hidden rounded-[32px] border border-outline-variant/20 bg-background/95 shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(52,92,150,0.2),transparent_58%),radial-gradient(circle_at_top_left,rgba(225,229,111,0.14),transparent_44%)]" />

            <header className="relative border-b border-outline-variant/10 bg-[linear-gradient(135deg,rgba(225,235,251,0.9),rgba(255,255,255,0.92))] px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="ui-chip-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={2.1} />
                      Артефакт
                    </span>
                    {artifact.skipAutoRowLimit ? (
                      <span className="ui-chip-accent inline-flex rounded-full px-3 py-1.5 text-xs">
                        Без лимита 5&nbsp;000
                      </span>
                    ) : null}
                  </div>

                  <h2 className="font-headline text-2xl font-semibold text-on-surface">
                    {turn.userQuery}
                  </h2>
                  <div className="mt-2 max-w-4xl text-sm text-on-surface-variant">
                    <MarkdownText text={turn.assistant.text} renderImages={false} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/65 bg-white/70 px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/70">
                        Выборка
                      </p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-on-surface">
                        <Rows3 className="h-4 w-4 text-primary" strokeWidth={2.1} />
                        {formatRows(artifact.rowCount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/65 bg-white/70 px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/70">
                        Структура
                      </p>
                      <p className="mt-2 text-sm font-semibold text-on-surface">
                        {formatColumns(artifact.columns.length)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/65 bg-white/70 px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/70">
                        Режим
                      </p>
                      <p className="mt-2 text-sm font-semibold text-on-surface">
                        {artifact.skipAutoRowLimit ? 'Полная выгрузка' : 'Стандартный лимит'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedTurnId(current => (current === turn.id ? null : turn.id))}
                    className="ui-button-secondary rounded-xl px-3 py-2 text-sm font-semibold"
                  >
                    {showSql ? 'Скрыть SQL' : 'SQL'}
                  </button>
                  <button
                    type="button"
                    onClick={onExport}
                    disabled={exporting}
                    className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-primary" strokeWidth={2.1} />
                    {exporting ? 'Экспорт…' : 'Excel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
                  >
                    <X className="h-4 w-4 text-primary" strokeWidth={2.1} />
                    Закрыть
                  </button>
                </div>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
              {artifact.warnings?.length ? (
                <div className="flex flex-wrap gap-2">
                  {artifact.warnings.map(warning => (
                    <span
                      key={warning}
                      className="rounded-full border border-tertiary/20 bg-tertiary-fixed/50 px-3 py-1.5 text-xs text-on-tertiary-fixed-variant"
                    >
                      {warning}
                    </span>
                  ))}
                </div>
              ) : null}

              {showSql ? <SqlHighlight sql={artifact.sql} /> : null}

              <div className="overflow-hidden rounded-[28px] border border-outline-variant/14 bg-white/75 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                <UnifiedReportTable
                  data={artifact.data}
                  columns={artifact.columns.map(column => ({
                    key: column,
                    label: resolveAiColumnHeader(column),
                  }))}
                  total={artifact.rowCount}
                  sortable
                  mode="client"
                  warnings={artifact.warnings}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
