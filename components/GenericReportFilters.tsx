'use client';

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

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {filterDefs.map(fd => (
          <MultiSelect
            key={fd.key}
            label={fd.label}
            options={options[fd.key] ?? []}
            value={values[fd.key] ?? []}
            onChange={v => onFiltersChange({ ...values, [fd.key]: v })}
            placeholder="Все"
            loading={
              Boolean(filtersLoading && (fd.tier ?? 'primary') === 'primary') ||
              Boolean(lazyFilterLoading?.[fd.key])
            }
            onOpenChange={open => {
              if (open && (fd.tier ?? 'primary') === 'secondary') onLazyFilterOpen?.(fd.key);
            }}
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
