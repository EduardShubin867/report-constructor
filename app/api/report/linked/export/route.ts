import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { buildLinkedReport, type LinkedReportRequest } from '@/lib/linked-report';
import type { ColumnDef } from '@/lib/report-columns';

export const dynamic = 'force-dynamic';

function writeSheetFromRows(sheet: ExcelJS.Worksheet, colDefs: ColumnDef[], rows: Record<string, unknown>[]) {
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

  for (const row of rows) {
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

  for (let i = 2; i <= rows.length + 1; i++) {
    if (i % 2 === 0) {
      sheet.getRow(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F7FF' },
      };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: LinkedReportRequest = await request.json();
    const { columns, data } = await buildLinkedReport(body);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Генератор отчётов';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Сводный отчёт', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    writeSheetFromRows(sheet, columns, data);

    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="linked_report_${date}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Linked export error:', error);
    const message =
      error instanceof Error ? error.message : 'Ошибка экспорта сводного отчёта';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
