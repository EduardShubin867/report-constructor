import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';
import { validateSql } from '@/lib/sql-validator';
import { getCached } from '@/lib/query-cache';

export interface QueryResult {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  warnings?: string[];
  validatedSql: string;
}

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json() as { sql: string };

    const validation = validateSql(sql);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check cache first (validate_query skill may have already executed this SQL)
    const cached = getCached(validation.sql);
    if (cached) {
      return NextResponse.json({
        data: cached.data,
        columns: cached.columns,
        rowCount: cached.data.length,
        warnings: validation.warnings,
        validatedSql: validation.sql,
      } satisfies QueryResult);
    }

    const pool = await getPool();
    const result = await queryWithTimeout(pool.request(), validation.sql, TIMEOUT.QUERY);

    const data: Record<string, unknown>[] = result.recordset;
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    return NextResponse.json({
      data,
      columns,
      rowCount: data.length,
      warnings: validation.warnings,
      validatedSql: validation.sql,
    } satisfies QueryResult);
  } catch (err) {
    console.error('Query error:', err);
    return NextResponse.json({ error: 'Ошибка выполнения запроса' }, { status: 500 });
  }
}
