'use client';

import { useEffect, useMemo, useState } from 'react';
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
  parseManualDateInput,
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

function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let result = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += '.';
    result += digits[i];
  }
  return result;
}

export function DatePicker({
  value = '',
  onChange,
  placeholder = 'дд.мм.гггг',
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

  const [inputText, setInputText] = useState(() => formatDateLabel(value));
  const [inputError, setInputError] = useState(false);
  const [month, setMonth] = useState<Date | undefined>(defaultMonth);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setInputText(formatDateLabel(value));
      setInputError(false);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    if (!open || !selected) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMonth(selected);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selected]);

  function tryCommit(text: string) {
    const raw = text.trim();
    if (!raw) {
      setInputError(false);
      onChange('');
      return;
    }
    const parsed = parseManualDateInput(raw);
    if (!parsed) {
      setInputError(true);
      return;
    }
    if (normalizedMaxDate) {
      const parsedDate = parseDateValue(parsed);
      if (parsedDate && parsedDate.getTime() > normalizedMaxDate.getTime()) {
        setInputError(true);
        return;
      }
    }
    setInputError(false);
    onChange(parsed);
    const parsedDate = parseDateValue(parsed);
    if (parsedDate) setMonth(parsedDate);
  }

  function handleMaskedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyDateMask(e.target.value);
    setInputText(masked);
    setInputError(false);
    if (masked.length === 10) tryCommit(masked);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryCommit(inputText);
    } else if (e.key === 'Backspace') {
      const el = e.currentTarget;
      const pos = el.selectionStart ?? 0;
      // When cursor is right after a separator dot, skip over it
      if ((pos === 3 || pos === 6) && el.selectionEnd === pos) {
        e.preventDefault();
        el.setSelectionRange(pos - 1, pos - 1);
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          aria-disabled={disabled}
          className={cn(
            'ui-field flex h-auto w-full cursor-default items-center gap-2 rounded-xl px-3 py-2.5 text-sm',
            disabled && 'pointer-events-none opacity-50',
            inputError && 'ring-1 ring-red-400',
            buttonClassName,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-outline-variant" />
          <input
            type="text"
            inputMode="numeric"
            value={inputText}
            disabled={disabled}
            placeholder={placeholder}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onChange={handleMaskedChange}
            onKeyDown={handleKeyDown}
            onBlur={() => tryCommit(inputText)}
            className={cn(
              'min-w-0 flex-1 bg-transparent outline-none placeholder:text-on-surface-variant',
              inputError ? 'text-red-500' : 'text-on-surface',
            )}
          />
        </div>
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
          month={month ?? defaultMonth}
          onMonthChange={setMonth}
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
