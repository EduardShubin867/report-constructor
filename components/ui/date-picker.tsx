'use client';

import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  formatDateLabel,
  formatDateValue,
  getTodayDateValue,
  parseDateValue,
  startOfDay,
} from '@/lib/date-picker';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
  contentClassName?: string;
  maxValue?: string;
}

export function DatePicker({
  value = '',
  onChange,
  placeholder = 'Выберите дату',
  disabled,
  buttonClassName,
  contentClassName,
  maxValue = getTodayDateValue(),
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseDateValue(value), [value]);
  const maxDate = useMemo(() => parseDateValue(maxValue), [maxValue]);
  const normalizedMaxDate = useMemo(
    () => (maxDate ? startOfDay(maxDate) : undefined),
    [maxDate],
  );
  const defaultMonth = useMemo(() => {
    if (!normalizedMaxDate) return selected;
    if (!selected) return normalizedMaxDate;
    return selected.getTime() > normalizedMaxDate.getTime() ? normalizedMaxDate : selected;
  }, [normalizedMaxDate, selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className={cn(
            'ui-field h-auto w-full justify-start rounded-xl px-3 py-2.5 text-left text-sm font-normal shadow-none',
            !selected && 'text-on-surface-variant',
            buttonClassName,
          )}
        >
          <CalendarIcon className="size-4 text-outline-variant" />
          <span className="truncate">
            {selected ? formatDateLabel(value) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          'w-auto rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest p-0 shadow-[0_18px_45px_rgba(23,32,43,0.12)]',
          contentClassName,
        )}
      >
        <Calendar
          mode="single"
          locale={ru}
          selected={selected}
          defaultMonth={defaultMonth}
          disabled={normalizedMaxDate ? { after: normalizedMaxDate } : undefined}
          onSelect={date => {
            if (!date) return;
            onChange(formatDateValue(date));
            setOpen(false);
          }}
          className="rounded-[24px] bg-surface-container-lowest p-3"
        />

        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/12 px-3 py-2.5">
          <p className="text-xs text-on-surface-variant">
            {selected ? formatDateLabel(value) : 'Дата не выбрана'}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!selected}
            className="text-xs text-on-surface-variant"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            Очистить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
