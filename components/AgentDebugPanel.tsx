'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bug,
  Check,
  CircleAlert,
  CircleCheckBig,
  Copy,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Terminal,
} from 'lucide-react';

export type AgentDebugTone = 'info' | 'success' | 'warn' | 'error';

export interface AgentDebugEntry {
  id: string;
  createdAt: string;
  scope: string;
  message: string;
  tone: AgentDebugTone;
  elapsedMs: number;
  data?: unknown;
}

interface AgentDebugPanelProps {
  entries: AgentDebugEntry[];
  isRunning: boolean;
}

function formatElapsed(ms: number): string {
  return `+${(ms / 1000).toFixed(1)}s`;
}

function formatScope(scope: string): string {
  switch (scope) {
    case 'client':
      return 'UI';
    case 'phase':
      return 'Phase';
    case 'tool':
      return 'Tool';
    case 'result':
      return 'Result';
    case 'error':
      return 'Error';
    case 'orchestrator':
      return 'Router';
    case 'runner':
      return 'Runner';
    case 'query':
      return 'SQL';
    default:
      return scope;
  }
}

function toneClasses(tone: AgentDebugTone): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200';
    case 'warn':
      return 'border-amber-400/35 bg-amber-400/10 text-amber-200';
    case 'error':
      return 'border-rose-400/35 bg-rose-400/10 text-rose-200';
    default:
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function AgentDebugPanel({ entries, isRunning }: AgentDebugPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const latestTone = entries[entries.length - 1]?.tone ?? 'info';
  const panelClassName = isExpanded
    ? 'fixed inset-4 z-50 flex flex-col rounded-[28px] border border-outline-variant/20 bg-[rgba(15,23,42,0.96)] p-4 shadow-[0_30px_80px_rgba(15,23,42,0.45)] backdrop-blur sm:p-5'
    : 'ui-panel-muted rounded-[28px] p-4 sm:p-5 xl:sticky xl:top-6';
  const scrollClassName = isExpanded
    ? 'min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-900/90 bg-[#0f172a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
    : 'min-h-[18rem] max-h-[32rem] overflow-y-auto rounded-2xl border border-slate-900/90 bg-[#0f172a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

  async function handleCopyFullLog() {
    const payload = {
      exportedAt: new Date().toISOString(),
      isRunning,
      entryCount: entries.length,
      entries,
    };
    await copyText(safeJsonStringify(payload));
    setCopied(true);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  const panel = (
    <aside className={panelClassName}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="ui-chip mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
            <Bug className="h-3 w-3" strokeWidth={2.2} />
            Dev Only
          </span>
          <h3 className="font-headline text-sm font-semibold text-on-surface">Лог работы агента</h3>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            Живой поток маршрутизации, tool-вызовов и SQL-шагов для локальной отладки.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleCopyFullLog()}
            className="ui-button-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          >
            {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />}
            {copied ? 'Скопировано' : 'JSON'}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="ui-button-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" strokeWidth={2.2} /> : <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.2} />}
            {isExpanded ? 'Свернуть' : 'На весь экран'}
          </button>
          <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${toneClasses(latestTone)}`}>
            {isRunning ? 'live' : `${entries.length} evt`}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className={scrollClassName}>
        {entries.length === 0 ? (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 px-6 text-center">
            <div className="rounded-2xl bg-white/5 p-3">
              <Terminal className="h-5 w-5 text-slate-300" strokeWidth={2.1} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Лог пока пустой</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Запустите свободный запрос, и здесь появятся все внутренние шаги агента.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 font-mono text-[11px] leading-5 text-slate-100"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                  <span className={`rounded-full border px-2 py-0.5 ${toneClasses(entry.tone)}`}>
                    {formatScope(entry.scope)}
                  </span>
                  <span>{formatElapsed(entry.elapsedMs)}</span>
                  {entry.tone === 'success' && <CircleCheckBig className="h-3 w-3 text-emerald-300" strokeWidth={2.4} />}
                  {entry.tone === 'warn' && <CircleAlert className="h-3 w-3 text-amber-300" strokeWidth={2.4} />}
                  {entry.tone === 'error' && <CircleAlert className="h-3 w-3 text-rose-300" strokeWidth={2.4} />}
                  {entry.tone === 'info' && isRunning && <LoaderCircle className="h-3 w-3 animate-spin text-sky-300" strokeWidth={2.4} />}
                </div>

                <p className="mt-1.5 whitespace-pre-wrap break-words text-slate-100">{entry.message}</p>

                {entry.data !== undefined && (
                  <pre className={`mt-2 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 px-2.5 py-2 text-[10px] leading-4 text-slate-300 ${isExpanded ? 'max-h-[28rem]' : 'max-h-[14rem]'}`}>
                    {safeJsonStringify(entry.data)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.72)] backdrop-blur-[2px]"
          onClick={() => setIsExpanded(false)}
        />
      )}
      {panel}
    </>
  );
}
