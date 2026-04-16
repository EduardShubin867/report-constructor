import { NextRequest } from 'next/server';
import { getJoinableColumnDefs } from '@/lib/linked-report';
import { getDataSources, invalidateSchemaCache, type SourceLink } from '@/lib/schema';
import { loadSourceLinks, saveSourceLink } from '@/lib/schema/store';

export const dynamic = 'force-dynamic';

function validateSourceLink(link: SourceLink): string | null {
  if (!link?.id || !link?.name || !link?.leftSourceId || !link?.rightSourceId) {
    return 'Заполните обязательные поля связи';
  }

  if (!/^[\w-]{1,64}$/.test(link.id)) {
    return 'ID связи должен содержать только буквы, цифры, - и _';
  }

  const sources = getDataSources();
  const leftSource = sources.find(source => source.id === link.leftSourceId);
  const rightSource = sources.find(source => source.id === link.rightSourceId);

  if (!leftSource) {
    return `Источник "${link.leftSourceId}" не найден`;
  }
  if (!rightSource) {
    return `Источник "${link.rightSourceId}" не найден`;
  }

  const leftJoinExists = getJoinableColumnDefs(link.leftSourceId).some(
    column => column.key === link.leftJoinField,
  );
  if (!leftJoinExists) {
    return `Поле связи "${link.leftJoinField}" недоступно в источнике "${leftSource.name}"`;
  }

  const rightJoinExists = getJoinableColumnDefs(link.rightSourceId).some(
    column => column.key === link.rightJoinField,
  );
  if (!rightJoinExists) {
    return `Поле связи "${link.rightJoinField}" недоступно в источнике "${rightSource.name}"`;
  }

  return null;
}

export async function GET() {
  return Response.json({ links: loadSourceLinks() });
}

export async function POST(request: NextRequest) {
  let body: { link: SourceLink };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const error = validateSourceLink(body.link);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }

  saveSourceLink(body.link);
  invalidateSchemaCache();

  return Response.json({ ok: true, id: body.link.id });
}
