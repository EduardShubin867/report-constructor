/**
 * GET /api/report/columns
 * Returns visible ColumnDef[] for the manual report column picker.
 * Hidden columns (flagged in the schema) are excluded.
 */
import { getVisibleColumnDefs } from '@/lib/visible-columns';

export const dynamic = 'force-dynamic';

export async function GET() {
  const columns = getVisibleColumnDefs();
  return Response.json({ columns });
}
