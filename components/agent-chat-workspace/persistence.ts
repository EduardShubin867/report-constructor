import type {
  ArtifactPayload,
  ChatMode,
  SavedChatSession,
  SavedChatSummary,
  SavedChatTurn,
} from '@/lib/report-history-types';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

type PersistArgs = {
  basePath: string;
  chatId: string;
  mode: ChatMode;
  turn: SavedChatTurn;
  chatToken: number;
  activeChatTokenRef: MutableRefObject<number>;
  currentChatIdRef: MutableRefObject<string | null>;
  setSavedChats: Dispatch<SetStateAction<SavedChatSummary[]>>;
  setActiveChat: Dispatch<SetStateAction<SavedChatSession | null>>;
  setSaveState: Dispatch<SetStateAction<'idle' | 'saving' | 'saved' | 'error'>>;
  setSavedAt: Dispatch<SetStateAction<string | null>>;
};

export async function persistChatTurn({
  basePath,
  chatId,
  mode,
  turn,
  chatToken,
  activeChatTokenRef,
  currentChatIdRef,
  setSavedChats,
  setActiveChat,
  setSaveState,
  setSavedAt,
}: PersistArgs): Promise<void> {
  try {
    setSaveState('saving');
    const res = await fetch(`${basePath}/api/report-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        mode,
        turn: {
          createdAt: turn.createdAt,
          userQuery: turn.userQuery,
          assistant: turn.assistant,
        },
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Не удалось сохранить чат');
    const payload = (await res.json()) as { chat: SavedChatSession };

    setSavedChats(prev => {
      const nextSummary: SavedChatSummary = {
        id: payload.chat.id,
        mode: payload.chat.mode,
        firstQuery: payload.chat.firstQuery,
        latestQuery: payload.chat.latestQuery,
        turnCount: payload.chat.turnCount,
        createdAt: payload.chat.createdAt,
        updatedAt: payload.chat.updatedAt,
      };
      const others = prev.filter(item => item.id !== nextSummary.id);
      return [nextSummary, ...others].slice(0, 6);
    });

    if (activeChatTokenRef.current === chatToken) {
      currentChatIdRef.current = payload.chat.id;
      setActiveChat(payload.chat);
      setSaveState('saved');
      setSavedAt(payload.chat.updatedAt);
    }
  } catch (error) {
    console.error('Failed to persist chat turn:', error);
    if (activeChatTokenRef.current === chatToken) {
      setSaveState('error');
    }
  }
}

type ExportArgs = {
  basePath: string;
  artifact: ArtifactPayload;
  turnId: string;
  setExportingTurnId: Dispatch<SetStateAction<string | null>>;
  setRunnerError: Dispatch<SetStateAction<string | null>>;
};

export async function exportChatArtifact({
  basePath,
  artifact,
  turnId,
  setExportingTurnId,
  setRunnerError,
}: ExportArgs): Promise<void> {
  setExportingTurnId(turnId);
  setRunnerError(null);
  try {
    const res = await fetch(`${basePath}/api/query/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: artifact.sql,
        ...(artifact.skipAutoRowLimit ? { skipAutoRowLimit: true } : {}),
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка экспорта');
    const url = URL.createObjectURL(await res.blob());
    const anchor = Object.assign(document.createElement('a'), {
      href: url,
      download: `ai_artifact_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    setRunnerError(error instanceof Error ? error.message : 'Ошибка экспорта');
  } finally {
    setExportingTurnId(null);
  }
}
