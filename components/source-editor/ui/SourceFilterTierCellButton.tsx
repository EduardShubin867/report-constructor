import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type SourceFilterTierTone = 'neutral' | 'primary' | 'secondary';

const baseClass =
  'min-w-[1.35rem] rounded px-0.5 py-0.5 text-[10px] font-medium';

const inactiveClass = 'bg-surface-container text-on-surface-variant/50 hover:text-on-surface';

const activeByTone: Record<SourceFilterTierTone, string> = {
  neutral: 'bg-surface-container-high text-on-surface',
  primary: 'bg-emerald-600 text-white',
  secondary: 'bg-teal-700 text-white',
};

export type SourceFilterTierCellButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> & {
  active: boolean;
  tone: SourceFilterTierTone;
  children: ReactNode;
};

/** Сегмент выбора уровня фильтра в строке колонок (`-` / О / Д). */
export default function SourceFilterTierCellButton({
  active,
  tone,
  className = '',
  type = 'button',
  children,
  ...props
}: SourceFilterTierCellButtonProps) {
  return (
    <button
      type={type}
      className={[baseClass, active ? activeByTone[tone] : inactiveClass, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
