'use client';

import { useEffect, useState, useCallback } from 'react';
import { BASE_PATH } from '@/lib/constants';

type DbState = 'checking' | 'ok' | 'error';

const POLL_INTERVAL = 30_000; // 30 seconds

export default function DbStatus() {
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
    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [check]);

  const dot =
    state === 'checking'
      ? 'bg-gray-400 animate-pulse'
      : state === 'ok'
      ? 'bg-emerald-500'
      : 'bg-red-500';

  const label =
    state === 'checking'
      ? 'Проверка…'
      : state === 'ok'
      ? 'БД подключена'
      : 'БД недоступна';

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      <span
        className={`text-[11px] font-medium hidden sm:inline ${
          state === 'error' ? 'text-red-600' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
