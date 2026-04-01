'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SourceEditor from '@/components/SourceEditor';
import ConnectionEditor from '@/components/ConnectionEditor';
import { BASE_PATH } from '@/lib/constants';
import type { DataSource, StoredConnection } from '@/lib/schema/types';

type ConnEditorState = { open: false } | { open: true; initial?: StoredConnection };
type SourceEditorState = { open: false } | { open: true; initial?: DataSource };

export default function SourcesManager() {
  const [connections, setConnections] = useState<StoredConnection[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  const [connEditor, setConnEditor] = useState<ConnEditorState>({ open: false });
  const [sourceEditor, setSourceEditor] = useState<SourceEditorState>({ open: false });
  const [deletingConnId, setDeletingConnId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [connDeleteError, setConnDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/api/admin/connections`)
      .then(r => r.json())
      .then(d => setConnections(d.connections ?? []))
      .catch(() => { })
      .finally(() => setLoadingConnections(false));

    fetch(`${BASE_PATH}/api/admin/sources`)
      .then(r => r.json())
      .then(d => setSources(d.sources ?? []))
      .catch(() => { })
      .finally(() => setLoadingSources(false));
  }, []);

  async function handleDeleteConnection(id: string) {
    setDeletingConnId(id);
    setConnDeleteError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/admin/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setConnDeleteError(data.error ?? 'Ошибка удаления');
        return;
      }
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch {
      setConnDeleteError('Сетевая ошибка');
    } finally {
      setDeletingConnId(null);
    }
  }

  async function handleDeleteSource(id: string) {
    setDeletingSourceId(id);
    try {
      await fetch(`${BASE_PATH}/api/admin/sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSources(prev => prev.filter(s => s.id !== id));
    } catch { /* noop */ } finally {
      setDeletingSourceId(null);
    }
  }

  function handleConnectionSaved(conn: StoredConnection) {
    setConnections(prev => {
      const idx = prev.findIndex(c => c.id === conn.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = conn; return next; }
      return [...prev, conn];
    });
    setConnEditor({ open: false });
  }

  function handleSourceSaved(source: DataSource) {
    setSources(prev => {
      const idx = prev.findIndex(s => s.id === source.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = source; return next; }
      return [...prev, source];
    });
    setSourceEditor({ open: false });
  }

  const sourcesByConnection = (connId: string) =>
    sources.filter(s => s.connectionId === connId).map(s => s.name);

  const connEditorTitle = connEditor.open && connEditor.initial
    ? `Редактировать: ${connEditor.initial.name}`
    : 'Новое подключение';

  const sourceEditorTitle = sourceEditor.open && sourceEditor.initial
    ? `Редактировать: ${sourceEditor.initial.name}`
    : 'Новый источник данных';

  return (
    <div className="space-y-10">

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: CONNECTIONS
      ══════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-200">Подключения к БД</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Один пул соединений на подключение. Несколько источников могут использовать одно подключение.</p>
          </div>
          {!connEditor.open && (
            <button
              onClick={() => setConnEditor({ open: true })}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-zinc-200 transition-colors flex-shrink-0"
            >
              + Добавить
            </button>
          )}
        </div>

        {/* Connection editor */}
        <AnimatePresence>
          {connEditor.open && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 mb-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-300">{connEditorTitle}</h3>
                <button onClick={() => setConnEditor({ open: false })} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
              </div>
              <ConnectionEditor
                initial={connEditor.open ? connEditor.initial : undefined}
                onSaved={handleConnectionSaved}
                onCancel={() => setConnEditor({ open: false })}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete error */}
        <AnimatePresence>
          {connDeleteError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-red-950/60 border border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-300 mb-3"
            >
              {connDeleteError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connections table */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800/50 text-zinc-400 text-xs">
                <th className="text-left px-4 py-2.5 font-medium">ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Название</th>
                <th className="text-left px-4 py-2.5 font-medium">Диалект</th>
                <th className="text-left px-4 py-2.5 font-medium">Сервер</th>
                <th className="text-right px-4 py-2.5 font-medium">Используется</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loadingConnections ? (
                <tr><td colSpan={6} className="px-4 py-3 text-xs text-zinc-500">Загрузка...</td></tr>
              ) : connections.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-4 text-xs text-zinc-500 text-center">Нет подключений</td></tr>
              ) : (
                connections.map(c => {
                  const usedBy = sourcesByConnection(c.id);
                  const isEditing = connEditor.open && connEditor.initial?.id === c.id;
                  return (
                    <tr key={c.id} className={`border-t border-zinc-800/60 hover:bg-zinc-800/20 ${isEditing ? 'bg-zinc-800/30' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{c.id}</td>
                      <td className="px-4 py-2.5 text-zinc-200">{c.name}</td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs">{c.dialect}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{c.server}</td>
                      <td className="px-4 py-2.5 text-right">
                        {usedBy.length > 0 ? (
                          <span className="text-xs text-zinc-400" title={usedBy.join(', ')}>{usedBy.length} источн.</span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setConnEditor({ open: true, initial: c })}
                            disabled={connEditor.open}
                            className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
                          >
                            Изменить
                          </button>
                          <button
                            onClick={() => handleDeleteConnection(c.id)}
                            disabled={deletingConnId === c.id}
                            className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                          >
                            {deletingConnId === c.id ? 'Удаление...' : 'Удалить'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: DATA SOURCES
      ══════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-200">Источники данных</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Каждый источник — набор таблиц из одного подключения. Агент работает со всеми источниками одновременно.</p>
          </div>
          {!sourceEditor.open && (
            <button
              onClick={() => setSourceEditor({ open: true })}
              disabled={connections.length === 0}
              title={connections.length === 0 ? 'Сначала создайте подключение' : undefined}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-zinc-200 transition-colors flex-shrink-0"
            >
              + Добавить
            </button>
          )}
        </div>

        {/* Source editor */}
        <AnimatePresence>
          {sourceEditor.open && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 mb-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-300">{sourceEditorTitle}</h3>
                <button onClick={() => setSourceEditor({ open: false })} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
              </div>
              <SourceEditor
                connections={connections}
                initial={sourceEditor.open ? sourceEditor.initial : undefined}
                onSaved={handleSourceSaved}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sources table */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800/50 text-zinc-400 text-xs">
                <th className="text-left px-4 py-2.5 font-medium">ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Название</th>
                <th className="text-left px-4 py-2.5 font-medium">Подключение</th>
                <th className="text-left px-4 py-2.5 font-medium">База</th>
                <th className="text-right px-4 py-2.5 font-medium">Таблиц</th>
                <th className="text-right px-4 py-2.5 font-medium">Колонок</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loadingSources ? (
                <tr><td colSpan={7} className="px-4 py-3 text-xs text-zinc-500">Загрузка...</td></tr>
              ) : sources.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-4 text-xs text-zinc-500 text-center">Нет источников</td></tr>
              ) : (
                sources.map(s => {
                  const mainTable = s.tables.find(t => t.columns.length > 0);
                  const colCount = mainTable?.columns.length ?? 0;
                  const conn = connections.find(c => c.id === s.connectionId);
                  const isEditing = sourceEditor.open && sourceEditor.initial?.id === s.id;
                  return (
                    <tr key={s.id} className={`border-t border-zinc-800/60 hover:bg-zinc-800/20 ${isEditing ? 'bg-zinc-800/30' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{s.id}</td>
                      <td className="px-4 py-2.5 text-zinc-200">{s.name}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {conn ? (
                          <span className="text-zinc-400">{conn.name}</span>
                        ) : s.connectionId ? (
                          <span className="text-red-400">{s.connectionId} (не найдено)</span>
                        ) : (
                          <span className="text-zinc-500">(.env)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-zinc-400">
                        {s.database ?? <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-400 tabular-nums">{s.tables.length}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-400 tabular-nums">{colCount}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setSourceEditor({ open: true, initial: s })}
                            disabled={sourceEditor.open}
                            className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
                          >
                            Изменить
                          </button>
                          <button
                            onClick={() => handleDeleteSource(s.id)}
                            disabled={deletingSourceId === s.id}
                            className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                          >
                            {deletingSourceId === s.id ? 'Удаление...' : 'Удалить'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Info ─────────────────────────────────────────────────────── */}
      <section className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
        <p className="text-zinc-400 font-medium text-sm mb-2">Как это работает</p>
        <p>1. Создайте подключение к БД и проверьте его кнопкой «Проверить подключение».</p>
        <p>2. Добавьте источник данных — выберите подключение и укажите список таблиц.</p>
        <p>3. AI сам подключится к БД, прочитает схему и расставит типы колонок и связи.</p>
        <p>4. Несколько источников из одной БД используют один пул соединений.</p>
        <p>5. После сохранения агент в /reports сразу начинает работать с новым источником.</p>
      </section>
    </div>
  );
}
