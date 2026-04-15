'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import MultiSelect from './MultiSelect';
import type { FilterDef, PeriodFilterCol } from '@/lib/report-filters-data';


interface Props {
  filterDefs: FilterDef[];
  options: Record<string, string[]>;
  values: Record<string, string[]>;
  periodFilterCols: PeriodFilterCol[];
  periodFilters: Record<string, { from: string; to: string }>;
  filtersLoading?: boolean;
  /** Подгрузка опций для secondary-фильтра при первом открытии дропдауна */
  onLazyFilterOpen?: (key: string) => void;
  lazyFilterLoading?: Record<string, boolean>;
  onFiltersChange: (v: Record<string, string[]>) => void;
  onPeriodChange: (key: string, from: string, to: string) => void;
}

export default function GenericReportFilters({
  filterDefs,
  options,
  values,
  periodFilterCols,
  periodFilters,
  filtersLoading,
  onLazyFilterOpen,
  lazyFilterLoading,
  onFiltersChange,
  onPeriodChange,
}: Props) {
  const primaryDefs = filterDefs.filter(fd => (fd.tier ?? 'primary') === 'primary');
  const secondaryDefs = filterDefs.filter(fd => fd.tier === 'secondary');
  const showPrimaryBlock = primaryDefs.length > 0 || periodFilterCols.length > 0;
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);
  const secondaryActiveCount = secondaryDefs.filter(fd => (values[fd.key]?.length ?? 0) > 0).length;
  const activeLabels = useMemo(
    () =>
      filterDefs
        .filter(fd => (values[fd.key]?.length ?? 0) > 0)
        .map(fd => fd.label),
    [filterDefs, values],
  );

  const activePeriodCount = periodFilterCols.filter(col => {
    const p = periodFilters[col.key];
    return p?.from || p?.to;
  }).length;

  const activeCount =
    filterDefs.filter(fd => (values[fd.key]?.length ?? 0) > 0).length + activePeriodCount;

  function handleReset() {
    onFiltersChange({});
    for (const col of periodFilterCols) {
      onPeriodChange(col.key, '', '');
    }
  }

  return (
    <div className="ui-panel relative overflow-visible rounded-[28px]">
      <div className="border-b border-outline-variant/10 px-5 py-5 sm:px-6">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              Фильтры
            </span>
            <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium">
              Списки открываются по запросу
            </span>
            {activeCount > 0 ? (
              <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium">
                Выбрано: {activeCount}
              </span>
            ) : null}
          </div>
          <h2 className="font-headline text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
            Сначала задайте отбор
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Оставьте только то, что действительно важно для вашего вопроса. Самые частые фильтры показаны сразу, остальные можно открыть ниже.
          </p>
        </div>

        {activeCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeLabels.slice(0, 5).map(label => (
              <span
                key={label}
                className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
              >
                {label}
              </span>
            ))}
            {activeLabels.length > 5 ? (
              <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                +{activeLabels.length - 5}
              </span>
            ) : null}
            {activePeriodCount > 0 ? (
              <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                {activePeriodCount === 1 ? 'Выбран период' : `Выбрано периодов: ${activePeriodCount}`}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {showPrimaryBlock && (
          <section className="rounded-[24px] border border-primary/15 bg-primary-fixed/35 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/75">
                  С чего начать
                </p>
                <h3 className="mt-1 font-headline text-lg font-semibold text-on-surface">
                  Самое важное
                </h3>
              </div>
              <p className="max-w-md text-xs leading-5 text-on-surface-variant">
                Здесь собраны первые фильтры, с которых обычно начинают настройку отчёта.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {primaryDefs.map(fd => (
                <div
                  key={fd.key}
                  className="rounded-[20px] border border-white/55 bg-surface-container-lowest/78 p-3 shadow-[0_8px_20px_rgba(23,32,43,0.03)]"
                >
                  <MultiSelect
                    label={fd.label}
                    options={options[fd.key] ?? []}
                    value={values[fd.key] ?? []}
                    onChange={v => onFiltersChange({ ...values, [fd.key]: v })}
                    placeholder="Все"
                    loading={Boolean(filtersLoading) || Boolean(lazyFilterLoading?.[fd.key])}
                    onOpenChange={open => {
                      if (open) onLazyFilterOpen?.(fd.key);
                    }}
                  />
                </div>
              ))}

              {periodFilterCols.map(col => {
                const p = periodFilters[col.key] ?? { from: '', to: '' };
                return (
                  <div
                    key={col.key}
                    className="rounded-[20px] border border-white/55 bg-surface-container-lowest/78 p-3 shadow-[0_8px_20px_rgba(23,32,43,0.03)] xl:col-span-2"
                  >
                    <label className="mb-1 block text-sm font-medium text-on-surface">{col.label}</label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                      <input
                        type={col.type === 'number' ? 'number' : 'date'}
                        value={p.from}
                        onChange={e => onPeriodChange(col.key, e.target.value, p.to)}
                        className="ui-field min-w-0 rounded-xl px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                      />
                      <span className="hidden text-center text-outline-variant sm:block">—</span>
                      <input
                        type={col.type === 'number' ? 'number' : 'date'}
                        value={p.to}
                        onChange={e => onPeriodChange(col.key, p.from, e.target.value)}
                        className="ui-field min-w-0 rounded-xl px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {secondaryDefs.length > 0 && (
          <section className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low/55">
            <button
              type="button"
              onClick={() => setSecondaryExpanded(e => !e)}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-container-low/85 sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Дополнительно
                </p>
                <h3 className="mt-1 font-headline text-lg font-semibold text-on-surface">
                  Остальные фильтры
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-on-surface-variant sm:text-xs">
                  {secondaryExpanded
                    ? 'Здесь можно точнее настроить выборку, если верхнего блока уже недостаточно.'
                    : secondaryActiveCount > 0
                      ? `Сейчас выбрано ${secondaryActiveCount} ${secondaryActiveCount === 1 ? 'дополнительный фильтр' : secondaryActiveCount < 5 ? 'дополнительных фильтра' : 'дополнительных фильтров'}.`
                      : 'Если нужно, раскройте блок и добавьте более точные условия.'}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-outline-variant transition-transform duration-200 ${
                  secondaryExpanded ? 'rotate-180' : ''
                }`}
                strokeWidth={2.1}
              />
            </button>
            {secondaryExpanded && (
              <div className="border-t border-outline-variant/15 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {secondaryDefs.map(fd => (
                    <div
                      key={fd.key}
                      className="rounded-[20px] border border-outline-variant/10 bg-surface-container-lowest/82 p-3"
                    >
                      <MultiSelect
                        label={fd.label}
                        options={options[fd.key] ?? []}
                        value={values[fd.key] ?? []}
                        onChange={v => onFiltersChange({ ...values, [fd.key]: v })}
                        placeholder="Все"
                        loading={Boolean(filtersLoading) || Boolean(lazyFilterLoading?.[fd.key])}
                        onOpenChange={open => {
                          if (open) onLazyFilterOpen?.(fd.key);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="border-t border-outline-variant/10 bg-surface-container-low/40 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-on-surface-variant">
            {activeCount > 0
              ? `Сейчас выбрано ${activeCount} ${activeCount === 1 ? 'условие' : activeCount < 5 ? 'условия' : 'условий'}. Можно запускать отчёт.`
              : 'Фильтры не обязательны, но с ними обычно проще сразу выйти на нужный срез.'}
          </p>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={handleReset}
              className="ui-button-ghost w-fit rounded-xl px-3 py-2 text-xs font-medium"
            >
              Сбросить фильтры
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
