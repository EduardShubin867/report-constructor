import type { ButtonHTMLAttributes } from 'react';

export type SourceMiniLinkButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Без фиксированного `text-[10px]` — размер берётся от родителя (например заголовок таблицы). */
  inheritFontSize?: boolean;
};

/** Подчёркнутая мини-кнопка для массовых действий в шапке таблиц редактора источника. */
export default function SourceMiniLinkButton({
  inheritFontSize = false,
  className = '',
  type = 'button',
  ...props
}: SourceMiniLinkButtonProps) {
  return (
    <button
      type={type}
      className={[
        'underline underline-offset-1 hover:text-on-surface',
        inheritFontSize ? '' : 'text-[10px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
