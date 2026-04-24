import type { AgentDebugTone } from '../AgentDebugPanel';

export function debugToneFromLevel(level?: string): AgentDebugTone {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  return 'info';
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
