/**
 * DELETE /api/admin/connections/[id]
 *
 * Refuses deletion if any dynamic sources still reference this connectionId.
 * Otherwise deletes and closes the pool.
 */

import { NextRequest } from 'next/server';
import { deleteConnection, loadDynamicSources } from '@/lib/schema/store';
import { closePoolsForConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  // Check no sources still use this connection
  const usedBy = loadDynamicSources()
    .filter(s => s.connectionId === id)
    .map(s => ({ id: s.id, name: s.name }));

  if (usedBy.length > 0) {
    return Response.json({
      error: `Подключение используется источниками: ${usedBy.map(s => s.name).join(', ')}. Сначала удалите или переключите их.`,
      usedBy,
    }, { status: 409 });
  }

  deleteConnection(id);
  await closePoolsForConnection(id);

  return Response.json({ ok: true });
}
