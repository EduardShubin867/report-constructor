'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import MultiSelect from './MultiSelect';
import type { FilterDef } from '@/lib/report-filters-data';

interface Props {
  filterDefs: FilterDef[];
  options: Record<string, string[]>;
  values: Record<string, string[]>;
  dateFilterCol: string | null;
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  filtersLoading?: boolean;
  /** Подгрузка опций для secondary-фильтра при первом открытии дропдауна */
  onLazyFilterOpen?: (key: string) => void;
  lazyFilterLoading?: Record<string, boolean>;
  onFiltersChange: (v: Record<string, string[]>) => void;
  onDateChange: (from: string, to: string) => void;
  onSubmit: () => void;
}

export default function GenericReportFilters({
  filterDefs,
  options,
  values,
  dateFilterCol,
  dateFrom,
  dateTo,
  loading,
  filtersLoading,
  onLazyFilterOpen,
  lazyFilterLoading,
  onFiltersChange,
  onDateChange,
  onSubmit,
}: Props) {
  const primaryDefs = filterDefs.filter(fd => (fd.tier ?? 'primary') === 'primary');
  const secondaryDefs = filterDefs.filter(fd => fd.tier === 'secondary');
  const showPrimaryBlock = primaryDefs.length > 0 || dateFilterCol !== null;
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);
  const secondaryActiveCount = secondaryDefs.filter(fd => (values[fd.key]?.length ?? 0) > 0).length;

  const activeCount =
    filterDefs.filter(fd => (values[fd.key]?.length ?? 0) > 0).length +
    (dateFrom || dateTo ? 1 : 0);

  function handleReset() {
    onFiltersChange({});
    onDateChange('', '');
  }

  return (
    <div className="ui-panel relative overflow-visible rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-headline text-sm font-semibold text-on-surface">Фильтры</h2>
          {activeCount > 0 && (
            <span className="ui-chip-accent inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button type="button" onClick={handleReset}
            className="ui-button-ghost rounded-lg px-2 py-1 text-xs">
            Сбросить все
          </button>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        {showPrimaryBlock && (
          <section className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <h3 className="mb-3 font-headline text-xs font-semibold uppercase tracking-wide text-on-surface">
              Основные фильтры
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {primaryDefs.map(fd => (
                <MultiSelect
                  key={fd.key}
                  label={fd.label}
                  options={options[fd.key] ?? []}
                  value={values[fd.key] ?? []}
                  onChange={v => onFiltersChange({ ...values, [fd.key]: v })}
                  placeholder="Все"
                  loading={Boolean(filtersLoading) || Boolean(lazyFilterLoading?.[fd.key])}
                />
              ))}

              {dateFilterCol !== null && (
                <div className="flex flex-col gap-1 lg:col-span-2">
                  <label className="block text-sm font-medium text-on-surface">Период</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => onDateChange(e.target.value, dateTo)}
                      className="ui-field min-w-0 rounded-xl px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                    />
                    <span className="hidden text-center text-outline-variant sm:block">—</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => onDateChange(dateFrom, e.target.value)}
                      className="ui-field min-w-0 rounded-xl px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {secondaryDefs.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low/40">
            <button
              type="button"
              onClick={() => setSecondaryExpanded(e => !e)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low/70"
            >
              <div className="min-w-0">
                <h3 className="font-headline text-xs font-semibold uppercase tracking-wide text-outline-variant">
                  Дополнительные фильтры
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-outline-variant">
                  {secondaryExpanded
                    ? 'Загружаются при первом открытии списка — чтобы не замедлять первую загрузку страницы.'
                    : `${secondaryActiveCount > 0 ? `${secondaryActiveCount} активных · ` : ''}По умолчанию свёрнуто — нажмите, чтобы развернуть.`}
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
              <div className="border-t border-outline-variant/15 px-4 pb-4 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {secondaryDefs.map(fd => (
                    <MultiSelect
                      key={fd.key}
                      label={fd.label}
                      options={options[fd.key] ?? []}
                      value={values[fd.key] ?? []}
                      onChange={v => onFiltersChange({ ...values, [fd.key]: v })}
                      placeholder="Все"
                      loading={Boolean(lazyFilterLoading?.[fd.key])}
                      onOpenChange={open => {
                        if (open) onLazyFilterOpen?.(fd.key);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Action bar */}
      <div className="border-t border-outline-variant/10 px-5 py-3.5">
        <button type="button" onClick={onSubmit} disabled={loading}
          className="ui-button-primary rounded-xl px-5 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? 'Загрузка…' : 'Сформировать отчёт'}
        </button>
      </div>
    </div>
  );
}
