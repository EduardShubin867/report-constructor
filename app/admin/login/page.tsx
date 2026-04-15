'use client';

import { useState } from 'react';
import { BASE_PATH } from '@/lib/constants';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${BASE_PATH}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Ошибка входа');
        return;
      }

      window.location.reload();
    } catch {
      setError('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-container-low/30 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="ui-panel w-full max-w-sm rounded-2xl p-8 space-y-6"
      >
        <div>
          <h1 className="font-headline text-xl font-semibold text-on-surface">Админ-панель</h1>
          <p className="text-sm text-on-surface-variant mt-1">Введите пароль для входа</p>
        </div>

        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            className="ui-field w-full rounded-xl px-3 py-2.5 text-sm"
          />
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="ui-button-primary w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
