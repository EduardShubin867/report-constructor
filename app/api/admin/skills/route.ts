/**
 * GET  /api/admin/skills — list all skills
 * POST /api/admin/skills — save (upsert) a skill
 */

import { NextRequest } from 'next/server';
import { saveSkill } from '@/lib/schema/store';
import type { Skill } from '@/lib/schema/types';
import { listAllTextInstructionsForAdmin } from '@/lib/skills/text-instructions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const instructions = listAllTextInstructionsForAdmin();
  return Response.json({ instructions });
}

export async function POST(request: NextRequest) {
  let body: { skill: Skill };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { skill } = body;
  if (!skill?.id || !skill?.name || !skill?.instruction) {
    return Response.json({ error: 'Некорректная структура скилла' }, { status: 400 });
  }

  try {
    saveSkill(skill);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка сохранения';
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ ok: true, id: skill.id });
}
