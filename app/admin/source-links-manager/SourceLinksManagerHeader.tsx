type SourceLinksManagerHeaderProps = {
  editorOpen: boolean;
  onAdd: () => void;
};

export function SourceLinksManagerHeader({ editorOpen, onAdd }: SourceLinksManagerHeaderProps) {
  return (
    <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            Конструктор связей
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">
            Визуальные связи между источниками
          </h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Здесь можно заранее описать, как два источника нужно связывать между собой. Эти настройки
            затем используются в новой вкладке сводного отчёта.
          </p>
        </div>

        {!editorOpen ? (
          <button
            type="button"
            onClick={onAdd}
            className="ui-button-secondary rounded-xl px-4 py-2 text-sm font-medium"
          >
            + Добавить связь
          </button>
        ) : null}
      </div>
    </section>
  );
}
