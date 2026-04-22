/**
 * GET  /api/admin/connections — list all stored connections (passwords masked)
 * POST /api/admin/connections — save (upsert) a connection
 */

import { NextRequest } from 'next/server';
import { closePoolsForConnection } from '@/lib/db';
import { loadConnections, saveConnection } from '@/lib/schema/store';
import type { StoredConnection } from '@/lib/schema/types';

export const dynamic = 'force-dynamic';

function maskPassword(conn: StoredConnection): StoredConnection {
  if (!conn.password) return conn;
  return { ...conn, password: '***' };
}

export async function GET() {
  const connections = loadConnections().map(maskPassword);
  return Response.json({ connections });
}

export async function POST(request: NextRequest) {
  let body: { connection: StoredConnection };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let { connection } = body;
  if (!connection?.id || !connection?.name || !connection?.server) {
    return Response.json({ error: 'Заполните все обязательные поля (id, name, server)' }, { status: 400 });
  }

  // Validate id is a safe slug
  if (!/^[\w-]{1,64}$/.test(connection.id)) {
    return Response.json({ error: 'ID должен содержать только буквы, цифры, - и _' }, { status: 400 });
  }

  // On update: if password is absent, preserve the one already stored
  if (connection.password === undefined || connection.password === null) {
    const existing = loadConnections().find(c => c.id === connection.id);
    if (existing?.password) connection = { ...connection, password: existing.password };
  }

  saveConnection(connection);
  await closePoolsForConnection(connection.id);
  return Response.json({ ok: true, id: connection.id });
}
