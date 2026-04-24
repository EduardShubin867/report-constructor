import { NextRequest, NextResponse } from 'next/server';
import { fetchOsagoAgentChart } from '@/lib/osago-agent-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 1200;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/osago-agent/charts/[filename]'>,
) {
  const { filename } = await ctx.params;
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    return NextResponse.json({ error: 'Некорректное имя файла' }, { status: 400 });
  }

  try {
    const upstream = await fetchOsagoAgentChart(filename);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'График не найден' }, { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Не удалось загрузить график',
    }, { status: 502 });
  }
}
