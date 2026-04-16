import { NextRequest, NextResponse } from 'next/server';
import { buildLinkedReport, type LinkedReportRequest } from '@/lib/linked-report';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body: LinkedReportRequest = await request.json();
    const result = await buildLinkedReport(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Linked report error:', error);
    const message =
      error instanceof Error ? error.message : 'Ошибка формирования сводного отчёта';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
