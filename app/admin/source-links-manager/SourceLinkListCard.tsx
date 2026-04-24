import type { SourceLink } from '@/lib/schema';

type SourceLinkListCardProps = {
  link: SourceLink;
  leftName: string;
  rightName: string;
  leftLabel: string;
  rightLabel: string;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function SourceLinkListCard({
  link,
  leftName,
  rightName,
  leftLabel,
  rightLabel,
  deleting,
  onEdit,
  onDelete,
}: SourceLinkListCardProps) {
  return (
    <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
              {link.id}
            </span>
            <h4 className="text-lg font-semibold text-on-surface">{link.name}</h4>
          </div>
          {link.description ? (
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{link.description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-primary hover:text-primary/70 transition-colors"
          >
            Изменить
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="text-sm text-red-600 hover:text-red-500 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="rounded-2xl border border-outline-variant/15 bg-primary-fixed/25 p-4">
          <p className="text-xs text-on-surface-variant">Левый источник</p>
          <p className="mt-1 font-semibold text-on-surface">{leftName}</p>
          <p className="mt-3 text-xs text-on-surface-variant">Поле связи</p>
          <p className="mt-1 text-sm text-on-surface">{leftLabel}</p>
        </div>

        <div className="flex items-center justify-center">
          <span className="rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2 text-xs font-medium text-on-surface-variant">
            match
          </span>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-tertiary-fixed/25 p-4">
          <p className="text-xs text-on-surface-variant">Правый источник</p>
          <p className="mt-1 font-semibold text-on-surface">{rightName}</p>
          <p className="mt-3 text-xs text-on-surface-variant">Поле связи</p>
          <p className="mt-1 text-sm text-on-surface">{rightLabel}</p>
        </div>
      </div>

      {link.sharedPeriodLink ? (
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full border border-outline-variant/15 bg-surface-container px-3 py-1 text-xs text-on-surface-variant">
            📅 {link.sharedPeriodLink.label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
