import type { ColumnDef } from '@/lib/report-columns';
import {
  aggregateLinkedMergedRows,
  columnsWithAggCount,
  LINKED_AGG_COUNT_COLUMN,
} from '@/lib/linked-report-aggregate';

describe('aggregateLinkedMergedRows', () => {
  const columns: ColumnDef[] = [
    { key: '__matchKey', label: 'Связь', type: 'string' },
    { key: 'left__Агент', label: 'L: Агент', type: 'string' },
    { key: 'left__Премия', label: 'L: Премия', type: 'number' },
    { key: 'right__Сумма', label: 'R: Сумма', type: 'number' },
  ];

  it('collapses rows by group key and sums numbers', () => {
    const rows = [
      {
        __matchKey: '1',
        'left__Агент': 'Альфа',
        'left__Премия': 100,
        'right__Сумма': 50,
      },
      {
        __matchKey: '2',
        'left__Агент': 'Альфа',
        'left__Премия': 200,
        'right__Сумма': 25,
      },
    ];
    const out = aggregateLinkedMergedRows(rows, columns, 'left__Агент');
    expect(out).toHaveLength(1);
    expect(out[0]['left__Агент']).toBe('Альфа');
    expect(out[0]['left__Премия']).toBe(300);
    expect(out[0]['right__Сумма']).toBe(75);
    expect(out[0].__linkedAggCount).toBe(2);
    expect(out[0].__matchKey).toBe('1');
  });

  it('can group by match key', () => {
    const rows = [
      { __matchKey: 'X', 'left__Агент': 'A', 'left__Премия': 10, 'right__Сумма': 1 },
      { __matchKey: 'X', 'left__Агент': 'B', 'left__Премия': 20, 'right__Сумма': 2 },
    ];
    const out = aggregateLinkedMergedRows(rows, columns, '__matchKey');
    expect(out).toHaveLength(1);
    expect(out[0].__linkedAggCount).toBe(2);
    expect(out[0]['left__Премия']).toBe(30);
  });
});

describe('columnsWithAggCount', () => {
  it('appends count column once', () => {
    const base: ColumnDef[] = [{ key: 'a', label: 'A', type: 'string' }];
    const next = columnsWithAggCount(base);
    expect(next).toHaveLength(2);
    expect(next[next.length - 1]).toEqual(LINKED_AGG_COUNT_COLUMN);
    expect(columnsWithAggCount(next)).toHaveLength(2);
  });
});
