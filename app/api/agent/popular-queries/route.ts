import { NextRequest } from 'next/server';
import {
  getPopularAgentQueries,
  isAgentAnalyticsEnabled,
  isPopularAgentQueriesPublicEnabled,
} from '@/lib/agent-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAgentAnalyticsEnabled() || !isPopularAgentQueriesPublicEnabled()) {
    return Response.json({ items: [] as { query: string; count: number }[] });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '6') || 6;
  const days = Number(searchParams.get('days') ?? '30') || 30;

  const items = getPopularAgentQueries(days, limit);
  return Response.json({ items });
}
