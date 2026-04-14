import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';
import {
  buildGenericWhere,
  buildGenericSelectAndJoins,
  buildGroupedSelectAndJoins,
  safeColumns,
  safeDetailSortColumn,
  safeGroupedSortColumn,
  CONTRACT_COUNT_COLUMN_KEY,
  type GenericReportRequest,
} from '@/lib/query-builder';
import { getDataSources, getManualReportSources } from '@/lib/schema';
import { getVisibleColumnDefs, getSourceTableRef } from '@/lib/visible-columns';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  try {
    const body: GenericReportRequest = await request.json();

    const sourceId = body.sourceId ?? getManualReportSources()[0]?.id ?? '';
    const source = getDataSources().find(s => s.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: 'Источник не найден' }, { status: 400 });
    }

    const cols = safeColumns(body.columns ?? [], sourceId);
    if (cols.length === 0) {
      return NextResponse.json({ error: 'Не выбраны колонки' }, { status: 400 });
    }

    const groupBy = safeColumns(body.groupBy ?? [], sourceId);
    const tableRef = getSourceTableRef(sourceId);
    const filters = body.filters ?? {};
    const allDefs = getVisibleColumnDefs(sourceId);
    const pool = await getPool();

    let result;
    let colDefs;

    if (groupBy.length > 0) {
      const includeContractCount = body.includeContractCount !== false;
      const { select, joins, groupByClause } = buildGroupedSelectAndJoins(cols, groupBy, sourceId, {
        includeContractCount,
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
      const dataReq = pool.request();
      const where = buildGenericWhere(dataReq, filters, source, body.periodFilters);

      result = await queryWithTimeout(dataReq,
        `SELECT ${select}
         FROM ${tableRef}
         ${joins}
         ${where}
         ${groupByClause}
         ${orderBySql}`,
        TIMEOUT.EXPORT,
      );

      const groupBySet = new Set(groupBy);
      const requestedDefs = cols.map(k => allDefs.find(c => c.key === k)!).filter(Boolean);
      colDefs = [
        ...requestedDefs.filter(c => groupBySet.has(c.key)),
        ...requestedDefs.filter(c => !groupBySet.has(c.key) && c.type === 'number'),
        ...(includeContractCount
          ? [{ key: CONTRACT_COUNT_COLUMN_KEY, label: 'Кол-во договоров', type: 'number' as const, integer: true }]
          : []),
      ];
    } else {
      const { select, joins } = buildGenericSelectAndJoins(cols, sourceId);
      const mainTable = source.tables.find(t => t.columns.length > 0);
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
            : `ORDER BY ${tableAlias}.[ID] DESC`;

      const dataReq = pool.request();
      const where = buildGenericWhere(dataReq, filters, source, body.periodFilters);

      result = await queryWithTimeout(dataReq,
        `SELECT ${select}
         FROM ${tableRef}
         ${joins}
         ${where}
         ${orderBy}`,
        TIMEOUT.EXPORT,
      );
      colDefs = cols.map(key => allDefs.find(c => c.key === key)!).filter(Boolean);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Генератор отчётов';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Отчёт', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = colDefs.map(col => ({
      header: col.label,
      key: col.key,
      width: col.type === 'date' ? 16 : col.type === 'number' ? 14 : 24,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    for (const row of result.recordset) {
      const rowData: Record<string, unknown> = {};
      for (const col of colDefs) {
        const val = row[col.key];
        if (col.type === 'date' && val instanceof Date) {
          rowData[col.key] = val.toLocaleDateString('ru-RU');
        } else {
          rowData[col.key] = val;
        }
      }
      sheet.addRow(rowData);
    }

    for (let i = 0; i < colDefs.length; i++) {
      if (colDefs[i].type === 'number') {
        sheet.getColumn(i + 1).numFmt = colDefs[i].integer ? '#,##0' : '#,##0.00';
      }
    }

    for (let i = 2; i <= result.recordset.length + 1; i++) {
      if (i % 2 === 0) {
        sheet.getRow(i).fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="report_${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 });
  }
}
