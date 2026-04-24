import { Bot, BrainCircuit, Clock3 } from 'lucide-react';
import SaveStateBadge from '@/components/agent-chat/SaveStateBadge';
import type { SaveState } from '@/components/agent-chat/types';
import { formatTurnCount } from '@/components/agent-chat/utils';
import type { ChatMode, SavedChatSession } from '@/lib/report-history-types';

type Props = {
  chatHeading: string;
  chatSubheading: string | null;
  showEmptyState: boolean;
  activeChat: SavedChatSession | null;
  saveState: SaveState;
  savedAt: string | null;
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
  modeSwitchDisabled?: boolean;
};

export default function AgentChatPanelHeader({
  chatHeading,
  chatSubheading,
  showEmptyState,
  activeChat,
  saveState,
  savedAt,
  chatMode,
  onChatModeChange,
  modeSwitchDisabled = false,
}: Props) {
  const modes: { value: ChatMode; label: string; icon: typeof Bot }[] = [
    { value: 'constructor', label: 'AI-аналитик', icon: Bot },
    { value: 'osago-agent', label: 'ОСАГО-агент', icon: BrainCircuit },
  ];

  return (
    <div className="border-b border-outline-variant/10 px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-chip inline-flex rounded-full px-3 py-1 text-[11px] font-medium tracking-wide">
              {chatMode === 'osago-agent' ? 'ОСАГО-агент' : 'AI-аналитик'}
            </span>
            {!showEmptyState ? (
              <span className="text-xs text-on-surface-variant/80">Активный диалог</span>
            ) : null}
          </div>
          <h1 className="mt-1.5 max-w-5xl text-pretty font-headline text-[1.4rem] font-bold tracking-tight text-on-surface sm:text-[1.7rem]">
            {chatHeading}
          </h1>
          {chatSubheading ? (
            <p className="mt-1 max-w-4xl text-xs leading-5 text-on-surface-variant sm:text-sm sm:leading-6">
              {chatSubheading}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="ui-chip flex items-center gap-1 rounded-full p-1">
            {modes.map(mode => {
              const Icon = mode.icon;
              const active = chatMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onChatModeChange(mode.value)}
                  disabled={modeSwitchDisabled || active}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-default ${
                    active ? 'bg-primary-fixed text-on-primary-fixed' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
                  {mode.label}
                </button>
              );
            })}
          </div>
          {activeChat ? (
            <>
              <span className="ui-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
                <Clock3 className="h-3.5 w-3.5" strokeWidth={2.1} />
                {formatTurnCount(activeChat.turnCount)}
              </span>
              <SaveStateBadge state={saveState} savedAt={savedAt} />
            </>
          ) : (
            <span className="ui-chip inline-flex rounded-full px-3 py-1.5 text-xs">Новый чат</span>
          )}
        </div>
      </div>
    </div>
  );
}
