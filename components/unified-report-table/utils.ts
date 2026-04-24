import type { ReportColumn } from './types';

export function formatValue(value: unknown, type?: string, integer?: boolean): string {
  if (value === null || value === undefined) return '';
  if (type === 'date' && typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ru-RU');
  }
  if (type === 'number' && integer) {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    return Math.round(n).toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  if (type === 'number' && typeof value === 'number') {
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('ru-RU')
      : value.toLocaleString('ru-RU', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('ru-RU');
  }
  return String(value);
}

export function stableGroupKey(value: unknown): string {
  if (value == null) return '\0__null__';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function pluralRecords(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'запись';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'записи';
  return 'записей';
}

export function computePageNumbers(totalPages: number, currentPage: number): number[] {
  const pages: number[] = [];
  const maxVisible = 7;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (currentPage <= 4) {
    for (let i = 1; i <= maxVisible; i++) pages.push(i);
  } else if (currentPage >= totalPages - 3) {
    for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
  } else {
    for (let i = currentPage - 3; i <= currentPage + 3; i++) pages.push(i);
  }
  return pages;
}

export function buildNumericKeysSet(
  displayColumns: ReportColumn[],
  data: Record<string, unknown>[],
): Set<string> {
  const set = new Set<string>();
  for (const col of displayColumns) {
    if (col.type === 'number') {
      set.add(col.key);
    } else if (!col.type) {
      const sample = data.find(r => r[col.key] !== null && r[col.key] !== undefined);
      if (typeof sample?.[col.key] === 'number') set.add(col.key);
    }
  }
  return set;
}
