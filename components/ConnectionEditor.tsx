'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BASE_PATH } from '@/lib/constants';
import type { StoredConnection } from '@/lib/schema/types';

const DIALECTS = ['mssql', 'postgres', 'clickhouse'] as const;

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; latencyMs: number }
  | { status: 'error'; message: string };

interface Props {
  /** When provided, editor is in edit mode (password field is masked) */
  initial?: StoredConnection;
  onSaved: (conn: StoredConnection) => void;
  onCancel: () => void;
}

export default function ConnectionEditor({ initial, onSaved, onCancel }: Props) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    id: initial?.id ?? '',
    name: initial?.name ?? '',
    dialect: initial?.dialect ?? ('mssql' as typeof DIALECTS[number]),
    server: initial?.server ?? '',
    user: initial?.user ?? '',
    port: initial?.port as number | undefined,
  });

  // Password: in edit mode starts "kept", user must explicitly choose to replace it
  const [passwordMode, setPasswordMode] = useState<'keep' | 'replace'>(
    isEdit ? 'keep' : 'replace',
  );
  const [newPassword, setNewPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }));
    if (['server', 'user', 'port'].includes(key as string)) {
      setTestState({ status: 'idle' });
    }
  }

  function buildConn(): StoredConnection {
    const base: StoredConnection = {
      id: form.id.trim(),
      name: form.name.trim(),
      dialect: form.dialect,
      server: form.server.trim(),
      user: form.user?.trim() || undefined,
      port: form.port ? Number(form.port) : undefined,
    };
    // Only include password if the user explicitly typed a new one
    if (passwordMode === 'replace' && newPassword) {
      base.password = newPassword;
    }
    // If passwordMode === 'keep', password is omitted → server preserves existing
    return base;
  }

  async function handleTest() {
    if (!form.id || !form.server) { setError('Сначала укажите ID и сервер'); return; }
    setTestState({ status: 'testing' });
    setError(null);

    // Save first so the test endpoint can load it (with preserved password)
    const conn = buildConn();
    try {
      await fetch(`${BASE_PATH}/api/admin/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: conn }),
      });

      const res = await fetch(
        `${BASE_PATH}/api/admin/connections/${encodeURIComponent(form.id)}/test`,
        { method: 'POST' },
      );
      const data = await res.json();

      if (data.ok) {
        setTestState({ status: 'ok', latencyMs: data.latencyMs });
      } else {
        setTestState({ status: 'error', message: data.error ?? 'Ошибка подключения' });
      }
    } catch (e) {
      setTestState({ status: 'error', message: e instanceof Error ? e.message : 'Сетевая ошибка' });
    }
  }

  async function handleSave() {
    setError(null);
    if (!form.id || !form.name || !form.server) {
      setError('Заполните ID, название и сервер');
      return;
    }
    setSaving(true);
    try {
      const conn = buildConn();
      const res = await fetch(`${BASE_PATH}/api/admin/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: conn }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Ошибка сохранения'); return; }
      // Return the conn we built; password field reflects what was sent
      onSaved(conn);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Сетевая ошибка');
    } finally {
      setSaving(false);
    }
  }

  const canTest = !!form.id && !!form.server;
  const canSave = !!form.id && !!form.name && !!form.server;

  const inputClass = 'w-full border border-outline-variant/20 bg-white rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-container';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-on-surface-variant mb-1 block">ID (slug)</span>
            <input
              className={inputClass}
              placeholder="prod-mssql"
              value={form.id}
              onChange={e => setField('id', e.target.value)}
              disabled={isEdit}
            />
          </label>
          <label className="block">
            <span className="text-xs text-on-surface-variant mb-1 block">Название</span>
            <input
              className={inputClass}
              placeholder="Продуктовая MSSQL"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-on-surface-variant mb-1 block">Диалект</span>
            <select
              className={inputClass}
              value={form.dialect}
              onChange={e => setField('dialect', e.target.value as typeof DIALECTS[number])}
            >
              {DIALECTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </label>
        </div>

        {/* Right */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-on-surface-variant mb-1 block">Сервер</span>
            <input
              className={`${inputClass} font-mono`}
              placeholder="localhost\SQLEXPRESS"
              value={form.server}
              onChange={e => setField('server', e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-on-surface-variant mb-1 block">Пользователь</span>
              <input
                className={inputClass}
                value={form.user ?? ''}
                onChange={e => setField('user', e.target.value)}
              />
            </label>
            <div>
              <span className="text-xs text-on-surface-variant mb-1 block">Пароль</span>
              {passwordMode === 'keep' ? (
                <div className="flex items-center gap-2 h-9">
                  <span className="text-sm text-on-surface-variant/60 font-mono tracking-widest select-none">••••••••</span>
                  <button
                    type="button"
                    onClick={() => { setPasswordMode('replace'); setNewPassword(''); setTestState({ status: 'idle' }); }}
                    className="text-xs text-on-surface-variant hover:text-on-surface underline underline-offset-2 transition-colors"
                  >
                    Заменить
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="password"
                    autoFocus={isEdit}
                    className={inputClass}
                    placeholder={isEdit ? 'Новый пароль' : ''}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setTestState({ status: 'idle' }); }}
                  />
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => { setPasswordMode('keep'); setNewPassword(''); }}
                      className="text-on-surface-variant/60 hover:text-on-surface text-lg leading-none flex-shrink-0"
                      title="Отмена"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <label className="block">
            <span className="text-xs text-on-surface-variant mb-1 block">Порт (опционально)</span>
            <input
              className={inputClass}
              placeholder="1433"
              value={form.port ?? ''}
              onChange={e => setField('port', e.target.value ? Number(e.target.value) as unknown as undefined : undefined)}
            />
          </label>
        </div>
      </div>

      {/* Test result */}
      <AnimatePresence>
        {testState.status === 'ok' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Подключено за {testState.latencyMs} мс
          </motion.div>
        )}
        {testState.status === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
            {testState.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={!canTest || testState.status === 'testing'}
          className="ui-button-secondary rounded-lg px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testState.status === 'testing' ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
              Проверка...
            </span>
          ) : 'Проверить подключение'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="ui-button-primary rounded-lg px-4 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
