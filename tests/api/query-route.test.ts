import { POST } from '@/app/api/query/route';
import { ALLOWED_TABLES } from '@/lib/sql-validator';
import { getPool, queryWithTimeout, timeoutWhenUnlimitedRows } from '@/lib/db';
import { getCached } from '@/lib/query-cache';
import { createJsonRequest, createTextRequest } from '../helpers/next-request';
import { createMockPool } from '../helpers/mock-sql-request';

jest.mock('@/lib/db', () => ({
  TIMEOUT: {
    QUERY: 15_000,
  },
  getPool: jest.fn(),
  queryWithTimeout: jest.fn(),
  timeoutWhenUnlimitedRows: jest.fn((baseMs: number, unlimited?: boolean) => (unlimited ? baseMs * 4 : baseMs)),
}));

jest.mock('@/lib/query-cache', () => ({
  getCached: jest.fn(),
}));

function getAllowedTable(): string {
  const table = [...ALLOWED_TABLES][0];
  if (!table) throw new Error('Expected at least one allowed table');
  return table;
}

describe('/api/query POST', () => {
  const mockedGetPool = jest.mocked(getPool);
  const mockedGetCached = jest.mocked(getCached);
  const mockedQueryWithTimeout = jest.mocked(queryWithTimeout);
  const mockedTimeoutWhenUnlimitedRows = jest.mocked(timeoutWhenUnlimitedRows);

  beforeEach(() => {
    mockedGetCached.mockReset();
    mockedGetPool.mockReset();
    mockedQueryWithTimeout.mockReset();
    mockedTimeoutWhenUnlimitedRows.mockReset().mockImplementation((baseMs: number, unlimited?: boolean) =>
      unlimited ? baseMs * 4 : baseMs,
    );
  });

  it('returns a server error for invalid JSON', async () => {
    const response = await POST(
      createTextRequest('/api/query', {
        body: '{invalid-json',
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Ошибка выполнения запроса' });
  });

  it('rejects empty SQL payloads', async () => {
    const response = await POST(
      createJsonRequest('/api/query', {
        body: { sql: '' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Запрос не может быть пустым' });
  });

  it('rejects destructive SQL during validation', async () => {
    const response = await POST(
      createJsonRequest('/api/query', {
        body: { sql: 'SELECT * FROM users; DROP TABLE users' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'DROP запрещён' });
  });

  it('returns cached query results without touching the database', async () => {
    const table = getAllowedTable();
    mockedGetCached.mockReturnValue({
      columns: ['VIN'],
      data: [{ VIN: 'VIN-001' }],
      savedAt: Date.now(),
      sql: `SELECT TOP 5000 VIN FROM [${table}]`,
    });

    const response = await POST(
      createJsonRequest('/api/query', {
        body: { sql: `SELECT VIN FROM [${table}]` },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      columns: ['VIN'],
      data: [{ VIN: 'VIN-001' }],
      rowCount: 1,
      validatedSql: `SELECT TOP 5000 VIN FROM [${table}]`,
      warnings: ['Автоматически добавлено ограничение TOP 5000'],
    });
    expect(mockedGetPool).not.toHaveBeenCalled();
    expect(mockedQueryWithTimeout).not.toHaveBeenCalled();
    expect(mockedTimeoutWhenUnlimitedRows).not.toHaveBeenCalled();
  });

  it('executes validated SQL against the database when cache misses', async () => {
    const table = getAllowedTable();
    const { pool, requests } = createMockPool();
    mockedGetCached.mockReturnValue(null);
    mockedGetPool.mockResolvedValue(pool as never);
    mockedQueryWithTimeout.mockResolvedValue({
      recordset: [{ VIN: 'VIN-002' }],
    } as never);

    const response = await POST(
      createJsonRequest('/api/query', {
        body: { sql: `SELECT VIN FROM [${table}]` },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      columns: ['VIN'],
      data: [{ VIN: 'VIN-002' }],
      rowCount: 1,
      validatedSql: `SELECT TOP 5000 VIN FROM [${table}]`,
      warnings: ['Автоматически добавлено ограничение TOP 5000'],
    });
    expect(mockedTimeoutWhenUnlimitedRows).toHaveBeenCalledWith(15_000, false);
    expect(mockedQueryWithTimeout).toHaveBeenCalledWith(
      requests[0],
      `SELECT TOP 5000 VIN FROM [${table}]`,
      15_000,
    );
  });

  it('returns a server error when query execution fails', async () => {
    const table = getAllowedTable();
    const { pool } = createMockPool();
    mockedGetCached.mockReturnValue(null);
    mockedGetPool.mockResolvedValue(pool as never);
    mockedQueryWithTimeout.mockRejectedValue(new Error('db down'));

    const response = await POST(
      createJsonRequest('/api/query', {
        body: { sql: `SELECT VIN FROM [${table}]` },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Ошибка выполнения запроса' });
  });
});
