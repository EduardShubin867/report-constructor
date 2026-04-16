import { type NextRequest, NextResponse } from 'next/server';
import { getPeriodFilterColumns } from '@/lib/visible-columns';

export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get('sourceId');
  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
  }
  const cols = getPeriodFilterColumns(sourceId);
  return NextResponse.json({ cols });
}
