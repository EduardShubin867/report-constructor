/**
 * Structured logger — single entry-point for server-side logging.
 *
 * Production: line-delimited JSON for log aggregators.
 * Development: short pretty-printed lines for the terminal.
 *
 * Always pass `requestId` when available so a single `/api/agent` call can be
 * traced across orchestrator → runner → skills → LLM.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  requestId?: string;
  agent?: string;
  source?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const tag = `[${level}] [${scope}] ${message}`;
    const extras = fields && Object.keys(fields).length > 0 ? ' ' + safeJson(fields) : '';
    const line = tag + extras;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(fields ?? {}),
  };
  const line = safeJson(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const logger = {
  info: (scope: string, message: string, fields?: LogFields) => emit('info', scope, message, fields),
  warn: (scope: string, message: string, fields?: LogFields) => emit('warn', scope, message, fields),
  error: (scope: string, message: string, fields?: LogFields) => emit('error', scope, message, fields),
};
