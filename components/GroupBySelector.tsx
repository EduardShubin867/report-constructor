'use client';

import { ChevronDown, Layers } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@/lib/report-columns';

const PREVIEW_LIMIT = 6;

interface GroupBySelectorProps {
  /** Currently selected group-by column keys */
  groupBy: string[];
  onChange: (cols: string[]) => void;
  /** Измерения: основная таблица + поля FK (см. groupByFields в схеме источника). */
  availableColumns: ColumnDef[];
}

export default function GroupBySelector({ groupBy, onChange, availableColumns }: GroupBySelectorProps) {
  const [open, setOpen] = useState(false);
  const isActive = groupBy.length > 0;
  const selectedDefs = availableColumns.filter(col => groupBy.includes(col.key));
  const selectedPreview = selectedDefs.slice(0, 5);
  const previewColumns = availableColumns.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, availableColumns.length - previewColumns.length);

  function toggle(key: string) {
    if (groupBy.includes(key)) {
      onChange(groupBy.filter(k => k !== key));
    } else {
      onChange([...groupBy, key]);
    }
  }

  function toggleOpen() {
    setOpen(value => !value);
  }

  function renderGroupCard(col: ColumnDef) {
    return (
      <label
        key={col.key}
        className={`flex cursor-pointer items-start gap-3 rounded-[20px] border px-3 py-3 transition-colors ${
          groupBy.includes(col.key)
            ? 'border-primary/25 bg-primary-fixed/72 shadow-[0_10px_24px_rgba(52,92,150,0.08)]'
            : 'border-outline-variant/12 bg-surface-container-lowest/78 hover:bg-surface-container-low/60'
        }`}
      >
        <input
          type="checkbox"
          checked={groupBy.includes(col.key)}
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
    <div className={`ui-panel overflow-hidden rounded-[28px] transition-colors ${isActive ? 'ring-1 ring-primary/20' : ''}`}>
      <div className="border-b border-outline-variant/10 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                Группировка
              </span>
              <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                {isActive
                  ? `${groupBy.length} ${
                      groupBy.length === 1 ? 'поле' : groupBy.length < 5 ? 'поля' : 'полей'
                    } выбрано`
                  : 'без разбивки'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 shrink-0 text-on-surface-variant" strokeWidth={2.1} />
              <div>
                <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface sm:text-xl">
                  Как разбить результат
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-on-surface-variant">
                  Если нужен срез по агентам, регионам или другим признакам, выберите поля для группировки. Сначала показываем только несколько первых вариантов.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="ui-button-ghost rounded-xl px-3 py-2 text-xs text-on-surface-variant"
              >
                Сбросить
              </button>
            ) : null}
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
            {groupBy.length > selectedPreview.length ? (
              <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                +{groupBy.length - selectedPreview.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {availableColumns.length === 0 ? (
        <p className="px-5 py-5 text-sm leading-6 text-on-surface-variant sm:px-6">
          Для группировки здесь пока нет подходящих полей.
        </p>
      ) : (
        <div className="px-5 py-5 sm:px-6">
          {!open ? (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
                {previewColumns.map(renderGroupCard)}
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-outline-variant/12 bg-surface-container-low/45 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-on-surface-variant">
                  {hiddenCount > 0
                    ? `Ещё ${hiddenCount} ${hiddenCount === 1 ? 'поле' : hiddenCount < 5 ? 'поля' : 'полей'} доступны в полном списке.`
                    : 'Это все поля, по которым можно разбить результат.'}
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
              {availableColumns.map(renderGroupCard)}
            </div>
          )}

          <div className="mt-4 rounded-[22px] border border-outline-variant/12 bg-surface-container-low/45 p-3">
            <p className="text-xs leading-5 text-on-surface-variant">
              {isActive
                ? 'Числовые показатели посчитаются внутри каждой группы. Если нужно, рядом можно показать и количество договоров.'
                : 'Если группировка не нужна, таблица останется обычным списком строк без разбивки.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
