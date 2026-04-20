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

export interface SavedChatAssistantText {
  kind: 'text';
  text: string;
  suggestions: string[];
  tone?: AssistantMessageTone;
  /** Optional debug detail surfaced behind a disclosure (raw error, attempted SQL, etc.). */
  detail?: string;
}

export interface SavedChatAssistantArtifact {
  kind: 'artifact';
  text: string;
  suggestions: string[];
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
