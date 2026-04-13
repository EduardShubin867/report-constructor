import type { AgentDebugTone } from '@/components/AgentDebugPanel';
import type { StepStatus } from '@/components/AgentStepper';
import type { SavedChatSession, SavedChatTurn } from '@/lib/report-history-types';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function truncateTitle(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function buildStepStatuses(totalSteps: number, activeIndex: number): StepStatus[] {
  return Array.from({ length: totalSteps }, (_, index) => {
    if (index < activeIndex) return 'done';
    if (index === activeIndex) return 'active';
    return 'pending';
  });
}

export function formatReportTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatClockTime(value: string): string {
  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function formatTurnCount(count: number): string {
  return `${count} ${pluralize(count, 'сообщение', 'сообщения', 'сообщений')}`;
}

export function formatRecordCount(count: number): string {
  return `${count.toLocaleString('ru-RU')} ${pluralize(count, 'запись', 'записи', 'записей')}`;
}

export function looksLikeDiagnosticExplanation(text: string): boolean {
  return /(ошибк|не удалось|невозможно|несуществующ|не найден|не найдены|связана с|в таблице используются значения|поле\s+[«"][^«"]+[»"]|колонк\w+|данные\s+за\s+прошл\w+\s+\w+\s+отсутствуют|нет\s+договоров)/i.test(text);
}

export function normalizeSuccessfulExplanation(explanation: string, rowCount: number): string {
  const trimmed = explanation.trim();
  if (!trimmed) {
    return `Отчёт сформирован. В выборке ${formatRecordCount(rowCount)}.`;
  }
  if (!looksLikeDiagnosticExplanation(trimmed)) {
    return trimmed;
  }
  return `Отчёт сформирован. В выборке ${formatRecordCount(rowCount)}.`;
}

export function isRecoverableSqlSchemaError(text: string): boolean {
  return /(invalid column name|invalid object name|ambiguous column name|multi-part identifier .* could not be bound|неверное имя столбца|неверное имя объекта|не удалось привязать multipart identifier|ошибка валидации: недопустимые таблицы)/i.test(text);
}

export function phaseDebugMessage(phase: string, retryCount: number): string {
  if (phase === 'thinking') {
    return retryCount > 0 ? 'Агент начал повторный анализ запроса' : 'Агент начал анализ запроса';
  }
  if (phase === 'finalizing') {
    return retryCount > 0 ? 'Агент собирает исправленный SQL' : 'Агент формирует финальный SQL';
  }
  return `Фаза: ${phase}`;
}

export function debugToneFromLevel(level?: string): AgentDebugTone {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  return 'info';
}

export function buildOptimisticChat(
  current: SavedChatSession | null,
  chatId: string,
  turn: SavedChatTurn,
): SavedChatSession {
  if (!current || current.id !== chatId) {
    return {
      id: chatId,
      firstQuery: turn.userQuery,
      latestQuery: turn.userQuery,
      turnCount: 1,
      createdAt: turn.createdAt,
      updatedAt: turn.createdAt,
      turns: [turn],
    };
  }

  return {
    ...current,
    latestQuery: turn.userQuery,
    turnCount: current.turns.length + 1,
    updatedAt: turn.createdAt,
    turns: [...current.turns, turn],
  };
}
