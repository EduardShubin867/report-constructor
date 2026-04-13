'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ALL_COLUMNS, type ColumnDef } from '@/lib/report-columns';

const PREVIEW_LIMIT = 6;

interface ColumnSelectorProps {
  selected: string[];
  onChange: (cols: string[]) => void;
  /** Override the column list (e.g. server-filtered visible columns). Defaults to ALL_COLUMNS. */
  columns?: ColumnDef[];
  /** При активной группировке — опция колонки COUNT договоров. */
  groupByActive?: boolean;
  showContractCount?: boolean;
  onShowContractCountChange?: (value: boolean) => void;
}

export default function ColumnSelector({
  selected,
  onChange,
  columns,
  groupByActive = false,
  showContractCount = true,
  onShowContractCountChange,
}: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const cols = columns ?? ALL_COLUMNS;
  const selectedDefs = cols.filter(col => selected.includes(col.key));
  const selectedPreview = selectedDefs.slice(0, 5);
  const previewCols = cols.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, cols.length - previewCols.length);

  const filtered = search.trim()
    ? cols.filter(
        c =>
          c.label.toLowerCase().includes(search.toLowerCase()) ||
          c.key.toLowerCase().includes(search.toLowerCase()),
      )
    : cols;

  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  function toggleOpen() {
    if (open) setSearch('');
    setOpen(value => !value);
  }

  function renderColumnCard(col: ColumnDef) {
    return (
      <label
        key={col.key}
        className={`flex cursor-pointer items-start gap-3 rounded-[20px] border px-3 py-3 transition-colors ${
          selected.includes(col.key)
            ? 'border-primary/25 bg-primary-fixed/72 shadow-[0_10px_24px_rgba(52,92,150,0.08)]'
            : 'border-outline-variant/12 bg-surface-container-lowest/78 hover:bg-surface-container-low/60'
        }`}
      >
        <input
          type="checkbox"
          checked={selected.includes(col.key)}
          onChange={() => toggle(col.key)}
          className="mt-0.5 shrink-0 accent-primary"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-on-surface" title={col.label}>
            {col.label}
          </span>
          <span className="mt-1 block truncate text-[11px] text-on-surface-variant">
            {col.key}
          </span>
        </span>
      </label>
    );
  }

  return (
    <div className="ui-panel overflow-hidden rounded-[28px]">
      <div className="border-b border-outline-variant/10 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                Колонки
              </span>
              <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                {selected.length} из {cols.length}
              </span>
            </div>
            <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface sm:text-xl">
              Какие колонки нужны
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-on-surface-variant">
              Оставьте только те поля, которые действительно хотите видеть в таблице. Сначала показываем самые частые варианты, а полный список можно раскрыть.
            </p>

            {selectedPreview.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedPreview.map(col => (
                  <span
                    key={col.key}
                    className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                  >
                    {col.label}
                  </span>
                ))}
                {selectedDefs.length > selectedPreview.length ? (
                  <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                    +{selectedDefs.length - selectedPreview.length}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={toggleOpen}
            className="ui-button-ghost inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-on-surface-variant"
          >
            {open ? 'Свернуть' : 'Показать все'}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {!open ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
              {previewCols.map(renderColumnCard)}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-outline-variant/12 bg-surface-container-low/45 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-on-surface-variant">
                {hiddenCount > 0
                  ? `Ещё ${hiddenCount} ${hiddenCount === 1 ? 'поле' : hiddenCount < 5 ? 'поля' : 'полей'} спрятано в полном списке.`
                  : 'Это все доступные поля.'}
              </p>
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={toggleOpen}
                  className="ui-button-secondary rounded-xl px-3 py-2 text-xs font-medium"
                >
                  Открыть полный список
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Найти колонку"
                className="ui-field h-10 flex-1 rounded-xl px-3 text-sm placeholder:text-on-surface-variant/50 focus:border-primary/50 focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="ui-button-ghost rounded-xl px-3 py-2 text-xs font-medium text-primary"
                  onClick={() => {
                    const keys = filtered.map(c => c.key);
                    const allSelected = keys.every(k => selected.includes(k));
                    if (allSelected) {
                      onChange(selected.filter(k => !keys.includes(k)));
                    } else {
                      onChange([...new Set([...selected, ...keys])]);
                    }
                  }}
                >
                  {filtered.length > 0 && filtered.every(c => selected.includes(c.key))
                    ? 'Снять видимые'
                    : 'Выбрать видимые'}
                </button>
                <button
                  type="button"
                  className="ui-button-ghost rounded-xl px-3 py-2 text-xs"
                  onClick={() => onChange([])}
                >
                  Очистить выбор
                </button>
              </div>
            </div>

            {selectedDefs.length > 0 ? (
              <div className="mb-4 rounded-[22px] border border-outline-variant/12 bg-surface-container-low/45 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Уже в таблице
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDefs.slice(0, 8).map(col => (
                    <span
                      key={col.key}
                      className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                    >
                      {col.label}
                    </span>
                  ))}
                  {selectedDefs.length > 8 ? (
                    <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                      +{selectedDefs.length - 8}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {filtered.length === 0 ? (
              <p className="rounded-[22px] border border-dashed border-outline-variant/20 py-8 text-center text-sm text-on-surface-variant">
                По этому запросу ничего не нашлось.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
                {filtered.map(renderColumnCard)}
              </div>
            )}
          </>
        )}

        {groupByActive && onShowContractCountChange ? (
          <div className="mt-4 rounded-[22px] border border-outline-variant/12 bg-surface-container-low/45 p-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={showContractCount}
                onChange={e => onShowContractCountChange(e.target.checked)}
                className="mt-1 shrink-0 accent-primary"
              />
              <span>
                <span className="block font-medium">Добавить колонку «Кол-во договоров»</span>
                <span className="mt-1 block text-xs leading-5 text-on-surface-variant">
                  Полезно, если отчёт разбит по группам и вы хотите сразу видеть объём внутри каждой из них.
                </span>
              </span>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
