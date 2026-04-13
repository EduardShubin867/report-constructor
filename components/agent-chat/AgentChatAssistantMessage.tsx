import { Bot } from 'lucide-react';
import AgentArtifactCard from '@/components/AgentArtifactCard';
import type { SavedChatTurn } from '@/lib/report-history-types';

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
  const artifact = turn.assistant.kind === 'artifact' ? turn.assistant.artifact : null;

  return (
    <div className={artifact ? 'w-full max-w-none space-y-3' : 'max-w-[46rem] space-y-3'}>
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
