import { TYPE_META } from './constants';

export function TypeBadge({ type }: { type: string }) {
  const m = TYPE_META[type] ?? TYPE_META.string;
  return (
    <span
      className={`inline-flex h-[14px] min-w-[28px] flex-shrink-0 items-center justify-center rounded px-1 font-mono text-[9px] font-semibold ${m.cls}`}
    >
      {m.short}
    </span>
  );
}
