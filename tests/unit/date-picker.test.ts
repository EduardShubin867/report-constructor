import {
  formatDateLabel,
  formatDateValue,
  getTodayDateValue,
  parseDateValue,
  startOfDay,
} from '@/lib/date-picker';

describe('date picker helpers', () => {
  it('round-trips local dates without timezone drift', () => {
    const value = '2026-04-16';
    const parsed = parseDateValue(value);

    expect(parsed).toBeInstanceOf(Date);
    expect(formatDateValue(parsed)).toBe(value);
  });

  it('rejects invalid or overflowing date values', () => {
    expect(parseDateValue('')).toBeUndefined();
    expect(parseDateValue('2026-02-31')).toBeUndefined();
    expect(parseDateValue('16.04.2026')).toBeUndefined();
  });

  it('formats selected dates for button labels', () => {
    expect(formatDateLabel('2026-04-16')).toBe('16.04.2026');
    expect(formatDateLabel('')).toBe('');
  });

  it('normalizes max-date helpers to the start of the current day', () => {
    const source = new Date(2026, 3, 16, 18, 45, 12);

    expect(startOfDay(source)).toEqual(new Date(2026, 3, 16));
    expect(getTodayDateValue(source)).toBe('2026-04-16');
  });
});
