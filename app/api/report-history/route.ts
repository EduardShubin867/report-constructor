import { NextRequest, NextResponse } from 'next/server';
import {
  applyViewerCookie,
  listViewerChats,
  normalizeChatMode,
  resolveViewerId,
  saveViewerChatTurn,
} from '@/lib/report-history';
import { normalizeOsagoChartSpecs } from '@/lib/osago-chart-specs';
import type {
  ArtifactPayload,
  SavedChatAssistantMessage,
  SavedChatTurnInput,
} from '@/lib/report-history-types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const viewer = resolveViewerId(request);
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '6') || 6;
  const mode = normalizeChatMode(searchParams.get('mode'));

  const response = NextResponse.json({
    items: listViewerChats(viewer.viewerId, limit, mode),
  });
  applyViewerCookie(response, viewer);
  return response;
}

export async function POST(request: NextRequest) {
  let body: { chatId?: string; mode?: string; turn?: SavedChatTurnInput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.turn?.userQuery?.trim()) {
    return NextResponse.json({ error: 'Запрос не может быть пустым' }, { status: 400 });
  }

  if (!isValidAssistantMessage(body.turn.assistant)) {
    return NextResponse.json({ error: 'Некорректные данные ответа' }, { status: 400 });
  }

  const viewer = resolveViewerId(request);
  const mode = normalizeChatMode(body.mode);

  try {
    const chat = saveViewerChatTurn({
      viewerId: viewer.viewerId,
      chatId: body.chatId,
      mode,
      turn: body.turn,
    });

    const response = NextResponse.json({ chat });
    applyViewerCookie(response, viewer);
    return response;
  } catch (error) {
    console.error('Chat history save error:', error);
    return NextResponse.json({ error: 'Не удалось сохранить чат' }, { status: 500 });
  }
}

function isArtifactPayload(value: unknown): value is ArtifactPayload {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as Partial<ArtifactPayload>;
  return Array.isArray(artifact.data)
    && Array.isArray(artifact.columns)
    && typeof artifact.rowCount === 'number'
    && typeof artifact.validatedSql === 'string'
    && typeof artifact.sql === 'string'
    && typeof artifact.explanation === 'string';
}

function isValidAssistantMessage(value: unknown): value is SavedChatAssistantMessage {
  if (!value || typeof value !== 'object') return false;
  const assistant = value as Partial<SavedChatAssistantMessage>;
  if (typeof assistant.text !== 'string' || !Array.isArray(assistant.suggestions)) {
    return false;
  }
  if ('format' in assistant && assistant.format !== undefined && assistant.format !== 'plain' && assistant.format !== 'markdown') {
    return false;
  }
  if ('charts' in assistant && assistant.charts !== undefined) {
    if (!Array.isArray(assistant.charts)) return false;
    if (assistant.charts.length > 0 && normalizeOsagoChartSpecs(assistant.charts).length === 0) {
      return false;
    }
  }
  if (assistant.kind === 'text') return true;
  return assistant.kind === 'artifact' && isArtifactPayload(assistant.artifact);
}
