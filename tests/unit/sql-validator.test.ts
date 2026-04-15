import { ALLOWED_TABLES, validateSql } from '@/lib/sql-validator';

function getAllowedTable(): string {
  const table = [...ALLOWED_TABLES][0];
  if (!table) {
    throw new Error('Expected at least one allowed table from the schema');
  }
  return table;
}

describe('validateSql', () => {
  it('accepts valid SELECT queries and injects TOP for MSSQL', () => {
    const table = getAllowedTable();
    const result = validateSql(`SELECT VIN FROM [${table}]`);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.sql).toBe(`SELECT TOP 5000 VIN FROM [${table}]`);
    expect(result.warnings).toContain('Автоматически добавлено ограничение TOP 5000');
  });

  it('strips comments before analysis without flagging comment text as dangerous SQL', () => {
    const table = getAllowedTable();
    const result = validateSql(`
      SELECT VIN
      FROM [${table}]
      -- DROP TABLE dbo.Users
      /* EXEC xp_cmdshell 'dir' */
    `);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.sql).toBe(`SELECT TOP 5000 VIN FROM [${table}]`);
  });

  it('supports postgres limit injection and skipAutoRowLimit', () => {
    const table = getAllowedTable();
    const postgres = validateSql(`SELECT VIN FROM [${table}]`, {
      allowedTables: new Set([table]),
      dialect: 'postgres',
      maxRows: 10,
    });

    expect(postgres.valid).toBe(true);
    if (postgres.valid) {
      expect(postgres.sql).toBe(`SELECT VIN FROM [${table}] LIMIT 10`);
      expect(postgres.warnings).toContain('Автоматически добавлено ограничение LIMIT 10');
    }

    const skipped = validateSql(`SELECT VIN FROM [${table}]`, {
      allowedTables: new Set([table]),
      skipAutoRowLimit: true,
    });

    expect(skipped.valid).toBe(true);
    if (skipped.valid) {
      expect(skipped.sql).toBe(`SELECT VIN FROM [${table}]`);
      expect(skipped.warnings).toBeUndefined();
    }
  });

  it.each([
    ['DROP TABLE', 'DROP запрещён', 'SELECT * FROM users; DROP TABLE users'],
    ['EXEC', 'EXEC/EXECUTE запрещён', 'SELECT * FROM users EXEC xp_cmdshell'],
    ['sys schema', 'Системная схема sys запрещена', 'SELECT * FROM sys.objects'],
    ['SELECT INTO', 'SELECT INTO запрещён', 'SELECT * INTO #tmp FROM users'],
    ['multiple statements', 'Несколько операторов запрещены', 'SELECT * FROM users; SELECT * FROM logs'],
  ])('rejects %s patterns', (_label, error, sql) => {
    const result = validateSql(sql, { allowedTables: new Set(['users', 'logs']) });

    expect(result).toEqual({ valid: false, error });
  });

  it('rejects non-SELECT queries and tables outside the whitelist', () => {
    expect(validateSql('DELETE FROM users', { allowedTables: new Set(['users']) })).toEqual({
      valid: false,
      error: 'Запрос должен начинаться с SELECT',
    });

    const invalidTable = validateSql('SELECT * FROM forbidden_table', {
      allowedTables: new Set(['users']),
    });

    expect(invalidTable.valid).toBe(false);
    if (invalidTable.valid) return;

    expect(invalidTable.error).toContain('Недопустимые таблицы в запросе: forbidden_table');
    expect(invalidTable.error).toContain('Разрешены только: users');
  });
});
