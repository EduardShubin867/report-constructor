'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  Expand,
  FileSpreadsheet,
  FlaskConical,
  Rows3,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import SqlHighlight from '@/components/SqlHighlight';
import MarkdownText from '@/components/agent-chat/MarkdownText';
import { resolveAiColumnHeader } from '@/lib/column-header';
import type { ArtifactPayload } from '@/lib/report-history-types';

interface AgentArtifactCardProps {
  artifact: ArtifactPayload;
  summary: string;
  exporting: boolean;
  layoutId: string;
  onOpen: () => void;
  onExport: () => void;
  onRefine: () => void;
}

function formatRows(count: number): string {
  return `${count.toLocaleString('ru-RU')} ${pluralize(count, 'строка', 'строки', 'строк')}`;
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export default function AgentArtifactCard({
  artifact,
  summary,
  exporting,
  layoutId,
  onOpen,
  onExport,
  onRefine,
}: AgentArtifactCardProps) {
  const [showSql, setShowSql] = useState(false);

  const warningPreview = useMemo(
    () => (artifact.warnings ?? []).slice(0, 2),
    [artifact.warnings],
  );
  const columnPreview = useMemo(
    () => artifact.columns.slice(0, 4).map(resolveAiColumnHeader),
    [artifact.columns],
  );
  const hiddenColumnCount = Math.max(0, artifact.columns.length - columnPreview.length);

  return (
    <motion.article
      layoutId={layoutId}
      className="ui-panel relative overflow-hidden rounded-[28px] border border-primary/10 transition-shadow hover:shadow-[0_18px_40px_rgba(52,92,150,0.12)]"
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_right,rgba(52,92,150,0.18),transparent_58%)]" />

      <div className="relative border-b border-outline-variant/10 bg-[linear-gradient(135deg,rgba(225,235,251,0.95),rgba(255,255,255,0.95))] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="ui-chip-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                <Database className="h-3.5 w-3.5" strokeWidth={2.1} />
                Артефакт
              </span>
              <span className="text-[11px] font-medium text-on-surface-variant">
                {formatRows(artifact.rowCount)}
              </span>
              <span className="text-[11px] text-on-surface-variant/70">
                · нажмите, чтобы развернуть
              </span>
            </div>
            <div className="max-w-5xl text-sm text-on-surface">
              <MarkdownText text={summary} renderImages={false} />
            </div>
            {artifact.skillRounds ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                <FlaskConical className="h-3.5 w-3.5" strokeWidth={2.1} />
                Использовано справочников: {artifact.skillRounds}
              </p>
            ) : null}
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onOpen}
              className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <Expand className="h-3.5 w-3.5 text-primary" strokeWidth={2.1} />
              Открыть
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" strokeWidth={2.1} />
              {exporting ? 'Экспорт…' : 'Excel'}
            </button>
            <button
              type="button"
              onClick={() => setShowSql(value => !value)}
              className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              SQL
            </button>
            <button
              type="button"
              onClick={onRefine}
              className="ui-button-primary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-on-primary" strokeWidth={2.1} />
              Уточнить
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span className="ui-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <Rows3 className="h-3.5 w-3.5" strokeWidth={2.1} />
            {formatRows(artifact.rowCount)}
          </span>
          <span className="ui-chip inline-flex rounded-full px-3 py-1.5">
            {artifact.columns.length} {pluralize(artifact.columns.length, 'колонка', 'колонки', 'колонок')}
          </span>
          {artifact.skipAutoRowLimit ? (
            <span className="ui-chip-accent inline-flex rounded-full px-3 py-1.5">
              Без лимита 5&nbsp;000
            </span>
          ) : null}
          {warningPreview.map(warning => (
            <span
              key={warning}
              className="inline-flex items-center gap-1.5 rounded-full border border-tertiary/20 bg-tertiary-fixed/50 px-3 py-1.5 text-on-tertiary-fixed-variant"
            >
              <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} />
              {warning}
            </span>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {columnPreview.map(column => (
            <span key={column} className="ui-chip inline-flex rounded-full px-3 py-1.5 text-[11px]">
              {column}
            </span>
          ))}
          {hiddenColumnCount > 0 ? (
            <span className="ui-chip inline-flex rounded-full px-3 py-1.5 text-[11px]">
              +{hiddenColumnCount}
            </span>
          ) : null}
        </div>

        {showSql ? (
          <div
            className="border-t border-outline-variant/10 pt-4"
            onClick={event => event.stopPropagation()}
          >
            <SqlHighlight sql={artifact.sql} />
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}
