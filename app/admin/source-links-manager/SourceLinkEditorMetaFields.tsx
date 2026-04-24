import type { SourceLinkFormState } from './types';

type SourceLinkEditorMetaFieldsProps = {
  form: SourceLinkFormState;
  initialId?: string;
  setField: <K extends keyof SourceLinkFormState>(key: K, value: SourceLinkFormState[K]) => void;
};

export function SourceLinkEditorMetaFields({
  form,
  initialId,
  setField,
}: SourceLinkEditorMetaFieldsProps) {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-xs text-on-surface-variant">ID связи</span>
        <input
          value={form.id}
          onChange={event => setField('id', event.target.value)}
          disabled={Boolean(initialId)}
          className="ui-field h-11 w-full rounded-xl px-3 text-sm focus:border-primary/50 focus:outline-none disabled:opacity-60"
          placeholder="client-product-link"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-on-surface-variant">Название</span>
        <input
          value={form.name}
          onChange={event => setField('name', event.target.value)}
          className="ui-field h-11 w-full rounded-xl px-3 text-sm focus:border-primary/50 focus:outline-none"
          placeholder="Клиент ↔ продукт"
        />
      </label>

      <label className="block xl:col-span-2">
        <span className="mb-1 block text-xs text-on-surface-variant">Описание</span>
        <textarea
          value={form.description}
          onChange={event => setField('description', event.target.value)}
          rows={3}
          className="ui-field w-full rounded-xl px-3 py-3 text-sm focus:border-primary/50 focus:outline-none"
          placeholder="Например: связываем журнал клиентов с продуктовой витриной по фамилии и коду продукта."
        />
      </label>
    </div>
  );
}
