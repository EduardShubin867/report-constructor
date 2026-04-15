import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SourceFilterTierTone = 'neutral' | 'primary' | 'secondary';

const inactiveClass = 'bg-surface-container text-on-surface-variant/50 hover:text-on-surface';

const activeByTone: Record<SourceFilterTierTone, string> = {
  neutral: 'bg-surface-container-high text-on-surface',
  primary: 'bg-emerald-600 text-white hover:bg-emerald-600',
  secondary: 'bg-teal-700 text-white hover:bg-teal-700',
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
  className,
  type = 'button',
  children,
  ...props
}: SourceFilterTierCellButtonProps) {
  return (
    <Button
      type={type}
      variant="ghost"
      size="xs"
      className={cn(
        'h-auto min-h-0 min-w-[1.35rem] shrink-0 gap-0 rounded px-0.5 py-0.5 text-[10px] font-medium hover:bg-transparent',
        active ? activeByTone[tone] : inactiveClass,
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
