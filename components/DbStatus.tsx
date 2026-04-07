'use client';

import { useEffect, useState, useCallback } from 'react';
import { BASE_PATH } from '@/lib/constants';

type DbState = 'checking' | 'ok' | 'error';

const POLL_INTERVAL = 30_000;

export type DbStatusVariant = 'default' | 'pill' | 'dot';

interface DbStatusProps {
  variant?: DbStatusVariant;
}

export default function DbStatus({ variant = 'default' }: DbStatusProps) {
  const [state, setState] = useState<DbState>('checking');

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_PATH}/api/health`, { cache: 'no-store' });
      setState(res.ok ? 'ok' : 'error');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    const initialId = window.setTimeout(() => {
      void check();
    }, 0);
    const id = window.setInterval(() => {
      void check();
    }, POLL_INTERVAL);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(id);
    };
  }, [check]);

  const dot =
    state === 'checking'
      ? 'bg-on-surface-variant animate-pulse'
      : state === 'ok'
        ? 'bg-emerald-500'
        : 'bg-error';

  const shortLabel =
    state === 'checking' ? 'Проверка…' : state === 'ok' ? 'БД онлайн' : 'БД недоступна';

  const longLabel =
    state === 'checking' ? 'Проверка…' : state === 'ok' ? 'БД подключена' : 'БД недоступна';

  if (variant === 'dot') {
    return (
      <div className="flex items-center gap-1.5" title={longLabel}>
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div className="flex items-center gap-2" title={longLabel}>
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
        <span
          className={`text-[11px] font-medium text-on-surface-variant ${
            state === 'error' ? 'text-error' : ''
          }`}
        >
          {shortLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" title={longLabel}>
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span
        className={`hidden text-[11px] font-medium sm:inline ${
          state === 'error' ? 'text-error' : 'text-on-surface-variant'
        }`}
      >
        {longLabel}
      </span>
    </div>
  );
}
