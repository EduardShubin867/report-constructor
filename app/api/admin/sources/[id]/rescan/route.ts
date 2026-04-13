/**
 * POST /api/admin/sources/[id]/rescan
 * Body: { tableName: string }
 *
 * Queries INFORMATION_SCHEMA.COLUMNS for the given table (no LLM).
 * Maps raw SQL types to ColumnType with a simple lookup.
 * Merges result: existing columns preserve their flags (type, filterable, hidden);
 * new columns are appended at the end with inferred type.
 *
 * Returns: { source: DataSource, newColumns: string[] }
 * Does NOT auto-save — caller must POST to /api/admin/sources to persist.
 *
 * Works for both sources with an explicit connectionId/database and sources
 * that rely on the default .env pool.
 */

import { NextRequest } from 'next/server';
import { getPoolForConnection, queryWithTimeout, TIMEOUT, sql } from '@/lib/db';
import { loadDynamicSources, getConnection } from '@/lib/schema/store';
import type { ColumnSchema, ColumnType } from '@/lib/schema/types';

export const dynamic = 'force-dynamic';

/** Maps SQL DATA_TYPE strings to our four ColumnType values (no LLM needed). */
function mapDbType(dataType: string): ColumnType {
  const t = dataType.toLowerCase();
  if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney'].includes(t)) return 'number';
  if (['datetime', 'datetime2', 'date', 'smalldatetime', 'datetimeoffset'].includes(t)) return 'date';
  if (t === 'bit') return 'bit';
  return 'string';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { tableName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { tableName } = body;
  if (!tableName) return Response.json({ error: 'tableName required' }, { status: 400 });

  const sources = loadDynamicSources();
  const source = sources.find(s => s.id === id);
  if (!source) return Response.json({ error: `Source "${id}" not found` }, { status: 404 });

  const tableSchema = source.tables.find(t => t.name === tableName);
  if (!tableSchema) return Response.json({ error: `Table "${tableName}" not in source "${id}"` }, { status: 404 });

  // Resolve connection — may be undefined (uses .env default pool)
  const conn = source.connectionId ? getConnection(source.connectionId) : undefined;
  if (source.connectionId && !conn) {
    return Response.json({ error: `Connection "${source.connectionId}" not found` }, { status: 404 });
  }

  const pool = await getPoolForConnection(source.connectionId, conn ?? undefined, source.database);
  const req = pool.request();
  req.input('schema', sql.NVarChar, source.schema);
  req.input('tableName', sql.NVarChar, tableName);

  const result = await queryWithTimeout(req, `
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema
      AND TABLE_NAME = @tableName
    ORDER BY ORDINAL_POSITION
  `, TIMEOUT.SKILL);

  const dbColumns = result.recordset as unknown as { COLUMN_NAME: string; DATA_TYPE: string }[];
  if (dbColumns.length === 0) {
    return Response.json(
      { error: `No columns found for table "${tableName}" in schema "${source.schema}"` },
      { status: 422 },
    );
  }

  // Merge: existing columns keep all their flags; new columns appended with inferred type
  const existingByName = new Map(tableSchema.columns.map(c => [c.name, c]));
  const newColumnNames: string[] = [];

  const merged: ColumnSchema[] = dbColumns.map(row => {
    const existing = existingByName.get(row.COLUMN_NAME);
    if (existing) return existing;
    newColumnNames.push(row.COLUMN_NAME);
    return { name: row.COLUMN_NAME, type: mapDbType(row.DATA_TYPE) };
  });

  const updatedSource = {
    ...source,
    tables: source.tables.map(t =>
      t.name === tableName ? { ...t, columns: merged } : t,
    ),
  };

  return Response.json({ source: updatedSource, newColumns: newColumnNames });
}
