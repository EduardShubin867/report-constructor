import { NextRequest, NextResponse } from 'next/server';
import { loadSingleFilterKeyValues } from '@/lib/report-filters-data';
import { buildFilterDescriptors } from '@/lib/report-filter-tier';
import { getDataSources, getManualReportSources } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sourceId =
      request.nextUrl.searchParams.get('sourceId') ?? getManualReportSources()[0]?.id ?? '';
    const key = request.nextUrl.searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Параметр key обязателен' }, { status: 400 });
    }

    const source = getDataSources().find(s => s.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: 'Источник не найден' }, { status: 400 });
    }

    const allowedKeys = new Set(buildFilterDescriptors(source).map(d => d.key));
    if (!allowedKeys.has(key)) {
      return NextResponse.json({ error: 'Неизвестный ключ фильтра' }, { status: 400 });
    }

    const values = await loadSingleFilterKeyValues(sourceId, key);
    return NextResponse.json({ values });
  } catch (err) {
    console.error('filter-options:', err);
    return NextResponse.json({ error: 'Ошибка загрузки значений' }, { status: 500 });
  }
}
