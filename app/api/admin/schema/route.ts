/**
 * GET /api/admin/schema — returns available sources and agents for the skill editor
 */

import { getDataSources } from '@/lib/schema';
import { getAgentCatalog } from '@/lib/agents/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sources = getDataSources().map(s => ({ id: s.id, name: s.name }));
  const agents = getAgentCatalog().map(a => ({ name: a.name, description: a.description }));
  return Response.json({ sources, agents });
}
