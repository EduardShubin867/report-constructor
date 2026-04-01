import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';
import { ALL_COLUMNS } from '@/lib/report-columns';
import { buildWhere, buildSelectAndJoins, safeColumns, type ReportFilters } from '@/lib/query-builder';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  try {
    const body: ReportFilters = await request.json();
    const cols = safeColumns(body.columns ?? []);
    if (cols.length === 0) {
      return NextResponse.json({ error: 'Не выбраны колонки' }, { status: 400 });
    }

    const { select, joins } = buildSelectAndJoins(cols);
    const pool = await getPool();
    const dataReq = pool.request();
    const where = buildWhere(dataReq, body);

    const result = await queryWithTimeout(dataReq,
      `SELECT ${select}
       FROM [dbo].[Журнал_ОСАГО_Маржа] m
       ${joins}
       ${where}
       ORDER BY m.[ДатаЗаключения] DESC`,
      TIMEOUT.EXPORT,
    );

    const colDefs = cols.map(key => ALL_COLUMNS.find(c => c.key === key)!).filter(Boolean);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Генератор отчётов ОСАГО';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Отчёт ОСАГО', {
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

    for (const col of colDefs) {
      if (col.type === 'number') {
        const colIndex = cols.indexOf(col.key) + 1;
        sheet.getColumn(colIndex).numFmt = '#,##0.00';
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
