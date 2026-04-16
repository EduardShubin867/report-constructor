import { NextRequest } from 'next/server';
import { invalidateSchemaCache } from '@/lib/schema';
import { deleteSourceLink } from '@/lib/schema/store';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return Response.json({ error: 'id required' }, { status: 400 });
  }

  deleteSourceLink(id);
  invalidateSchemaCache();

  return Response.json({ ok: true });
}
