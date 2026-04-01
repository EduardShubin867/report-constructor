/**
 * DELETE /api/admin/skills/[id] — delete a skill
 */

import { NextRequest } from 'next/server';
import { deleteSkill } from '@/lib/schema/store';

export const dynamic = 'force-dynamic';

/**
 * Removes a row from data/skills.json.
 * For built-in ids (repo .md), this clears the admin override only; the file remains.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteSkill(id);
  return Response.json({ ok: true });
}
