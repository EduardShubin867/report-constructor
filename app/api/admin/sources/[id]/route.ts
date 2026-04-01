/**
 * DELETE /api/admin/sources/[id] — remove a dynamic source
 * Pool belongs to the connection, not the source — we don't close it here.
 */

import { NextRequest } from 'next/server';
import { deleteDynamicSource } from '@/lib/schema/store';
import { invalidateSchemaCache } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  deleteDynamicSource(id);
  invalidateSchemaCache();

  return Response.json({ ok: true });
}
