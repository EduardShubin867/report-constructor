import { NextResponse } from 'next/server';
import { loadReportFilterOptions } from '@/lib/report-filters-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await loadReportFilterOptions();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Filters error:', err);
    return NextResponse.json({ error: 'Ошибка получения фильтров' }, { status: 500 });
  }
}
