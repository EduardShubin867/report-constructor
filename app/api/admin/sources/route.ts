/**
 * GET  /api/admin/sources — list all dynamic sources
 * POST /api/admin/sources — save (upsert) a dynamic source
 */

import { NextRequest } from 'next/server';
import { loadDynamicSources, saveDynamicSource, getConnection } from '@/lib/schema/store';
import { invalidateSchemaCache } from '@/lib/schema';
import { revalidateReportsCaches } from '@/lib/report-filters-data';
import type { DataSource } from '@/lib/schema/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sources = loadDynamicSources();
  return Response.json({ sources });
}

export async function POST(request: NextRequest) {
  let body: { source: DataSource };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { source } = body;
  if (!source?.id || !source?.name || !source?.tables?.length) {
    return Response.json({ error: 'Некорректная структура источника' }, { status: 400 });
  }

  // Validate connectionId exists (skip for default/env sources)
  if (source.connectionId && !getConnection(source.connectionId)) {
    return Response.json({ error: `Подключение "${source.connectionId}" не найдено` }, { status: 400 });
  }

  saveDynamicSource(source);
  invalidateSchemaCache();
  revalidateReportsCaches();

  return Response.json({ ok: true, id: source.id });
}
