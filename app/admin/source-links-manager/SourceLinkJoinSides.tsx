import AppSelect from '@/components/ui/app-select';
import type { SourceLinkFormState } from './types';

type SelectOption = { value: string; label: string };

type SourceLinkJoinSidesProps = {
  form: SourceLinkFormState;
  setField: <K extends keyof SourceLinkFormState>(key: K, value: SourceLinkFormState[K]) => void;
  sourceSelectOptions: SelectOption[];
  leftColumnOptions: SelectOption[];
  rightColumnOptions: SelectOption[];
};

export function SourceLinkJoinSides({
  form,
  setField,
  sourceSelectOptions,
  leftColumnOptions,
  rightColumnOptions,
}: SourceLinkJoinSidesProps) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
      <div className="rounded-[26px] border border-primary/15 bg-primary-fixed/35 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Левая сторона
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-on-surface-variant">Источник</span>
            <AppSelect
              value={form.leftSourceId}
              onValueChange={value => setField('leftSourceId', value)}
              options={sourceSelectOptions}
              placeholder="Выберите источник"
              triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
              labelClassName="text-sm"
              ariaLabel="Выбор левого источника"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-on-surface-variant">Поле связи</span>
            <AppSelect
              value={form.leftJoinField}
              onValueChange={value => setField('leftJoinField', value)}
              options={leftColumnOptions}
              placeholder="Выберите поле"
              triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
              labelClassName="text-sm"
              ariaLabel="Выбор левого поля связи"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="rounded-full border border-outline-variant/15 bg-surface-container p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            join
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-tertiary/15 bg-tertiary-fixed/35 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-tertiary/80">
          Правая сторона
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-on-surface-variant">Источник</span>
            <AppSelect
              value={form.rightSourceId}
              onValueChange={value => setField('rightSourceId', value)}
              options={sourceSelectOptions}
              placeholder="Выберите источник"
              triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
              labelClassName="text-sm"
              ariaLabel="Выбор правого источника"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-on-surface-variant">Поле связи</span>
            <AppSelect
              value={form.rightJoinField}
              onValueChange={value => setField('rightJoinField', value)}
              options={rightColumnOptions}
              placeholder="Выберите поле"
              triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
              labelClassName="text-sm"
              ariaLabel="Выбор правого поля связи"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
