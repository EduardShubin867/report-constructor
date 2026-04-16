'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface AppSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  labelClassName?: string;
  ariaLabel?: string;
}

export default function AppSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Выберите значение',
  disabled = false,
  triggerClassName,
  contentClassName,
  itemClassName,
  labelClassName,
  ariaLabel,
}: AppSelectProps) {
  const hasSelected = Boolean(value) && options.some(option => option.value === value);
  const displayLabel =
    options.find(option => option.value === value)?.label ?? placeholder;

  return (
    <div className="relative">
      <Select
        value={hasSelected ? value : undefined}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn(
            'w-full [&_[data-slot=select-value]]:opacity-0',
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className={contentClassName}>
          {options.map(option => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={itemClassName}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-3 right-8 flex items-center overflow-hidden text-left',
          hasSelected ? 'text-on-surface' : 'text-on-surface-variant/70',
          labelClassName,
        )}
      >
        <span className="line-clamp-1 w-full">{displayLabel}</span>
      </span>
    </div>
  );
}
