import { sql } from './db';
import { JOINS } from './report-columns';
import { getVisibleColumnDefs, getVisibleColumnKeys } from './visible-columns';

export interface ReportFilters {
  агент?: string[];
  регион?: string[];
  видДоговора?: string[];
  датаОт?: string;
  датаДо?: string;
  территория?: string[];
  дг?: string[];
  крм?: string[];
  крп?: string[];
  columns: string[];
  page?: number;
  pageSize?: number;
}

/** Validate and return allowed column keys — hidden columns are rejected */
export function safeColumns(requested: string[]): string[] {
  const visible = getVisibleColumnKeys();
  return requested.filter(c => visible.has(c));
}

/**
 * Adds WHERE parameters to a mssql Request and returns the WHERE clause string.
 * Main table is aliased as `m`.
 * Reference table filters use subqueries — no JOINs required for counting.
 */
export function buildWhere(req: sql.Request, filters: ReportFilters): string {
  const conditions: string[] = [];

  if (filters.агент?.length) {
    const params = filters.агент.map((v, i) => {
      req.input(`агент${i}`, sql.NVarChar, v);
      return `@агент${i}`;
    });
    conditions.push(`m.[Агент] IN (${params.join(',')})`);
  }

  if (filters.регион?.length) {
    const params = filters.регион.map((v, i) => {
      req.input(`регион${i}`, sql.NVarChar, v);
      return `@регион${i}`;
    });
    conditions.push(`m.[Регион] IN (${params.join(',')})`);
  }

  if (filters.видДоговора?.length) {
    const params = filters.видДоговора.map((v, i) => {
      req.input(`вид${i}`, sql.NVarChar, v);
      return `@вид${i}`;
    });
    conditions.push(`m.[ВидДоговора] IN (${params.join(',')})`);
  }

  if (filters.датаОт) {
    req.input('датаОт', sql.Date, new Date(filters.датаОт));
    conditions.push('CAST(m.[ДатаЗаключения] AS DATE) >= @датаОт');
  }

  if (filters.датаДо) {
    req.input('датаДо', sql.Date, new Date(filters.датаДо));
    conditions.push('CAST(m.[ДатаЗаключения] AS DATE) <= @датаДо');
  }

  if (filters.территория?.length) {
    const params = filters.территория.map((v, i) => {
      req.input(`терр${i}`, sql.NVarChar, v);
      return `@терр${i}`;
    });
    conditions.push(
      `m.[ID_ТерриторияИспользованияТС] IN (SELECT [ID] FROM [dbo].[Территории] WHERE [Наименование] IN (${params.join(',')}))`
    );
  }

  if (filters.дг?.length) {
    const params = filters.дг.map((v, i) => {
      req.input(`дг${i}`, sql.NVarChar, v);
      return `@дг${i}`;
    });
    conditions.push(
      `m.[ID_ДГ] IN (SELECT [Код] FROM [dbo].[ДГ] WHERE [Наименование] IN (${params.join(',')}))`
    );
  }

  if (filters.крм?.length) {
    const params = filters.крм.map((v, i) => {
      req.input(`крм${i}`, sql.Int, parseInt(v, 10));
      return `@крм${i}`;
    });
    conditions.push(
      `m.[ID_КРМ] IN (SELECT [ID] FROM [dbo].[КРМ] WHERE [КРМ] IN (${params.join(',')}))`
    );
  }

  if (filters.крп?.length) {
    const params = filters.крп.map((v, i) => {
      req.input(`крп${i}`, sql.Int, parseInt(v, 10));
      return `@крп${i}`;
    });
    conditions.push(
      `m.[ID_КРП] IN (SELECT [ID] FROM [dbo].[КРП] WHERE [КРП] IN (${params.join(',')}))`
    );
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Builds the SELECT clause and required LEFT JOINs for the given column keys.
 * Returns SELECT expressions (without "SELECT") and JOIN clauses.
 */
export function buildSelectAndJoins(cols: string[]): { select: string; joins: string } {
  const allDefs = getVisibleColumnDefs();
  const colDefs = cols.map(k => allDefs.find(c => c.key === k)!).filter(Boolean);

  const neededJoinKeys = new Set(colDefs.filter(c => c.joinKey).map(c => c.joinKey!));
  const joinClauses = [...neededJoinKeys].map(k => JOINS[k].sql).join('\n');

  const selectParts = [
    'm.[ID]',
    ...colDefs.map(col =>
      col.sqlExpr
        ? `${col.sqlExpr} AS [${col.key}]`
        : `m.[${col.key}]`
    ),
  ];

  return { select: selectParts.join(', '), joins: joinClauses };
}
