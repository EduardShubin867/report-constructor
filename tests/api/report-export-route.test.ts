import ExcelJS from 'exceljs';
import { POST } from '@/app/api/report/export/route';
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
import { getSourceTableRef, getVisibleColumnDefs } from '@/lib/visible-columns';
import { createJsonRequest } from '../helpers/next-request';
import { createMockPool } from '../helpers/mock-sql-request';
import { MOCK_SOURCE, MOCK_SOURCE_ID, MOCK_VISIBLE_COLUMNS } from '../helpers/report-route-fixtures';

jest.mock('@/lib/db', () => ({
  TIMEOUT: {
    EXPORT: 60_000,
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
  getSourceTableRef: jest.fn(),
  getVisibleColumnDefs: jest.fn(),
}));

async function loadWorkbook(response: Response) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  return workbook;
}

describe('/api/report/export POST', () => {
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
  const mockedGetVisibleColumnDefs = jest.mocked(getVisibleColumnDefs);

  beforeEach(() => {
    mockedGetDataSources.mockReset().mockReturnValue([MOCK_SOURCE]);
    mockedGetManualReportSources.mockReset().mockReturnValue([MOCK_SOURCE]);
    mockedGetSourceTableRef.mockReset().mockReturnValue('[dbo].[Main] m');
    mockedGetVisibleColumnDefs.mockReset().mockReturnValue(MOCK_VISIBLE_COLUMNS);
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

  it('returns 400 when no valid columns are selected', async () => {
    mockedSafeColumns.mockReturnValueOnce([]);

    const response = await POST(
      createJsonRequest('/api/report/export', {
        body: { sourceId: MOCK_SOURCE_ID, columns: ['__bad__'], filters: {} },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Не выбраны колонки' });
  });

  it('exports detail-mode workbooks with visible headers and rows', async () => {
    const { pool } = createMockPool();
    mockedGetPool.mockResolvedValue(pool as never);
    mockedSafeColumns.mockReturnValueOnce(['Агент', 'Премия']).mockReturnValueOnce([]);
    mockedQueryWithTimeout.mockResolvedValue({
      recordset: [{ ID: '1', Агент: 'Альфа', Премия: 1234.5 }],
    } as never);

    const response = await POST(
      createJsonRequest('/api/report/export', {
        body: {
          sourceId: MOCK_SOURCE_ID,
          columns: ['Агент', 'Премия'],
          filters: {},
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.headers.get('content-disposition')).toContain('attachment; filename="report_');

    const workbook = await loadWorkbook(response);
    const sheet = workbook.getWorksheet('Отчёт');

    expect(sheet).toBeDefined();
    const headers = sheet?.getRow(1).values as Array<string | undefined>;
    expect(headers).toContain('Агент');
    expect(headers).toContain('Премия');
    expect(sheet?.getCell('A2').value).toBe('Альфа');
    expect(sheet?.getCell('B2').value).toBe(1234.5);
  });

  it('exports grouped workbooks without contract count when disabled', async () => {
    const { pool } = createMockPool();
    mockedGetPool.mockResolvedValue(pool as never);
    mockedSafeColumns.mockReturnValueOnce(['Агент', 'Премия']).mockReturnValueOnce(['Агент']);
    mockedQueryWithTimeout.mockResolvedValue({
      recordset: [{ Агент: 'Альфа', Премия: 5000 }],
    } as never);

    const response = await POST(
      createJsonRequest('/api/report/export', {
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
    expect(mockedBuildGroupedSelectAndJoins).toHaveBeenCalledWith(
      ['Агент', 'Премия'],
      ['Агент'],
      MOCK_SOURCE_ID,
      { includeContractCount: false },
    );
    expect(mockedQueryWithTimeout.mock.calls[0]?.[1]).toContain('ORDER BY [Агент]');

    const workbook = await loadWorkbook(response);
    const sheet = workbook.getWorksheet('Отчёт');
    const headers = sheet?.getRow(1).values as Array<string | undefined>;

    expect(headers).toContain('Агент');
    expect(headers).toContain('Премия');
    expect(headers).not.toContain('Кол-во договоров');
    expect(sheet?.getCell('A2').value).toBe('Альфа');
  });
});
