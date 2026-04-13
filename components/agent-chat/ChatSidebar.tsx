import { LoaderCircle, Plus } from 'lucide-react';
import SaveStateBadge from '@/components/agent-chat/SaveStateBadge';
import type { SaveState } from '@/components/agent-chat/types';
import { formatReportTime, formatTurnCount } from '@/components/agent-chat/utils';
import type { SavedChatSummary } from '@/lib/report-history-types';

type Props = {
  chats: SavedChatSummary[];
  loading: boolean;
  activeChatId: string | null;
  loadingChatId: string | null;
  saveState: SaveState;
  savedAt: string | null;
  onSelect: (chatId: string) => void;
  onCreate: () => void;
};

export default function ChatSidebar({
  chats,
  loading,
  activeChatId,
  loadingChatId,
  saveState,
  savedAt,
  onSelect,
  onCreate,
}: Props) {
  return (
    <div className="ui-panel flex h-full min-h-[32rem] flex-col overflow-hidden rounded-[30px] p-4 sm:p-5 lg:min-h-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-on-surface">Последние чаты</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            История сохраняется отдельно для каждого пользователя
          </p>
        </div>
        <SaveStateBadge state={saveState} savedAt={savedAt} compact />
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="ui-button-primary mb-4 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
      >
        <Plus className="h-4 w-4 text-on-primary" strokeWidth={2.1} />
        Новый чат
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading && chats.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Загружаю чаты…</p>
        ) : chats.length === 0 ? (
          <div className="ui-panel-muted rounded-2xl border border-dashed border-outline-variant/25 p-5 text-sm text-on-surface-variant">
            Пока нет сохранённых чатов. Начните новый диалог, и он появится здесь.
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map(chat => {
              const isActive = chat.id === activeChatId;
              const isBusy = chat.id === loadingChatId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelect(chat.id)}
                  disabled={isBusy}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive
                      ? 'border-primary bg-primary text-on-primary shadow-[0_10px_26px_rgba(52,92,150,0.18)]'
                      : 'border-outline-variant/20 bg-white/70 text-on-surface hover:border-outline-variant/35 hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{chat.firstQuery}</p>
                      <p
                        className={`mt-1 truncate text-xs ${isActive ? 'text-on-primary/85' : 'text-on-surface-variant'}`}
                      >
                        {chat.latestQuery}
                      </p>
                    </div>
                    {isBusy ? (
                      <LoaderCircle
                        className={`mt-0.5 h-4 w-4 shrink-0 animate-spin ${isActive ? 'text-on-primary' : 'text-primary'}`}
                        strokeWidth={2.1}
                      />
                    ) : null}
                  </div>

                  <div
                    className={`mt-2 flex items-center gap-2 text-[11px] ${isActive ? 'text-on-primary/80' : 'text-on-surface-variant/80'}`}
                  >
                    <span>{formatTurnCount(chat.turnCount)}</span>
                    <span>·</span>
                    <span>{formatReportTime(chat.updatedAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
