import { POST } from '@/app/api/report/route';
import { getPool, queryWithTimeout } from '@/lib/db';
import {
  buildGenericSelectAndJoins,
  buildGenericWhere,
  buildGroupedSelectAndJoins,
  safeColumns,
  safeDetailSortColumn,
  safeGroupedSortColumn,
} from '@/lib/query-builder';
import { getDataSources, getManualReportSources } from '@/lib/schema';
import { getSourceTableRef } from '@/lib/visible-columns';
import { createJsonRequest } from '../helpers/next-request';
import { createMockPool } from '../helpers/mock-sql-request';
import { MOCK_SOURCE, MOCK_SOURCE_ID } from '../helpers/report-route-fixtures';

jest.mock('@/lib/db', () => ({
  TIMEOUT: {
    REPORT: 30_000,
  },
  getPool: jest.fn(),
  queryWithTimeout: jest.fn(),
  sql: {
    Int: 'Int',
  },
}));

jest.mock('@/lib/query-builder', () => ({
  CONTRACT_COUNT_COLUMN_KEY: 'КоличествоДоговоров',
  buildGenericSelectAndJoins: jest.fn(),
  buildGenericWhere: jest.fn(),
  buildGroupedSelectAndJoins: jest.fn(),
  safeColumns: jest.fn(),
  safeDetailSortColumn: jest.fn(),
  safeGroupedSortColumn: jest.fn(),
}));

jest.mock('@/lib/schema', () => ({
  getDataSources: jest.fn(),
  getManualReportSources: jest.fn(),
}));

jest.mock('@/lib/visible-columns', () => ({
  getSourceJoinDefs: jest.fn(),
  getSourceTableRef: jest.fn(),
}));

describe('/api/report POST', () => {
  const mockedGetPool = jest.mocked(getPool);
  const mockedQueryWithTimeout = jest.mocked(queryWithTimeout);
  const mockedBuildGenericSelectAndJoins = jest.mocked(buildGenericSelectAndJoins);
  const mockedBuildGenericWhere = jest.mocked(buildGenericWhere);
  const mockedBuildGroupedSelectAndJoins = jest.mocked(buildGroupedSelectAndJoins);
  const mockedSafeColumns = jest.mocked(safeColumns);
  const mockedSafeDetailSortColumn = jest.mocked(safeDetailSortColumn);
  const mockedSafeGroupedSortColumn = jest.mocked(safeGroupedSortColumn);
  const mockedGetDataSources = jest.mocked(getDataSources);
  const mockedGetManualReportSources = jest.mocked(getManualReportSources);
  const mockedGetSourceTableRef = jest.mocked(getSourceTableRef);

  beforeEach(() => {
    mockedGetDataSources.mockReset().mockReturnValue([MOCK_SOURCE]);
    mockedGetManualReportSources.mockReset().mockReturnValue([MOCK_SOURCE]);
    mockedGetSourceTableRef.mockReset().mockReturnValue('[dbo].[Main] m');
    mockedBuildGenericWhere.mockReset().mockReturnValue('WHERE 1 = 1');
    mockedBuildGenericSelectAndJoins.mockReset().mockReturnValue({
      joins: '',
      select: 'm.[ID], m.[Агент], m.[Премия]',
    });
    mockedBuildGroupedSelectAndJoins.mockReset().mockReturnValue({
      joins: '',
      select: 'm.[Агент], SUM(m.[Премия]) AS [Премия]',
      groupByClause: 'GROUP BY m.[Агент]',
    });
    mockedSafeColumns.mockReset();
    mockedSafeDetailSortColumn.mockReset().mockReturnValue(null);
    mockedSafeGroupedSortColumn.mockReset().mockReturnValue(null);
    mockedQueryWithTimeout.mockReset();
    mockedGetPool.mockReset();
  });

  it('returns 400 when the requested source is missing', async () => {
    mockedGetDataSources.mockReturnValue([]);
    mockedGetManualReportSources.mockReturnValue([]);

    const response = await POST(
      createJsonRequest('/api/report', {
        body: { sourceId: 'missing', columns: ['Агент'], filters: {} },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Источник не найден' });
  });

  it('returns 400 when no safe columns remain after validation', async () => {
    mockedSafeColumns.mockReturnValueOnce([]);

    const response = await POST(
      createJsonRequest('/api/report', {
        body: { sourceId: MOCK_SOURCE_ID, columns: ['__bad__'], filters: {} },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Не выбраны колонки' });
  });

  it('builds detail reports with date fallback sorting and paginated params', async () => {
    const { pool, requests } = createMockPool();
    mockedGetPool.mockResolvedValue(pool as never);
    mockedSafeColumns.mockReturnValueOnce(['Агент', 'Премия']).mockReturnValueOnce([]);
    mockedQueryWithTimeout
      .mockResolvedValueOnce({ recordset: [{ total: 120 }] } as never)
      .mockResolvedValueOnce({ recordset: [{ ID: '1', Агент: 'Альфа', Премия: 1000 }] } as never);

    const response = await POST(
      createJsonRequest('/api/report', {
        body: {
          sourceId: MOCK_SOURCE_ID,
          columns: ['Агент', 'Премия'],
          filters: { Агент: ['Альфа'] },
          page: 2,
          pageSize: 50,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ ID: '1', Агент: 'Альфа', Премия: 1000 }],
      page: 2,
      pageSize: 50,
      total: 120,
    });
    expect(mockedQueryWithTimeout).toHaveBeenNthCalledWith(
      1,
      requests[0],
      expect.stringContaining('SELECT COUNT(*) AS total FROM [dbo].[Main] m WHERE 1 = 1'),
      30_000,
    );
    expect(mockedQueryWithTimeout).toHaveBeenNthCalledWith(
      2,
      requests[1],
      expect.stringContaining('ORDER BY m.[ДатаЗаключения] DESC'),
      30_000,
    );
    expect(mockedQueryWithTimeout.mock.calls[1]?.[1]).toContain('OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY');
    expect(requests[1].inputs).toEqual([
      { name: 'offset', type: 'Int', value: 50 },
      { name: 'pageSize', type: 'Int', value: 50 },
    ]);
  });

  it('builds grouped reports and falls back to the first grouping column for sorting', async () => {
    const { pool, requests } = createMockPool();
    mockedGetPool.mockResolvedValue(pool as never);
    mockedSafeColumns.mockReturnValueOnce(['Агент', 'Премия']).mockReturnValueOnce(['Агент']);
    mockedQueryWithTimeout
      .mockResolvedValueOnce({ recordset: [{ total: 3 }] } as never)
      .mockResolvedValueOnce({ recordset: [{ Агент: 'Альфа', Премия: 2500 }] } as never);

    const response = await POST(
      createJsonRequest('/api/report', {
        body: {
          sourceId: MOCK_SOURCE_ID,
          columns: ['Агент', 'Премия'],
          filters: {},
          groupBy: ['Агент'],
          includeContractCount: false,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ Агент: 'Альфа', Премия: 2500 }],
      page: 1,
      pageSize: 100,
      total: 3,
    });
    expect(mockedBuildGroupedSelectAndJoins).toHaveBeenCalledWith(
      ['Агент', 'Премия'],
      ['Агент'],
      MOCK_SOURCE_ID,
      { includeContractCount: false },
    );
    expect(mockedQueryWithTimeout.mock.calls[1]?.[1]).toContain('GROUP BY m.[Агент]');
    expect(mockedQueryWithTimeout.mock.calls[1]?.[1]).toContain('ORDER BY [Агент]');
    expect(requests[1].inputs).toEqual([
      { name: 'offset', type: 'Int', value: 0 },
      { name: 'pageSize', type: 'Int', value: 100 },
    ]);
  });

  it('uses safe explicit detail sorting when available', async () => {
    const { pool } = createMockPool();
    mockedGetPool.mockResolvedValue(pool as never);
    mockedSafeColumns.mockReturnValueOnce(['Агент', 'Премия']).mockReturnValueOnce([]);
    mockedSafeDetailSortColumn.mockReturnValue('Премия');
    mockedQueryWithTimeout
      .mockResolvedValueOnce({ recordset: [{ total: 1 }] } as never)
      .mockResolvedValueOnce({ recordset: [{ ID: '2', Агент: 'Бета', Премия: 5000 }] } as never);

    const response = await POST(
      createJsonRequest('/api/report', {
        body: {
          sourceId: MOCK_SOURCE_ID,
          columns: ['Агент', 'Премия'],
          filters: {},
          sortColumn: 'Премия',
          sortDirection: 'desc',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockedQueryWithTimeout.mock.calls[1]?.[1]).toContain('ORDER BY [Премия] DESC');
  });
});
