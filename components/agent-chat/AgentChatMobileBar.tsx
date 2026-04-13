import { PanelLeft, Plus } from 'lucide-react';

type Props = {
  onOpenChats: () => void;
  onNewChat: () => void;
};

export default function AgentChatMobileBar({ onOpenChats, onNewChat }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 lg:hidden">
      <button
        type="button"
        onClick={onOpenChats}
        className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
      >
        <PanelLeft className="h-4 w-4 text-primary" strokeWidth={2.1} />
        Чаты
      </button>

      <button
        type="button"
        onClick={onNewChat}
        className="ui-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
      >
        <Plus className="h-4 w-4 text-primary" strokeWidth={2.1} />
        Новый чат
      </button>
    </div>
  );
}
