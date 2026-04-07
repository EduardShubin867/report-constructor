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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 bg-zinc-900 border border-zinc-800 rounded-xl p-8"
      >
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Админ-панель</h1>
          <p className="text-sm text-zinc-500 mt-1">Введите пароль для входа</p>
        </div>

        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
          />
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
