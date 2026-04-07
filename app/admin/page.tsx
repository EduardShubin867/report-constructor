'use client';

import Link from 'next/link';
import { useState } from 'react';
import SourcesManager from './SourcesManager';
import SkillsManager from './SkillsManager';
import { BASE_PATH } from '@/lib/constants';

type Tab = 'skills' | 'connections';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('skills');

  async function handleLogout() {
    await fetch(`${BASE_PATH}/api/admin/login`, { method: 'DELETE' });
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/reports"
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Отчёты
          </Link>
          <div className="w-px h-4 bg-zinc-700" />
          <h1 className="text-sm font-semibold text-zinc-200">Админ-панель</h1>
          <button
            onClick={handleLogout}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Выйти
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === 'skills'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            Скиллы
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === 'connections'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            Подключения к БД
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'skills' && <SkillsManager />}
        {activeTab === 'connections' && <SourcesManager />}
      </main>
    </div>
  );
}
