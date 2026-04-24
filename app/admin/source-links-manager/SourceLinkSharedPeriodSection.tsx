import type { ColumnDef } from '@/lib/report-columns';
import AppSelect from '@/components/ui/app-select';
import { SHARED_PERIOD_MODE_OPTIONS } from './constants';
import type { SourceLinkFormState } from './types';

type SelectOption = { value: string; label: string };

type SourceLinkSharedPeriodSectionProps = {
  form: SourceLinkFormState;
  leftDateCols: ColumnDef[];
  rightDateCols: ColumnDef[];
  leftDateOptions: SelectOption[];
  rightDateOptions: SelectOption[];
  setPeriodField: <K extends keyof SourceLinkFormState>(
    key: K,
    value: SourceLinkFormState[K],
  ) => void;
  onEnable: () => void;
  onDisable: () => void;
};

export function SourceLinkSharedPeriodSection({
  form,
  leftDateCols,
  rightDateCols,
  leftDateOptions,
  rightDateOptions,
  setPeriodField,
  onEnable,
  onDisable,
}: SourceLinkSharedPeriodSectionProps) {
  return (
    <div className="mt-6 rounded-[26px] border border-outline-variant/15 bg-surface-container-low/45 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            Общий период
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Единый фильтр диапазона дат для обоих источников — можно выбрать любое поле типа date.
          </p>
        </div>
        {leftDateCols.length > 0 && rightDateCols.length > 0 && (
          form.sharedPeriodEnabled ? (
            <button
              type="button"
              onClick={onDisable}
              className="shrink-0 text-sm text-red-500 hover:text-red-400 transition-colors"
            >
              Убрать
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnable}
              className="shrink-0 text-sm text-primary hover:text-primary/70 transition-colors"
            >
              + Включить
            </button>
          )
        )}
      </div>

      {!form.leftSourceId || !form.rightSourceId ? (
        <p className="mt-3 text-xs text-on-surface-variant/70">Выберите оба источника.</p>
      ) : leftDateCols.length === 0 || rightDateCols.length === 0 ? (
        <p className="mt-3 text-xs text-on-surface-variant/70">
          Один или оба источника не содержат полей типа date. Добавьте их в схеме источника.
        </p>
      ) : !form.sharedPeriodEnabled ? (
        <p className="mt-3 text-xs text-on-surface-variant/70">Не настроен. Нажмите «+ Включить».</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex gap-4">
            <AppSelect
              value={form.sharedPeriodMode}
              onValueChange={value => setPeriodField('sharedPeriodMode', value as 'single' | 'range')}
              options={[...SHARED_PERIOD_MODE_OPTIONS]}
              triggerClassName="ui-field h-10 rounded-xl px-3 text-sm focus:border-primary/50"
              contentClassName="max-w-[min(32rem,calc(100vw-2rem))]"
              itemClassName="items-start py-2.5 whitespace-normal"
              labelClassName="text-sm"
              ariaLabel="Выбор режима общего периода"
            />
          </div>

          <label className="block max-w-sm">
            <span className="mb-1 block text-xs text-on-surface-variant">Название фильтра</span>
            <input
              value={form.sharedPeriodLabel}
              onChange={e => setPeriodField('sharedPeriodLabel', e.target.value)}
              className="ui-field h-9 w-full rounded-xl px-3 text-sm focus:border-primary/50 focus:outline-none"
              placeholder="Период договора"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/12 bg-primary-fixed/20 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70">
                Слева
              </p>
              <label className="block">
                <span className="mb-1 block text-xs text-on-surface-variant">
                  {form.sharedPeriodMode === 'range' ? 'Поле начала (≥ от)' : 'Поле даты'}
                </span>
                <AppSelect
                  value={form.sharedPeriodLeftFrom}
                  onValueChange={value => setPeriodField('sharedPeriodLeftFrom', value)}
                  options={leftDateOptions}
                  placeholder="— выберите —"
                  triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                  labelClassName="text-sm"
                  ariaLabel="Выбор левого поля периода"
                />
              </label>
              {form.sharedPeriodMode === 'range' && (
                <label className="block">
                  <span className="mb-1 block text-xs text-on-surface-variant">Поле конца (≤ до)</span>
                  <AppSelect
                    value={form.sharedPeriodLeftTo}
                    onValueChange={value => setPeriodField('sharedPeriodLeftTo', value)}
                    options={leftDateOptions}
                    placeholder="— выберите —"
                    triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                    labelClassName="text-sm"
                    ariaLabel="Выбор левого поля конца периода"
                  />
                </label>
              )}
            </div>

            <div className="rounded-2xl border border-tertiary/12 bg-tertiary-fixed/20 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary/70">
                Справа
              </p>
              <label className="block">
                <span className="mb-1 block text-xs text-on-surface-variant">
                  {form.sharedPeriodMode === 'range' ? 'Поле начала (≥ от)' : 'Поле даты'}
                </span>
                <AppSelect
                  value={form.sharedPeriodRightFrom}
                  onValueChange={value => setPeriodField('sharedPeriodRightFrom', value)}
                  options={rightDateOptions}
                  placeholder="— выберите —"
                  triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                  labelClassName="text-sm"
                  ariaLabel="Выбор правого поля периода"
                />
              </label>
              {form.sharedPeriodMode === 'range' && (
                <label className="block">
                  <span className="mb-1 block text-xs text-on-surface-variant">Поле конца (≤ до)</span>
                  <AppSelect
                    value={form.sharedPeriodRightTo}
                    onValueChange={value => setPeriodField('sharedPeriodRightTo', value)}
                    options={rightDateOptions}
                    placeholder="— выберите —"
                    triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                    labelClassName="text-sm"
                    ariaLabel="Выбор правого поля конца периода"
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
