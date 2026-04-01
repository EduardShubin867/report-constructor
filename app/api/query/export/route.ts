import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';
import { validateSql } from '@/lib/sql-validator';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json() as { sql: string };

    const validation = validateSql(sql);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const pool = await getPool();
    const result = await queryWithTimeout(pool.request(), validation.sql, TIMEOUT.EXPORT);

    const rows: Record<string, unknown>[] = result.recordset;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Нет данных для экспорта' }, { status: 400 });
    }

    const columns = Object.keys(rows[0]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Генератор отчётов ОСАГО (AI)';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('AI Отчёт', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = columns.map(col => ({
      header: col,
      key: col,
      width: 20,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    for (const row of rows) {
      const rowData: Record<string, unknown> = {};
      for (const col of columns) {
        const val = row[col];
        if (val instanceof Date) {
          rowData[col] = val.toLocaleDateString('ru-RU');
        } else {
          rowData[col] = val;
        }
      }
      sheet.addRow(rowData);
    }

    for (let i = 2; i <= rows.length + 1; i++) {
      if (i % 2 === 0) {
        sheet.getRow(i).fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ai_report_${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Query export error:', err);
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 });
  }
}
