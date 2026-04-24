import type { ReactNode } from 'react';
import type { QueryResult } from '@/app/api/query/route';

export interface AgentQueryResult extends QueryResult {
  sql: string;
  explanation: string;
  skillRounds?: number;
  /** Matches request: validator did not inject TOP/LIMIT. */
  skipAutoRowLimit?: boolean;
}

export type AgentResultMode = 'replace' | 'append';

export interface AgentInputProps {
  onResult: (result: AgentQueryResult, queryText: string, mode: AgentResultMode) => void;
  disabled?: boolean;
  activeVersion?: {
    id: string;
    query: string;
    result: AgentQueryResult;
  } | null;
}

export type Phase = 'idle' | 'thinking' | 'validating' | 'retrying' | 'self-checking' | 'done' | 'error';

export type DebugScope = 'client' | 'phase' | 'tool' | 'result' | 'error' | 'orchestrator' | 'runner' | 'query';

export type WelcomeCard = { key: string; title: string; query: string; icon: ReactNode };
