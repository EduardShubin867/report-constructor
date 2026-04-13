import { CircleAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { fade } from '@/components/agent-chat/animations';

type Props = {
  message: string;
  onDismiss: () => void;
};

export default function AgentChatErrorAlert({ message, onDismiss }: Props) {
  return (
    <motion.div {...fade}>
      <div className="rounded-2xl border border-error/20 bg-error-container/40 px-4 py-3 text-sm text-error">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.1} />
          <div>
            <p>{message}</p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-2 text-xs font-semibold underline-offset-2 hover:underline"
            >
              Вернуться к чату
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
