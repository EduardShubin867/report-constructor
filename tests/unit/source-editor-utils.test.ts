import {
  buildGenerateWhenToUseRequest,
  normalizeSourceForSave,
} from '@/components/source-editor/utils';
import type { DataSource } from '@/lib/schema/types';

describe('source editor helpers', () => {
  it('builds the when-to-use generator request with the configured base path', () => {
    expect(
      buildGenerateWhenToUseRequest({
        id: 'osago',
        name: 'ОСАГО Маржа',
        database: 'ExportUCS',
        schema: 'dbo',
        whenToUse: 'маржинальность',
        tables: 'Журнал_ОСАГО_Маржа\n\n ДГ ',
        connectionId: 'main',
      }),
    ).toEqual({
      url: '/constructor/api/admin/sources/generate-when-to-use',
      body: {
        name: 'ОСАГО Маржа',
        draft: 'маржинальность',
        tables: ['Журнал_ОСАГО_Маржа', 'ДГ'],
      },
    });
  });

  it('updates editable metadata while preserving reviewed schema on save', () => {
    const source: DataSource = {
      id: 'osago',
      name: 'ОСАГО',
      dialect: 'mssql',
      schema: 'dbo',
      database: 'ExportUCS',
      connectionId: 'main',
      whenToUse: 'старое описание',
      tables: [
        {
          name: 'Журнал_ОСАГО_Маржа',
          alias: 'm',
          columns: [{ name: 'ID', type: 'number', filterable: true }],
        },
      ],
    };

    expect(
      normalizeSourceForSave(source, {
        id: 'osago',
        name: 'ОСАГО маржа',
        database: 'ExportUCS',
        schema: 'dbo',
        whenToUse: 'Используй для анализа маржи ОСАГО',
        tables: 'Журнал_ОСАГО_Маржа',
        connectionId: 'main',
      }),
    ).toEqual({
      ...source,
      name: 'ОСАГО маржа',
      whenToUse: 'Используй для анализа маржи ОСАГО',
      tables: [
        {
          name: 'Журнал_ОСАГО_Маржа',
          alias: 'm',
          columns: [{ name: 'ID', type: 'number' }],
        },
      ],
    });
  });
});
