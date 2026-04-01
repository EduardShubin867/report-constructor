/**
 * Simple in-memory TTL cache for SQL query results.
 *
 * Eliminates duplicate DB hits when validate_query (agent skill)
 * and /api/query execute the same SQL within a short window.
 */

interface CacheEntry {
  data: Record<string, unknown>[];
  columns: string[];
  timestamp: number;
}

const MAX_ENTRIES = 50;
const TTL_MS = 60_000; // 60 seconds

const cache = new Map<string, CacheEntry>();

function normalizeKey(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getCached(sql: string): CacheEntry | null {
  const key = normalizeKey(sql);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  console.log('[QueryCache] hit');
  return entry;
}

export function setCache(
  sql: string,
  data: Record<string, unknown>[],
  columns: string[],
): void {
  // Evict oldest if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(normalizeKey(sql), { data, columns, timestamp: Date.now() });
}
