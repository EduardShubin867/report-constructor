import { NextRequest, NextResponse } from 'next/server';
import { loadSourceFilterOptions } from '@/lib/report-filters-data';
import { getManualReportSources } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sourceId = request.nextUrl.searchParams.get('sourceId')
      ?? getManualReportSources()[0]?.id
      ?? '';
    const data = await loadSourceFilterOptions(sourceId);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Filters error:', err);
    return NextResponse.json({ error: 'Ошибка получения фильтров' }, { status: 500 });
  }
}
