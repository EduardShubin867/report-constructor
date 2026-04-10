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

export interface SavedChatAssistantText {
  kind: 'text';
  text: string;
  suggestions: string[];
}

export interface SavedChatAssistantArtifact {
  kind: 'artifact';
  text: string;
  suggestions: string[];
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
