import { Calendar, Play } from 'lucide-react';
import AppSelect from '@/components/ui/app-select';
import { DatePicker } from '@/components/ui/date-picker';
import type { SourceLink } from '@/lib/schema';
import { NO_AGGREGATION_VALUE } from './constants';

export function SettingsBar({
  aggregateByColumnKey,
  setAggregateByColumnKey,
  aggregateAppSelectOptions,
  raiseMergedRowLimit,
  setRaiseMergedRowLimit,
  raiseSourceRowLimit,
  setRaiseSourceRowLimit,
  fullyUnlimitedRows,
  setFullyUnlimitedRows,
  linkedReportAllowUnlimited,
  sharedPeriodLink,
  sharedPeriod,
  onSharedPeriodChange,
  onRun,
  canRun,
  runLoading,
}: {
  aggregateByColumnKey: string;
  setAggregateByColumnKey: (v: string) => void;
  aggregateAppSelectOptions: { value: string; label: string }[];
  raiseMergedRowLimit: boolean;
  setRaiseMergedRowLimit: (v: boolean) => void;
  raiseSourceRowLimit: boolean;
  setRaiseSourceRowLimit: (v: boolean) => void;
  fullyUnlimitedRows: boolean;
  setFullyUnlimitedRows: (v: boolean) => void;
  linkedReportAllowUnlimited: boolean;
  sharedPeriodLink: NonNullable<SourceLink['sharedPeriodLink']> | null;
  sharedPeriod: { from: string; to: string };
  onSharedPeriodChange: (period: { from: string; to: string }) => void;
  onRun: () => void;
  canRun: boolean;
  runLoading: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-outline-variant/12 bg-surface-container-lowest/50 px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
      {sharedPeriodLink && (
        <>
          <div className="flex items-center gap-2">
            <Calendar
              className="h-3.5 w-3.5 flex-shrink-0 text-on-surface-variant/50"
              strokeWidth={2}
            />
            <span className="whitespace-nowrap text-xs text-on-surface-variant">
              {sharedPeriodLink.label}:
            </span>
            <DatePicker
              value={sharedPeriod.from}
              onChange={v => onSharedPeriodChange({ ...sharedPeriod, from: v })}
              placeholder="С даты"
            />
            <span className="text-xs text-on-surface-variant">—</span>
            <DatePicker
              value={sharedPeriod.to}
              onChange={v => onSharedPeriodChange({ ...sharedPeriod, to: v })}
              placeholder="По дату"
            />
          </div>
          <div className="h-4 w-px flex-shrink-0 bg-outline-variant/20" />
        </>
      )}

      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap text-xs text-on-surface-variant">Группировка:</span>
        <AppSelect
          value={aggregateByColumnKey || NO_AGGREGATION_VALUE}
          onValueChange={v => setAggregateByColumnKey(v === NO_AGGREGATION_VALUE ? '' : v)}
          options={aggregateAppSelectOptions}
          placeholder="Без группировки"
          triggerClassName="h-7 min-w-[180px] rounded-lg border border-outline-variant/20 bg-surface px-2.5 text-xs text-on-surface focus:border-primary/40"
          contentClassName="max-w-[min(42rem,calc(100vw-2rem))]"
          itemClassName="items-start py-2 whitespace-normal"
          ariaLabel="Группировка результата"
        />
      </div>

      <div className="h-4 w-px flex-shrink-0 bg-outline-variant/20" />

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={raiseMergedRowLimit}
            disabled={fullyUnlimitedRows}
            onChange={e => {
              setRaiseMergedRowLimit(e.target.checked);
              if (e.target.checked) setFullyUnlimitedRows(false);
            }}
            className="h-3.5 w-3.5 rounded accent-primary disabled:opacity-40"
          />
          <span>Без лимита 5k строк</span>
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={raiseSourceRowLimit}
            disabled={fullyUnlimitedRows}
            onChange={e => {
              setRaiseSourceRowLimit(e.target.checked);
              if (e.target.checked) setFullyUnlimitedRows(false);
            }}
            className="h-3.5 w-3.5 rounded accent-primary disabled:opacity-40"
          />
          <span>Без лимита 1k/источник</span>
        </label>
        {linkedReportAllowUnlimited && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              checked={fullyUnlimitedRows}
              onChange={e => {
                const v = e.target.checked;
                setFullyUnlimitedRows(v);
                if (v) {
                  setRaiseMergedRowLimit(false);
                  setRaiseSourceRowLimit(false);
                }
              }}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span>Без лимитов</span>
          </label>
        )}
      </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={!canRun || runLoading}
        className="ui-button-primary flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="h-3.5 w-3.5" strokeWidth={2.2} />
        {runLoading ? 'Загрузка…' : 'Выполнить'}
      </button>
    </div>
  );
}
