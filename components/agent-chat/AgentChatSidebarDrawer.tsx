import { AnimatePresence, motion } from 'framer-motion';
import ChatSidebar from '@/components/agent-chat/ChatSidebar';
import type { SaveState } from '@/components/agent-chat/types';
import type { SavedChatSummary } from '@/lib/report-history-types';

type Props = {
  open: boolean;
  onClose: () => void;
  chats: SavedChatSummary[];
  loading: boolean;
  activeChatId: string | null;
  loadingChatId: string | null;
  saveState: SaveState;
  savedAt: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
};

export default function AgentChatSidebarDrawer({
  open,
  onClose,
  chats,
  loading,
  activeChatId,
  loadingChatId,
  saveState,
  savedAt,
  onSelectChat,
  onNewChat,
}: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[65] bg-slate-950/35 backdrop-blur-sm lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="h-full w-[min(22rem,calc(100%-1.5rem))] p-3"
            onClick={event => event.stopPropagation()}
          >
            <ChatSidebar
              chats={chats}
              loading={loading}
              activeChatId={activeChatId}
              loadingChatId={loadingChatId}
              saveState={saveState}
              savedAt={savedAt}
              onSelect={onSelectChat}
              onCreate={onNewChat}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
