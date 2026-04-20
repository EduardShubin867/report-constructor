import { NextRequest, NextResponse } from 'next/server';
import { getPoolForSource, sql, queryWithTimeout, TIMEOUT } from '@/lib/db';
import {
  buildGenericWhere,
  buildGenericSelectAndJoins,
  buildGroupedSelectAndJoins,
  detailReportOrderByLastResort,
  safeColumns,
  safeDetailSortColumn,
  safeGroupedSortColumn,
  type GenericReportRequest,
} from '@/lib/query-builder';
import { getDataSources, getManualReportSources } from '@/lib/schema';
import { getSourceTableRef } from '@/lib/visible-columns';

export type { GenericReportRequest };

export async function POST(request: NextRequest) {
  try {
    const body: GenericReportRequest = await request.json();

    const sourceId = body.sourceId ?? getManualReportSources()[0]?.id ?? '';
    const source = getDataSources().find(s => s.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: 'Источник не найден' }, { status: 400 });
    }

    const page = Math.max(1, body.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, body.pageSize ?? 100));
    const offset = (page - 1) * pageSize;

    const cols = safeColumns(body.columns ?? [], sourceId);
    if (cols.length === 0) {
      return NextResponse.json({ error: 'Не выбраны колонки' }, { status: 400 });
    }

    const groupBy = safeColumns(body.groupBy ?? [], sourceId);
    const tableRef = getSourceTableRef(sourceId);
    const filters = body.filters ?? {};
    const pool = await getPoolForSource(source);

    const isPreview = body.preview === true;

    if (groupBy.length > 0) {
      // --- GROUPED MODE ---
      const includeContractCount = body.includeContractCount !== false;
      const { select, joins, groupByClause } = buildGroupedSelectAndJoins(cols, groupBy, sourceId, {
        includeContractCount,
        columnAggregations: body.columnAggregations,
      });
      const sortDirRaw = body.sortDirection;
      const sortDir =
        sortDirRaw === 'asc' ? 'ASC' : sortDirRaw === 'desc' ? 'DESC' : null;
      const sortCol =
        sortDir && body.sortColumn
          ? safeGroupedSortColumn(body.sortColumn, cols, groupBy, sourceId, includeContractCount)
          : null;
      const orderBySql =
        sortCol && sortDir
          ? `ORDER BY [${sortCol}] ${sortDir}`
          : `ORDER BY [${groupBy[0]}]`;

      // COUNT of groups — skipped for preview (expensive subquery wrapping GROUP BY)
      let total = 0;
      if (!isPreview) {
        const countReq = pool.request();
        const whereCount = buildGenericWhere(countReq, filters, source, body.periodFilters);
        const countResult = await queryWithTimeout(countReq,
          `SELECT COUNT(*) AS total FROM (
             SELECT 1 AS [_grp] FROM ${tableRef}
             ${joins}
             ${whereCount}
             ${groupByClause}
           ) AS sub`,
          TIMEOUT.REPORT,
        );
        total = (countResult.recordset[0] as { total: number }).total;
      }

      const dataReq = pool.request();
      const where = buildGenericWhere(dataReq, filters, source, body.periodFilters);
      dataReq.input('offset', sql.Int, offset);
      dataReq.input('pageSize', sql.Int, pageSize);

      const dataResult = await queryWithTimeout(dataReq,
        `SELECT ${select}
         FROM ${tableRef}
         ${joins}
         ${where}
         ${groupByClause}
         ${orderBySql}
         OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
        TIMEOUT.REPORT,
      );

      if (isPreview) total = dataResult.recordset.length;
      return NextResponse.json({ data: dataResult.recordset, total, page, pageSize });
    }

    // --- DETAIL MODE ---
    // COUNT is a simple table scan — fast even for preview, so always run it.
    const countReq = pool.request();
    const where = buildGenericWhere(countReq, filters, source, body.periodFilters);
    const countResult = await queryWithTimeout(countReq,
      `SELECT COUNT(*) AS total FROM ${tableRef} ${where}`,
      TIMEOUT.REPORT,
    );
    const total = (countResult.recordset[0] as { total: number }).total;

    const { select, joins } = buildGenericSelectAndJoins(cols, sourceId);
    const dataReq = pool.request();
    buildGenericWhere(dataReq, filters, source, body.periodFilters);
    dataReq.input('offset', sql.Int, offset);
    dataReq.input('pageSize', sql.Int, pageSize);

    // Find date filter col for ORDER BY fallback
    const source2 = source;
    const mainTable = source2.tables.find(t => t.columns.length > 0);
    const dateCol = mainTable?.columns.find(c => c.periodFilter && c.type === 'date')?.name;
    const tableAlias = mainTable?.alias ?? 'm';
    const sortDirRaw = body.sortDirection;
    const sortDir =
      sortDirRaw === 'asc' ? 'ASC' : sortDirRaw === 'desc' ? 'DESC' : null;
    const sortCol =
      sortDir && body.sortColumn ? safeDetailSortColumn(body.sortColumn, cols, sourceId) : null;
    const orderBy =
      sortCol && sortDir
        ? `ORDER BY [${sortCol}] ${sortDir}`
        : dateCol
          ? `ORDER BY ${tableAlias}.[${dateCol}] DESC`
          : detailReportOrderByLastResort(sourceId, tableAlias);

    const dataResult = await queryWithTimeout(dataReq,
      `SELECT ${select}
       FROM ${tableRef}
       ${joins}
       ${where}
       ${orderBy}
       OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
      TIMEOUT.REPORT,
    );

    return NextResponse.json({ data: dataResult.recordset, total, page, pageSize });
  } catch (err) {
    console.error('Report error:', err);
    return NextResponse.json({ error: 'Ошибка формирования отчёта' }, { status: 500 });
  }
}
