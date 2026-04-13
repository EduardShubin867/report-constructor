/**
 * GET /api/report/columns?sourceId=osago
 * Returns visible ColumnDef[] for the manual report column picker.
 * Hidden columns (flagged in the schema) are excluded.
 */
import { NextRequest } from 'next/server';
import { getVisibleColumnDefs, getGroupByColumnDefs } from '@/lib/visible-columns';
import { getManualReportSources } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get('sourceId')
    ?? getManualReportSources()[0]?.id
    ?? '';
  const columns = getVisibleColumnDefs(sourceId);
  const groupByColumns = getGroupByColumnDefs(sourceId);
  return Response.json({ columns, groupByColumns });
}
