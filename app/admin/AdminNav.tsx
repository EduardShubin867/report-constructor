'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BASE_PATH } from '@/lib/constants';

const TABS = [
  { label: 'Скиллы', href: '/admin/skills' },
  { label: 'Источники данных', href: '/admin/connections' },
];

export default function AdminNav() {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch(`${BASE_PATH}/api/admin/login`, { method: 'DELETE' });
    window.location.reload();
  }

  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant/15 shadow-sm px-6 py-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/reports"
            className="text-on-surface-variant/60 hover:text-on-surface text-sm transition-colors"
          >
            ← Отчёты
          </Link>
          <div className="w-px h-4 bg-outline-variant/20" />
          <h1 className="text-sm font-semibold text-on-surface">Админ-панель</h1>
          <button
            onClick={handleLogout}
            className="ml-auto text-xs text-on-surface-variant/60 hover:text-on-surface transition-colors"
          >
            Выйти
          </button>
        </div>

        <div className="flex items-center gap-1">
          {TABS.map(tab => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm rounded-t-lg transition-colors border-b-2 ${
                  isActive
                    ? 'text-primary font-medium border-primary'
                    : 'text-on-surface-variant hover:text-on-surface border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
