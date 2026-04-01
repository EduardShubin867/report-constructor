/**
 * POST /api/admin/connections/[id]/test
 *
 * Opens a temporary connection (not pooled), runs SELECT 1, reports latency.
 * The stored connection is loaded from connections.json by id.
 */

import { NextRequest } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/schema/store';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return Response.json({ ok: false, error: 'id required' }, { status: 400 });

  const conn = getConnection(id);
  if (!conn) {
    return Response.json({ ok: false, error: 'Подключение не найдено' }, { status: 404 });
  }

  const config: sql.config = {
    server: conn.server,
    database: 'master',
    user: conn.user,
    password: conn.password,
    port: conn.port ?? 1433,
    options: {
      encrypt: conn.encrypt ?? false,
      trustServerCertificate: conn.trustServerCertificate ?? true,
      connectTimeout: 8000,
    },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
  };

  const start = Date.now();
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    await pool.request().query('SELECT 1');
    const latencyMs = Date.now() - start;
    return Response.json({ ok: true, latencyMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg });
  } finally {
    await pool?.close().catch(() => {});
  }
}
