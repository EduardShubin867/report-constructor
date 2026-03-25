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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Фильтры</h2>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold bg-blue-600 text-white rounded-full px-1.5">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button type="button" onClick={() => onFiltersChange(EMPTY_FILTERS)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Сбросить все
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <MultiSelect label="Агент" options={options.агенты} value={filters.агент}
          onChange={v => set('агент', v)} placeholder="Все агенты" loading={filtersLoading} />
        <MultiSelect label="Регион" options={options.регионы} value={filters.регион}
          onChange={v => set('регион', v)} placeholder="Все регионы" loading={filtersLoading} />
        <MultiSelect label="Вид договора" options={options.видыДоговора} value={filters.видДоговора}
          onChange={v => set('видДоговора', v)} placeholder="Все виды" loading={filtersLoading} />

        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">Период</label>
          <div className="flex gap-2 items-center">
            <input type="date" value={filters.датаОт} onChange={e => set('датаОт', e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-300">—</span>
            <input type="date" value={filters.датаДо} onChange={e => set('датаДо', e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
        <button type="button" onClick={onSubmit} disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
          {loading ? 'Загрузка…' : 'Сформировать отчёт'}
        </button>
      </div>
    </div>
  );
}
