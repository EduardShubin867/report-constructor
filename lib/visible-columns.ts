/**
 * Server-only helpers for column visibility.
 * Do NOT import this file from client components — it reads data/sources.json via getDataSources().
 */
import { getDataSources } from '@/lib/schema';
import { ALL_COLUMNS, type ColumnDef, type ColumnType } from '@/lib/report-columns';

/** Map ColumnSchema type ('bit') to ColumnDef type ('boolean'). */
function toDefType(t: string): ColumnType {
  return t === 'bit' ? 'boolean' : (t as ColumnType);
}

/**
 * Returns the full list of visible columns for the manual report:
 * 1. Hardcoded ALL_COLUMNS entries that are not hidden in the schema.
 *    JOIN-derived columns (joinKey set) are always included.
 * 2. Any extra columns that exist in the schema but are NOT in ALL_COLUMNS
 *    (e.g. discovered via rescan). These use the column name as label and
 *    are queried as m.[name] with no JOIN.
 */
export function getVisibleColumnDefs(): ColumnDef[] {
  const hiddenNames = new Set<string>();
  const schemaColumns: ColumnDef[] = [];
  const knownKeys = new Set(ALL_COLUMNS.map(c => c.key));

  for (const ds of getDataSources()) {
    for (const table of ds.tables) {
      if (table.columns.length === 0) continue; // skip reference tables
      for (const col of table.columns) {
        if (col.hidden) {
          hiddenNames.add(col.name);
          continue;
        }
        if (!knownKeys.has(col.name)) {
          schemaColumns.push({
            key: col.name,
            label: col.name,
            type: toDefType(col.type),
          });
        }
      }
    }
  }

  const visible = ALL_COLUMNS.filter(c => c.joinKey || !hiddenNames.has(c.key));
  return [...visible, ...schemaColumns];
}

/** Keys of visible columns — used for server-side allowlist validation. */
export function getVisibleColumnKeys(): Set<string> {
  return new Set(getVisibleColumnDefs().map(c => c.key));
}
