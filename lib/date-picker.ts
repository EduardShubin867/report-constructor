import { format } from 'date-fns';

const DATE_VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateValue(value?: string | null): Date | undefined {
  if (!value) return undefined;

  const match = DATE_VALUE_RE.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (Number.isNaN(date.getTime())) return undefined;
  if (date.getFullYear() !== year) return undefined;
  if (date.getMonth() !== monthIndex) return undefined;
  if (date.getDate() !== day) return undefined;

  return date;
}

export function formatDateValue(date?: Date | null): string {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDateLabel(value?: string | null): string {
  const date = parseDateValue(value);
  return date ? format(date, 'dd.MM.yyyy') : '';
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getTodayDateValue(date = new Date()): string {
  return formatDateValue(startOfDay(date));
}
