import sql from 'mssql';
import type { DataSource, StoredConnection } from './schema/types';
import { getConnection } from './schema/store';

// Slightly above EXPORT (60s) so app-level queryWithTimeout always fires first.
const DRIVER_REQUEST_TIMEOUT_MS = 70_000;

function buildConfig(conn: StoredConnection, database: string): sql.config {
  return {
    server: conn.server,
    database,
    user: conn.user,
    password: conn.password,
    port: conn.port ?? 1433,
    requestTimeout: DRIVER_REQUEST_TIMEOUT_MS,
    options: {
      encrypt: conn.encrypt ?? false,
      trustServerCertificate: conn.trustServerCertificate ?? true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

function buildDefaultConfig(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    database: process.env.DB_DATABASE ?? 'ExportUCS',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT ?? '1433', 10),
    requestTimeout: DRIVER_REQUEST_TIMEOUT_MS,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  };
}

// ── Multi-pool registry ──────────────────────────────────────────────────────
// Pool key = 'default' for the .env pool, or `${connectionId}:${database}` for
// named connections. This lets multiple DataSources on the same server but
// different databases each get their own pool while sharing credentials.

const pools = new Map<string, sql.ConnectionPool>();

async function createPool(key: string, config: sql.config): Promise<sql.ConnectionPool> {
  console.log(`Connecting pool [${key}] to`, { server: config.server, database: config.database, user: config.user, port: config.port });
  const p = new sql.ConnectionPool(config);
  p.on('error', err => {
    console.error(`SQL Pool [${key}] error:`, err);
    const isConnectionError =
      (err as NodeJS.ErrnoException).code === 'ETIMEOUT' ||
      (err as NodeJS.ErrnoException).code === 'ECONNREFUSED' ||
      (err as NodeJS.ErrnoException).code === 'ESOCKET' ||
      err.name === 'ConnectionError';
    if (isConnectionError && pools.get(key) === p) {
      pools.delete(key);
      p.close().catch(() => {});
    }
  });
  const connected = await p.connect();
  pools.set(key, connected);
  console.log(`Pool [${key}] connected.`);
  return connected;
}

/**
 * Get (or create) a pool for a named connection + database pair.
 *
 * - No conn → default .env pool (key: 'default')
 * - conn + database → named pool (key: `${connectionId}:${database}`)
 *
 * Two DataSources on the same server + database share one pool.
 * Two DataSources on the same server but different databases get separate pools.
 */
export async function getPoolForConnection(
  connectionId?: string,
  conn?: StoredConnection,
  database?: string,
): Promise<sql.ConnectionPool> {
  if (!conn || !connectionId || !database) {
    const existing = pools.get('default');
    if (existing?.connected) return existing;
    if (existing) pools.delete('default');
    return createPool('default', buildDefaultConfig());
  }

  const key = `${connectionId}:${database}`;
  const existing = pools.get(key);
  if (existing?.connected) return existing;
  if (existing) pools.delete(key);
  return createPool(key, buildConfig(conn, database));
}

/**
 * Resolve the correct pool for a source.
 * Sources may use the default .env pool or a named stored connection.
 */
export async function getPoolForSource(
  source: Pick<DataSource, 'connectionId' | 'database'>,
): Promise<sql.ConnectionPool> {
  if (!source.connectionId) {
    return getPoolForConnection();
  }

  const conn = getConnection(source.connectionId);
  if (!conn) {
    throw new Error(`Connection "${source.connectionId}" not found`);
  }

  return getPoolForConnection(source.connectionId, conn, source.database);
}

/**
 * Close all pools associated with a connectionId (call on connection deletion).
 * Closes every pool keyed `${connectionId}:*`.
 */
export async function closePoolsForConnection(connectionId: string): Promise<void> {
  const prefix = `${connectionId}:`;
  for (const [key, pool] of pools.entries()) {
    if (key.startsWith(prefix)) {
      await pool.close().catch(() => {});
      pools.delete(key);
      console.log(`Pool [${key}] closed.`);
    }
  }
}

/** Default pool — backward compat for existing call sites */
export async function getPool(): Promise<sql.ConnectionPool> {
  return getPoolForConnection();
}

// ── Query timeout helpers ────────────────────────────────────────────────────

export const TIMEOUT = {
  HEALTH: 5_000,
  SKILL: 10_000,
  QUERY: 15_000,
  REPORT: 30_000,
  EXPORT: 60_000,
} as const;

/** Applied when AI user disables the automatic TOP/LIMIT (heavier queries). */
const UNLIMITED_ROWS_TIMEOUT_FACTOR = 4;

/** Scale base timeout when row auto-limit is off (query + export). */
export function timeoutWhenUnlimitedRows(
  baseMs: number,
  skipAutoRowLimit?: boolean,
): number {
  return skipAutoRowLimit ? baseMs * UNLIMITED_ROWS_TIMEOUT_FACTOR : baseMs;
}

export class QueryTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Query timed out after ${timeoutMs}ms`);
    this.name = 'QueryTimeoutError';
  }
}

export async function queryWithTimeout(
  request: sql.Request,
  sqlText: string,
  timeoutMs: number,
): Promise<sql.IResult<Record<string, unknown>>> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      request.cancel();
      reject(new QueryTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([request.query(sqlText), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export { sql };
