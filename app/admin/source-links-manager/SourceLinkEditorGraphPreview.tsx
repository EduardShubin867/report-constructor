type SourceLinkEditorGraphPreviewProps = {
  leftSourceName: string;
  rightSourceName: string;
  leftJoinLabel: string;
  rightJoinLabel: string;
};

export function SourceLinkEditorGraphPreview({
  leftSourceName,
  rightSourceName,
  leftJoinLabel,
  rightJoinLabel,
}: SourceLinkEditorGraphPreviewProps) {
  return (
    <div className="mt-6 rounded-[26px] border border-outline-variant/15 bg-surface-container-low/45 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
        Предпросмотр графа
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Источник</p>
          <p className="mt-1 font-semibold text-on-surface">{leftSourceName}</p>
          <p className="mt-2 text-xs text-on-surface-variant">Поле</p>
          <p className="mt-1 text-sm text-on-surface">{leftJoinLabel}</p>
        </div>

        <div className="flex items-center justify-center text-sm font-medium text-on-surface-variant">
          <span className="rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2">
            совпадение по значению
          </span>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
          <p className="text-xs text-on-surface-variant">Источник</p>
          <p className="mt-1 font-semibold text-on-surface">{rightSourceName}</p>
          <p className="mt-2 text-xs text-on-surface-variant">Поле</p>
          <p className="mt-1 text-sm text-on-surface">{rightJoinLabel}</p>
        </div>
      </div>
    </div>
  );
}
