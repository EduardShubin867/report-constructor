export interface ArtifactPayload {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  warnings?: string[];
  validatedSql: string;
  sql: string;
  explanation: string;
  skillRounds?: number;
  skipAutoRowLimit?: boolean;
}

/**
 * Tone hint for the UI. Optional — undefined means default 'info'.
 * - info:    obvious success / neutral message
 * - warning: query ran but produced no useful result (no rows, gave up after retries)
 * - error:   we genuinely failed to build/run a working query
 */
export type AssistantMessageTone = 'info' | 'warning' | 'error';
export type ChatMode = 'constructor' | 'osago-agent';
export type AssistantMessageFormat = 'plain' | 'markdown';
export type OsagoChartType = 'line' | 'bar' | 'pie';
export type OsagoChartValueType = 'number' | 'money' | 'percent';

export interface AnalysisContextSource {
  id: string;
  name?: string;
}

export interface AnalysisContextPeriod {
  from?: string;
  to?: string;
  label?: string;
}

export interface AnalysisContextFilters {
  dg?: string[];
  territories?: string[];
  agents?: string[];
  period?: AnalysisContextPeriod;
}

export interface AnalysisContext {
  source?: AnalysisContextSource;
  filters?: AnalysisContextFilters;
  metrics?: string[];
  dimensions?: string[];
  lastSql?: string;
  lastQuestion?: string;
  lastExplanation?: string;
  lastRowCount?: number;
  lastColumns?: string[];
  updatedAt?: string;
}

export interface OsagoChartSeries {
  key: string;
  label: string;
}

export interface OsagoChartThreshold {
  value: number;
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
}

export interface OsagoChartSpec {
  id: string;
  type: OsagoChartType;
  title: string;
  valueType?: OsagoChartValueType;
  xKey?: string;
  labelKey?: string;
  valueKey?: string;
  series?: OsagoChartSeries[];
  thresholds?: OsagoChartThreshold[];
  data: Record<string, string | number | null>[];
}

export interface SavedChatAssistantText {
  kind: 'text';
  text: string;
  suggestions: string[];
  format?: AssistantMessageFormat;
  charts?: OsagoChartSpec[];
  analysisContext?: AnalysisContext;
  tone?: AssistantMessageTone;
  /** Optional debug detail surfaced behind a disclosure (raw error, attempted SQL, etc.). */
  detail?: string;
}

export interface SavedChatAssistantArtifact {
  kind: 'artifact';
  text: string;
  suggestions: string[];
  analysisContext?: AnalysisContext;
  tone?: AssistantMessageTone;
  artifact: ArtifactPayload;
}

export type SavedChatAssistantMessage =
  | SavedChatAssistantText
  | SavedChatAssistantArtifact;

export interface SavedChatTurn {
  id: string;
  createdAt: string;
  userQuery: string;
  assistant: SavedChatAssistantMessage;
}

export interface SavedChatSummary {
  id: string;
  mode: ChatMode;
  firstQuery: string;
  latestQuery: string;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedChatSession extends SavedChatSummary {
  turns: SavedChatTurn[];
}

export interface SavedChatTurnInput {
  createdAt?: string;
  userQuery: string;
  assistant: SavedChatAssistantMessage;
}

// Legacy aliases kept while the rest of the app migrates to chat-centric names.
export type SavedReportResult = ArtifactPayload;
export type SavedReportVersion = SavedChatTurn;
export type SavedReportSummary = SavedChatSummary;
export type SavedReportSession = SavedChatSession;
