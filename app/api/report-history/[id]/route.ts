import { NextRequest, NextResponse } from 'next/server';
import {
  applyViewerCookie,
  getViewerChat,
  normalizeChatMode,
  resolveViewerId,
} from '@/lib/report-history';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/report-history/[id]'>,
) {
  const { id } = await ctx.params;
  const viewer = resolveViewerId(request);
  const { searchParams } = new URL(request.url);
  const mode = normalizeChatMode(searchParams.get('mode'));

  const chat = getViewerChat(viewer.viewerId, id, mode);
  if (!chat) {
    return NextResponse.json({ error: 'Чат не найден' }, { status: 404 });
  }

  const response = NextResponse.json({ chat });
  applyViewerCookie(response, viewer);
  return response;
}
