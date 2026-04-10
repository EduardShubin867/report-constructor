/**
 * SQL Validator — programmatic guard against destructive queries.
 *
 * Defence layers:
 *   1. Strip comments before any check (hide-in-comment bypass)
 *   2. Must start with SELECT
 *   3. Keyword blocklist  (DDL, DML, EXEC, system functions, DoS, …)
 *   4. Table whitelist    (only our known tables allowed in FROM/JOIN)
 *   5. Auto-inject row limit (TOP N for mssql, LIMIT N for postgres/clickhouse)
 */

export interface ValidationResult {
  valid: true;
  sql: string;       // sanitized, ready to execute
  warnings?: string[];
}
export interface ValidationError {
  valid: false;
  error: string;
}
export type SqlValidation = ValidationResult | ValidationError;

// ─── Dialect ────────────────────────────────────────────────────────────────

export type SqlDialect = 'mssql' | 'postgres' | 'clickhouse';

export interface ValidateOptions {
  /** Tables allowed in FROM / JOIN. Defaults to ALLOWED_TABLES from schema. */
  allowedTables?: Set<string>;
  /** SQL dialect — controls row-limit injection syntax. Defaults to 'mssql'. */
  dialect?: SqlDialect;
  /** Maximum rows before auto-limit kicks in. Defaults to 5 000. */
  maxRows?: number;
  /**
   * When true, do not inject TOP / LIMIT (user accepts full result size and query timeout risk).
   */
  skipAutoRowLimit?: boolean;
}

// ─── Default allowed tables (derived from schema) ───────────────────────────

import { ALLOWED_TABLES } from './schema';
export { ALLOWED_TABLES } from './schema';

// ─── Forbidden patterns (checked on comment-stripped SQL) ────────────────────

interface ForbiddenRule {
  pattern: RegExp;
  reason: string;
}

const FORBIDDEN: ForbiddenRule[] = [
  // DDL
  { pattern: /\bDROP\b/i,                  reason: 'DROP запрещён' },
  { pattern: /\bCREATE\b/i,                reason: 'CREATE запрещён' },
  { pattern: /\bALTER\b/i,                 reason: 'ALTER запрещён' },
  { pattern: /\bTRUNCATE\b/i,              reason: 'TRUNCATE запрещён' },
  { pattern: /\bRENAME\b/i,                reason: 'RENAME запрещён' },
  // DML
  { pattern: /\bINSERT\b/i,                reason: 'INSERT запрещён' },
  { pattern: /\bUPDATE\b/i,                reason: 'UPDATE запрещён' },
  { pattern: /\bDELETE\b/i,                reason: 'DELETE запрещён' },
  { pattern: /\bMERGE\b/i,                 reason: 'MERGE запрещён' },
  // Execution
  { pattern: /\bEXEC(UTE)?\b/i,            reason: 'EXEC/EXECUTE запрещён' },
  { pattern: /\bxp_\w+/i,                  reason: 'Расширенные процедуры xp_ запрещены' },
  { pattern: /\bsp_\w+/i,                  reason: 'Системные процедуры sp_ запрещены' },
  // Bulk / external data
  { pattern: /\b(OPENROWSET|OPENDATASOURCE|OPENQUERY)\b/i,
                                            reason: 'Внешние источники данных запрещены' },
  { pattern: /\bBULK\s+INSERT\b/i,         reason: 'BULK INSERT запрещён' },
  // DCL
  { pattern: /\b(GRANT|REVOKE|DENY)\b/i,   reason: 'DCL-операции запрещены' },
  // SELECT INTO (creates a table / temp table)
  { pattern: /\bINTO\s+[#\[\w\u0400-\u04FF]/i,
                                            reason: 'SELECT INTO запрещён' },
  // Diagnostics / admin
  { pattern: /\bDBCC\b/i,                  reason: 'DBCC запрещён' },
  { pattern: /\bSHUTDOWN\b/i,              reason: 'SHUTDOWN запрещён' },
  { pattern: /\bRECONFIGURE\b/i,           reason: 'RECONFIGURE запрещён' },
  { pattern: /\bWAITFOR\b/i,               reason: 'WAITFOR запрещён' },
  // System references
  { pattern: /@@\w+/,                      reason: 'Системные переменные @@ запрещены' },
  { pattern: /\bsys\s*\.\s*\w+/i,         reason: 'Системная схема sys запрещена' },
  { pattern: /\binformation_schema\s*\.\s*/i,
                                            reason: 'INFORMATION_SCHEMA запрещена' },
  // 4-part linked-server names  server.db.schema.table
  { pattern: /\w+\.\w+\.\w+\.\w+/,        reason: '4-частные имена (linked server) запрещены' },
  // Multiple statements
  { pattern: /;\s*[\w\u0400-\u04FF(]/,     reason: 'Несколько операторов запрещены' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remove -- and block comments, collapse whitespace. Used for analysis only. */
function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract table names referenced after FROM or JOIN keywords.
 * Handles: FROM [dbo].[Table], FROM dbo.Table, FROM [Table], FROM Table
 */
function extractReferencedTables(sql: string): string[] {
  const results: string[] = [];
  // Match optional schema prefix then the table name
  const re = /\b(?:FROM|JOIN)\s+(?:\[?dbo\]?\s*\.\s*)?(\[?[\w\u0400-\u04FF]+\]?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    results.push(m[1].replace(/[\[\]]/g, '')); // strip square brackets
  }
  return results;
}

// ─── Row-limit injection (dialect-aware) ────────────────────────────────────

function injectLimit(
  sql: string,
  dialect: SqlDialect,
  maxRows: number,
): { sql: string; added: boolean } {
  switch (dialect) {
    case 'mssql': {
      const hasTop  = /\bSELECT\s+TOP\s+\d+\b/i.test(sql);
      const hasFetch = /\bFETCH\s+NEXT\b/i.test(sql);
      if (hasTop || hasFetch) return { sql, added: false };
      return {
        sql: sql.replace(/\bSELECT\b/i, `SELECT TOP ${maxRows}`),
        added: true,
      };
    }
    case 'postgres':
    case 'clickhouse': {
      if (/\bLIMIT\s+\d+\b/i.test(sql)) return { sql, added: false };
      return { sql: `${sql} LIMIT ${maxRows}`, added: true };
    }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function validateSql(rawSql: string, options?: ValidateOptions): SqlValidation {
  const {
    allowedTables = ALLOWED_TABLES,
    dialect = 'mssql',
    maxRows = 5_000,
    skipAutoRowLimit = false,
  } = options ?? {};

  if (!rawSql?.trim()) {
    return { valid: false, error: 'Запрос не может быть пустым' };
  }

  // Layer 1 — strip comments for analysis
  const stripped = stripComments(rawSql);

  // Layer 2 — must start with SELECT
  if (!/^SELECT\b/i.test(stripped)) {
    return { valid: false, error: 'Запрос должен начинаться с SELECT' };
  }

  // Layer 3 — keyword blocklist
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(stripped)) {
      return { valid: false, error: reason };
    }
  }

  // Layer 4 — table whitelist
  const tables = extractReferencedTables(stripped);
  const forbidden = tables.filter(t => !allowedTables.has(t));
  if (forbidden.length > 0) {
    return {
      valid: false,
      error: `Недопустимые таблицы в запросе: ${forbidden.join(', ')}. Разрешены только: ${[...allowedTables].join(', ')}`,
    };
  }

  // Layer 5 — inject row limit, collect warnings
  const warnings: string[] = [];
  let sqlOut = stripped;
  if (!skipAutoRowLimit) {
    const { sql: limited, added } = injectLimit(stripped, dialect, maxRows);
    sqlOut = limited;
    if (added) {
      const limitLabel = dialect === 'mssql' ? `TOP ${maxRows}` : `LIMIT ${maxRows}`;
      warnings.push(`Автоматически добавлено ограничение ${limitLabel}`);
    }
  }

  return { valid: true, sql: sqlOut, ...(warnings.length ? { warnings } : {}) };
}
