export function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    string:  { label: 'abc', cls: 'bg-[#eef1f4] text-[#506577]' },
    number:  { label: '123', cls: 'bg-[#eef3ee] text-[#476a52]' },
    date:    { label: 'дт',  cls: 'bg-[#f2ecef] text-[#7a4460]' },
    boolean: { label: '0/1', cls: 'bg-[#eef1f4] text-[#506577]' },
  };
  const { label, cls } = map[type] ?? { label: '?', cls: 'bg-[#f5f5f4] text-[#75726e]' };
  return (
    <span className={`inline-flex h-[14px] w-[26px] flex-shrink-0 items-center justify-center rounded text-[9px] font-mono font-semibold ${cls}`}>
      {label}
    </span>
  );
}
