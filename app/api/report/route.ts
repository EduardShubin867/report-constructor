import { NextRequest, NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { buildWhere, buildSelectAndJoins, safeColumns, type ReportFilters } from '@/lib/query-builder';

export type { ReportFilters };

export async function POST(request: NextRequest) {
  try {
    const body: ReportFilters = await request.json();
    const page = Math.max(1, body.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, body.pageSize ?? 100));
    const offset = (page - 1) * pageSize;

    const cols = safeColumns(body.columns ?? []);
    if (cols.length === 0) {
      return NextResponse.json({ error: 'Не выбраны колонки' }, { status: 400 });
    }

    const pool = await getPool();

    // COUNT (no JOINs needed — filters use subqueries)
    const countReq = pool.request();
    const where = buildWhere(countReq, body);
    const countResult = await countReq.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM [dbo].[Журнал_ОСАГО_Маржа] m ${where}`
    );
    const total = countResult.recordset[0].total;

    // DATA
    const { select, joins } = buildSelectAndJoins(cols);
    const dataReq = pool.request();
    buildWhere(dataReq, body);
    dataReq.input('offset', sql.Int, offset);
    dataReq.input('pageSize', sql.Int, pageSize);

    const dataResult = await dataReq.query(
      `SELECT ${select}
       FROM [dbo].[Журнал_ОСАГО_Маржа] m
       ${joins}
       ${where}
       ORDER BY m.[ДатаЗаключения] DESC
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`
    );

    return NextResponse.json({ data: dataResult.recordset, total, page, pageSize });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'Ошибка формирования отчёта' }, { status: 500 });
  }
}
