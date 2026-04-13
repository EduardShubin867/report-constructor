'use client';

import { Layers } from 'lucide-react';
import type { ColumnDef } from '@/lib/report-columns';

interface GroupBySelectorProps {
  /** Currently selected group-by column keys */
  groupBy: string[];
  onChange: (cols: string[]) => void;
  /** Only string/date columns from the current selectedColumns */
  availableColumns: ColumnDef[];
}

export default function GroupBySelector({ groupBy, onChange, availableColumns }: GroupBySelectorProps) {
  const isActive = groupBy.length > 0;

  function toggle(key: string) {
    if (groupBy.includes(key)) {
      onChange(groupBy.filter(k => k !== key));
    } else {
      onChange([...groupBy, key]);
    }
  }

  return (
    <div className={`ui-panel overflow-hidden rounded-2xl transition-colors ${isActive ? 'ring-1 ring-primary/20' : ''}`}>
      <div className="flex items-center gap-3 px-5 py-3.5">
        <Layers className="h-4 w-4 shrink-0 text-on-surface-variant" strokeWidth={2.1} />
        <span className="flex-1 text-sm font-medium text-on-surface">
          Группировка
          {isActive ? (
            <span className="ml-2 text-xs font-normal text-primary">по {groupBy.length} {groupBy.length === 1 ? 'колонке' : 'колонкам'}</span>
          ) : (
            <span className="ml-2 text-xs font-normal text-on-surface-variant">выкл.</span>
          )}
        </span>
        {isActive && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="ui-button-ghost rounded-lg px-2 py-1 text-xs text-on-surface-variant"
          >
            Сбросить
          </button>
        )}
      </div>

      {availableColumns.length === 0 ? (
        <p className="border-t border-outline-variant/10 px-5 py-3 text-xs text-on-surface-variant">
          Нет колонок с включённой группировкой. Отметьте нужные колонки как «Groupable» в настройках источника.
        </p>
      ) : (
        <div className="border-t border-outline-variant/10 px-5 py-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {availableColumns.map(col => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-on-surface transition-colors hover:bg-surface-container-low/60 hover:text-primary"
              >
                <input
                  type="checkbox"
                  checked={groupBy.includes(col.key)}
                  onChange={() => toggle(col.key)}
                  className="shrink-0 accent-primary"
                />
                <span className="truncate" title={col.label}>{col.label}</span>
              </label>
            ))}
          </div>
          {isActive && (
            <p className="mt-2.5 text-xs text-on-surface-variant">
              Числовые колонки будут просуммированы. Колонку «Кол-во договоров» можно включить в настройках колонок.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
