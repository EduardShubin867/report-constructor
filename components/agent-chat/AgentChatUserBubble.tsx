import { formatClockTime } from '@/components/agent-chat/utils';

type Props = {
  createdAt: string;
  text: string;
};

export default function AgentChatUserBubble({ createdAt, text }: Props) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(84%,54rem)] rounded-[24px] bg-primary px-5 py-4 text-sm leading-6 text-on-primary shadow-[0_14px_28px_rgba(52,92,150,0.18)]">
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-on-primary/80">
          <span>Вы</span>
          <span>{formatClockTime(createdAt)}</span>
        </div>
        <p>{text}</p>
      </div>
    </div>
  );
}
