import { Bot, CircleAlert, TriangleAlert } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import AgentArtifactCard from '@/components/AgentArtifactCard';
import MarkdownText from '@/components/agent-chat/MarkdownText';
import OsagoChartCards from '@/components/agent-chat/OsagoChartCards';
import type { AssistantMessageTone, SavedChatTurn } from '@/lib/report-history-types';

type ToneStyles = {
  panel: string;
  chip: string;
  icon: ReactElement;
  label: string;
};

const TONE_STYLES: Record<Exclude<AssistantMessageTone, 'info'>, ToneStyles> = {
  warning: {
    panel: 'border-amber-500/30 bg-amber-50/60',
    chip: 'bg-amber-500/15 text-amber-800',
    icon: <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.1} />,
    label: 'Нет данных',
  },
  error: {
    panel: 'border-error/30 bg-error-container/40',
    chip: 'bg-error/15 text-error',
    icon: <CircleAlert className="h-3.5 w-3.5" strokeWidth={2.1} />,
    label: 'Не получилось',
  },
};

type Props = {
  turn: SavedChatTurn;
  exporting: boolean;
  isRunning: boolean;
  onOpenArtifact: () => void;
  onExport: () => void;
  onRefine: () => void;
  onPickSuggestion: (suggestion: string) => void;
};

export default function AgentChatAssistantMessage({
  turn,
  exporting,
  isRunning,
  onOpenArtifact,
  onExport,
  onRefine,
  onPickSuggestion,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const artifact = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;
  const tone = turn.assistant.tone ?? 'info';
  const toneStyles = tone !== 'info' ? TONE_STYLES[tone] : null;
  const detail = turn.assistant.kind === 'text' ? turn.assistant.detail : undefined;
  const charts = turn.assistant.kind === 'text' ? turn.assistant.charts ?? [] : [];

  return (
    <div className={artifact ? 'w-full max-w-none space-y-3' : charts.length > 0 ? 'max-w-[58rem] space-y-3' : 'max-w-[46rem] space-y-3'}>
      {artifact ? (
        <AgentArtifactCard
          artifact={artifact}
          summary={turn.assistant.text}
          exporting={exporting}
          layoutId={`artifact-${turn.id}`}
          onOpen={onOpenArtifact}
          onExport={onExport}
          onRefine={onRefine}
        />
      ) : (
        <div
          className={`ui-panel ${charts.length > 0 ? 'max-w-[58rem]' : 'max-w-[46rem]'} rounded-[28px] px-5 py-4 text-sm leading-6 text-on-surface ${toneStyles?.panel ?? ''}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                toneStyles?.chip ?? 'ui-chip-accent'
              }`}
            >
              {toneStyles?.icon ?? <Bot className="h-3.5 w-3.5" strokeWidth={2.1} />}
              {toneStyles?.label ?? 'Ответ'}
            </span>
          </div>
          {turn.assistant.kind === 'text' ? (
            <MarkdownText text={turn.assistant.text} renderImages={charts.length === 0} />
          ) : null}
          {charts.length > 0 ? (
            <div className="mt-4">
              <OsagoChartCards charts={charts} />
            </div>
          ) : null}
          {detail ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setDetailOpen(open => !open)}
                className="ui-button-ghost rounded-md px-2 py-1 text-[11px]"
              >
                {detailOpen ? 'Скрыть детали' : 'Показать детали'}
              </button>
              {detailOpen ? (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-container/60 p-3 text-[11px] leading-5 text-on-surface-variant">
                  {detail}
                </pre>
              ) : null}
            </div>
          ) : null}
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
              onClick={() => onPickSuggestion(suggestion)}
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
