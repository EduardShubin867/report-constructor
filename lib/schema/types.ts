/** Column type in the schema definition */
export type ColumnType = 'number' | 'string' | 'date' | 'bit';

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  /** If true, this column can be queried via list_column_values skill */
  filterable?: boolean;
}

export interface ForeignKey {
  /** FK column in the main table, e.g. 'ID_ДГ' */
  column: string;
  /** Target reference table name (without schema), e.g. 'ДГ' */
  targetTable: string;
  /** Target column for JOIN, e.g. 'Код' */
  targetColumn: string;
  /** SQL alias for the target table, e.g. 'dg' */
  alias: string;
  /** Fields available in the target table */
  targetFields: string[];
  /** Ready-to-use JOIN SQL, e.g. 'LEFT JOIN [dbo].[ДГ] AS dg ON m.ID_ДГ = dg.Код' */
  joinSql: string;
}

export interface TableSchema {
  /** Table name without schema, e.g. 'Журнал_ОСАГО_Маржа' */
  name: string;
  /** SQL alias for FROM, e.g. 'm' */
  alias?: string;
  columns: ColumnSchema[];
  foreignKeys?: ForeignKey[];
}

/**
 * Stored server-level connection — credentials only, no database.
 * One StoredConnection can serve many DataSources from different databases
 * on the same server with the same credentials.
 */
export interface StoredConnection {
  /** Unique slug, e.g. 'prod-mssql', 'analytics-pg' */
  id: string;
  /** Human-readable label, e.g. 'Продуктовая MSSQL' */
  name: string;
  dialect: 'mssql' | 'postgres' | 'clickhouse';
  server: string;
  user?: string;
  password?: string;
  port?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

/** Internal connection params used by lib/db.ts pool builder */
export interface DbConnection {
  server: string;
  database: string;
  user?: string;
  password?: string;
  port?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export interface DataSource {
  /** Unique identifier, e.g. 'osago', 'kasko' */
  id: string;
  /** Human-readable name for prompts, e.g. 'ОСАГО Маржа' */
  name: string;
  /** SQL dialect */
  dialect: 'mssql' | 'postgres' | 'clickhouse';
  /**
   * Database name on the server, e.g. 'ExportUCS'.
   * If omitted, uses DB_DATABASE from .env (default pool).
   */
  database?: string;
  /** Database schema, e.g. 'dbo' */
  schema: string;
  tables: TableSchema[];
  /**
   * References a StoredConnection by id.
   * If omitted, the default pool from .env is used.
   */
  connectionId?: string;
  /**
   * Free-text hint for the agent: when / in what context to query this source.
   * E.g. "Используй для вопросов по ОСАГО, страховой марже и убыточности".
   */
  whenToUse?: string;
}

/** Text-only instruction: repo `.md` or admin `data/skills.json`. */
export type TextInstructionSource = 'builtin' | 'data';

/**
 * Unified row for admin API and UI.
 * Built-in `.md` can be overridden by a row in data/skills.json with the same id.
 */
export interface TextInstructionListItem {
  id: string;
  name: string;
  preview: string;
  source: TextInstructionSource;
  enabled: boolean;
  category?: string;
  sources?: string[];
  agents?: string[];
  /**
   * Text shown in the editor: JSON override body if a row exists, else repo file.
   */
  instruction: string;
  /** Built-in id has a matching row in skills.json (override storage). */
  hasJsonOverride?: boolean;
  /** In agent catalog, effective text comes from JSON override (not the file). */
  usesActiveOverride?: boolean;
}

/**
 * Custom skill definition for the agent.
 * Skills are additional instructions/prompts that extend agent capabilities.
 */
export interface Skill {
  /** Unique identifier, e.g. 'krm-krp-analysis', 'territory-lookup' */
  id: string;
  /** Human-readable name, e.g. 'Анализ КРМ/КРП' */
  name: string;
  /** Full instruction text that will be injected into the system prompt */
  instruction: string;
  /** If false, skill is hidden from agent but preserved in config */
  enabled: boolean;
  /** Optional: category for grouping skills in UI */
  category?: string;
  /**
   * Optional: restrict skill to specific source IDs (e.g. ['osago', 'kasko']).
   * If empty or omitted, the skill is injected for all sources.
   */
  sources?: string[];
  /**
   * Optional: restrict skill to specific agent names (e.g. ['sql-analyst']).
   * If empty or omitted, the skill is injected for all agents.
   */
  agents?: string[];
}
