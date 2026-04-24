import type { ReactNode } from 'react';

export function CanvasBlock({
  step,
  title,
  subtitle,
  badge,
  optional,
  collapsible,
  open,
  onToggle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  badge?: string;
  optional?: boolean;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const showBody = !collapsible || open;
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface">
      <div className="flex items-center gap-2.5 border-b border-outline-variant/12 px-3.5 py-2.5">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-low font-mono text-[11px] font-semibold text-on-surface-variant">
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            {title}
            {optional && (
              <span className="rounded-full border border-outline-variant/15 px-1.5 py-px text-[10.5px] font-normal text-on-surface-variant">
                необязательно
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-on-surface-variant">{subtitle}</div>
        </div>
        {badge && (
          <span className="rounded-full border border-outline-variant/15 bg-surface-container-low/50 px-2 py-0.5 text-xs text-on-surface-variant">
            {badge}
          </span>
        )}
        {collapsible && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded px-1.5 py-0.5 text-xs text-on-surface-variant hover:text-on-surface"
          >
            {open ? 'Свернуть' : 'Развернуть'}
          </button>
        )}
      </div>
      {showBody && <div className="px-3.5 py-3">{children}</div>}
    </div>
  );
}
