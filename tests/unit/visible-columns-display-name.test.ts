import type { DataSource } from '@/lib/schema/types';

const mockedSource: DataSource = {
  id: 'custom-display-names',
  name: 'Custom display names',
  dialect: 'mssql',
  schema: 'dbo',
  tables: [
    {
      name: 'MainTable',
      alias: 'm',
      columns: [
        { name: 'ID', type: 'number' },
        { name: 'ReferenceId', type: 'number' },
      ],
      foreignKeys: [
        {
          column: 'ReferenceId',
          targetTable: 'LookupTable',
          targetColumn: 'ID',
          alias: 'lkp',
          targetFields: ['CustomField'],
          joinSql: 'LEFT JOIN [dbo].[LookupTable] AS lkp ON m.ReferenceId = lkp.ID',
        },
      ],
    },
    {
      name: 'LookupTable',
      displayName: 'Партнеры',
      columns: [],
    },
  ],
};

jest.mock('@/lib/schema', () => ({
  getDataSources: () => [mockedSource],
}));

import { getGroupByColumnDefs, getVisibleColumnDefs } from '@/lib/visible-columns';

describe('visible-columns table display names', () => {
  it('uses table displayName for joined fallback labels in UI-facing column defs', () => {
    expect(getVisibleColumnDefs('custom-display-names')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'lkp_CustomField',
          label: 'Партнеры: CustomField',
        }),
      ]),
    );

    expect(getGroupByColumnDefs('custom-display-names')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'lkp_CustomField',
          label: 'Партнеры: CustomField',
        }),
      ]),
    );
  });
});
