import { formatClockTime, formatReportTime } from '@/components/agent-chat/utils';
import type { SaveState } from '@/components/agent-chat/types';

type Props = {
  state: SaveState;
  savedAt: string | null;
  compact?: boolean;
};

export default function SaveStateBadge({ state, savedAt, compact = false }: Props) {
  if (state === 'idle') return null;

  const className = compact
    ? 'rounded-full px-2.5 py-1 text-[10px] font-medium'
    : 'rounded-full px-2.5 py-1 text-[11px] font-medium';

  if (state === 'saving') {
    return (
      <span className={`${className} border border-primary/15 bg-primary-fixed/70 text-primary`}>
        Сохраняю…
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className={`${className} border border-error/20 bg-error-container/50 text-error`}>
        Не сохранено
      </span>
    );
  }

  return (
    <span
      className={`${className} border border-emerald-500/20 bg-emerald-500/10 text-emerald-700`}
      title={savedAt ? `Сохранено ${formatReportTime(savedAt)}` : 'Сохранено'}
    >
      {savedAt ? `Сохранено · ${formatClockTime(savedAt)}` : 'Сохранено'}
    </span>
  );
}
