'use client';

import MultiSelect from './MultiSelect';

export interface FilterValues {
  агент: string[];
  регион: string[];
  видДоговора: string[];
  датаОт: string;
  датаДо: string;
  территория: string[];
  дг: string[];
  крм: string[];
  крп: string[];
}

export const EMPTY_FILTERS: FilterValues = {
  агент: [], регион: [], видДоговора: [], датаОт: '', датаДо: '',
  территория: [], дг: [], крм: [], крп: [],
};

export interface FilterOptions {
  агенты: string[];
  регионы: string[];
  видыДоговора: string[];
  территории: string[];
  дг: string[];
  крм: string[];
  крп: string[];
}

interface ReportFiltersProps {
  filters: FilterValues;
  options: FilterOptions;
  loading: boolean;
  filtersLoading?: boolean;
  onFiltersChange: (f: FilterValues) => void;
  onSubmit: () => void;
}

export default function ReportFilters({ filters, options, loading, filtersLoading, onFiltersChange, onSubmit }: ReportFiltersProps) {
  function set<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const activeCount = [
    filters.агент.length, filters.регион.length, filters.видДоговора.length,
    filters.датаОт || filters.датаДо ? 1 : 0,
    filters.территория.length, filters.дг.length, filters.крм.length, filters.крп.length,
  ].filter(Boolean).length;

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
          <button type="button" onClick={() => onFiltersChange(EMPTY_FILTERS)}
            className="ui-button-ghost rounded-lg px-2 py-1 text-xs">
            Сбросить все
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        <MultiSelect label="Агент" options={options.агенты} value={filters.агент}
          onChange={v => set('агент', v)} placeholder="Все агенты" loading={filtersLoading} />
        <MultiSelect label="Регион" options={options.регионы} value={filters.регион}
          onChange={v => set('регион', v)} placeholder="Все регионы" loading={filtersLoading} />
        <MultiSelect label="Вид договора" options={options.видыДоговора} value={filters.видДоговора}
          onChange={v => set('видДоговора', v)} placeholder="Все виды" loading={filtersLoading} />

        <div className="flex flex-col gap-1 lg:col-span-2">
          <label className="block text-sm font-medium text-on-surface">Период</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
            <input type="date" value={filters.датаОт} onChange={e => set('датаОт', e.target.value)}
              className="ui-field min-w-0 rounded-xl px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
            <span className="hidden text-center text-outline-variant sm:block">—</span>
            <input type="date" value={filters.датаДо} onChange={e => set('датаДо', e.target.value)}
              className="ui-field min-w-0 rounded-xl px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
          </div>
        </div>

        <MultiSelect label="Территория ТС" options={options.территории} value={filters.территория}
          onChange={v => set('территория', v)} placeholder="Все территории" loading={filtersLoading} />
        <MultiSelect label="ДГ" options={options.дг} value={filters.дг}
          onChange={v => set('дг', v)} placeholder="Все ДГ" loading={filtersLoading} />
        <MultiSelect label="КРМ" options={options.крм} value={filters.крм}
          onChange={v => set('крм', v)} placeholder="Все КРМ" loading={filtersLoading} />
        <MultiSelect label="КРП" options={options.крп} value={filters.крп}
          onChange={v => set('крп', v)} placeholder="Все КРП" loading={filtersLoading} />
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
