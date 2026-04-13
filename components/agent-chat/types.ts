import type { ReactNode } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type Phase = 'idle' | 'thinking' | 'validating' | 'retrying' | 'self-checking' | 'done' | 'error';
export type DebugScope = 'client' | 'phase' | 'tool' | 'result' | 'error' | 'orchestrator' | 'runner' | 'query';

export type PendingTurn = {
  id: string;
  createdAt: string;
  userQuery: string;
  targetChatId: string;
};

export type FollowUpContext = {
  label: string;
  sql: string;
};

export type WelcomeCard = {
  key: string;
  title: string;
  query: string;
  icon: ReactNode;
};
