/** Column type in the schema definition */
export type ColumnType = 'number' | 'string' | 'date' | 'bit';

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  /** Human-readable label override for UI (defaults to column name if omitted) */
  label?: string;
  /**
   * Визуальный приоритет фильтра в ручном отчёте: primary / secondary.
   * Значения обоих типов подгружаются лениво при открытии дропдауна.
   */
  filterTier?: 'primary' | 'secondary';
  /** @deprecated Используйте filterTier. При true без filterTier трактуется как primary. */
  filterable?: boolean;
  /** If true, column is excluded from AI prompts and manual report UI/queries */
  hidden?: boolean;
  /** If true, column is available as a GROUP BY dimension in manual report */
  groupable?: boolean;
  /** If true, column is available as a period (range) filter in manual report (works for date and number types) */
  periodFilter?: boolean;
}

export interface ForeignKeyFilterConfig {
  /** Field in the target table used for display and filtering, e.g. 'Наименование' */
  displayField: string;
  /** Label shown in the manual report filter UI, e.g. 'ДГ' */
  label: string;
  /** Optional extra WHERE clause on the target table, e.g. 'ПометкаУдаления = 0' */
  targetWhere?: string;
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
  /**
   * Подмножество targetFields для группировки по этому FK.
   * Не задано — все targetFields; пустой массив — ни одного поля этого FK в группировке.
   */
  groupByFields?: string[];
  /** Ready-to-use JOIN SQL, e.g. 'LEFT JOIN [dbo].[ДГ] AS dg ON m.ID_ДГ = dg.Код' */
  joinSql: string;
  /** UI-priority фильтра (только при наличии filterConfig). По умолчанию primary. */
  filterTier?: 'primary' | 'secondary';
  /** If set, this FK generates a filter control in the manual report */
  filterConfig?: ForeignKeyFilterConfig;
}

export interface TableSchema {
  /** Table name without schema, e.g. 'Журнал_ОСАГО_Маржа' */
  name: string;
  /** Human-readable UI label for the table; falls back to name when omitted */
  displayName?: string;
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
  /** If true, this source is available in the manual report UI */
  manualReport?: boolean;
}

/**
 * Explicit mapping of a period (date/number range) filter shared across both linked sources.
 * Configured in the admin panel; shown as a single date picker in the linked report UI.
 */
/**
 * Per-source field configuration for a shared period link.
 *
 * Single-field mode (toField absent):
 *   fromField is filtered with both >= from AND <= to in a single WHERE clause.
 *
 * Two-field mode (toField present):
 *   fromField is filtered with >= from  (e.g. "contract start date")
 *   toField   is filtered with <= to    (e.g. "contract end date")
 */
export interface SharedPeriodSide {
  /** Column filtered with >= user's "from" value */
  fromField: string;
  /** If set, this separate column is filtered with <= user's "to" value */
  toField?: string;
}

export interface SharedPeriodLink {
  /** Human-readable label shown in the shared date picker, e.g. 'Период договора' */
  label: string;
  left: SharedPeriodSide;
  right: SharedPeriodSide;
}

/**
 * Saved relation between two report sources.
 * Used by the linked-report tab to fetch both datasets and merge them by value.
 */
export interface SourceLink {
  /** Unique slug, e.g. 'client-product', 'surname-policy' */
  id: string;
  /** Human-readable name for UI */
  name: string;
  /** Optional short hint shown in the admin and linked report UI */
  description?: string;
  /** Left source in the visual editor / report */
  leftSourceId: string;
  /** Visible column key from the left source used as the join value */
  leftJoinField: string;
  /** Right source in the visual editor / report */
  rightSourceId: string;
  /** Visible column key from the right source used as the join value */
  rightJoinField: string;
  /**
   * Single shared date/period filter configured in the admin.
   * When set, one shared date picker is shown in the linked report instead of
   * per-source period filters.
   */
  sharedPeriodLink?: SharedPeriodLink;
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
