import type { ButtonHTMLAttributes } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SourceMiniLinkButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Без фиксированного `text-[10px]` — размер берётся от родителя (например заголовок таблицы). */
  inheritFontSize?: boolean;
};

/** Подчёркнутая мини-кнопка для массовых действий в шапке таблиц редактора источника. */
export default function SourceMiniLinkButton({
  inheritFontSize = false,
  className,
  type = 'button',
  ...props
}: SourceMiniLinkButtonProps) {
  return (
    <Button
      type={type}
      variant="ghost"
      size="xs"
      className={cn(
        'h-auto min-h-0 px-0 py-0 font-normal text-on-surface-variant underline underline-offset-1 hover:bg-transparent hover:text-on-surface',
        inheritFontSize ? 'text-[inherit] leading-[inherit]' : 'text-[10px]',
        className,
      )}
      {...props}
    />
  );
}
