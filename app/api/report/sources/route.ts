import { NextResponse } from 'next/server';
import { getManualReportSources } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sources = getManualReportSources().map(s => ({ id: s.id, name: s.name }));
  return NextResponse.json({ sources });
}
