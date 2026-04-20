'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BASE_PATH } from '@/lib/constants';
import SourceEditorActions from './source-editor/SourceEditorActions';
import SourceEditorForm from './source-editor/SourceEditorForm';
import SourceEditorReview from './source-editor/SourceEditorReview';
import type { SourceEditorProps, SourceEditorPhase } from './source-editor/types';
import { normalizeSourceForSave } from './source-editor/utils';
import { useSourceEditorLocalState } from './source-editor/useSourceEditorLocalState';

export default function SourceEditor({
  connections,
  initial,
  onSaved,
}: SourceEditorProps) {
  const isEdit = !!initial;
  const [phase, setPhase] = useState<SourceEditorPhase>(initial ? 'review' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [rescanningTable, setRescanningTable] = useState<string | null>(null);
  const [rescanMsg, setRescanMsg] = useState<Record<string, string>>({});

  const {
    form,
    setField,
    source,
    setSource,
    fkFilterOpen,
    selectedConn,
    mainTable,
    refTables,
    canIntrospect,
    clearReviewedSource,
    setColumnFilterTier,
    setAllColumnFilterTier,
    toggleHidden,
    setAllHidden,
    setAllGroupable,
    setFkFilterTier,
    toggleGroupable,
    togglePeriodFilter,
    setColumnLabel,
    setTableDisplayName,
    toggleManualReport,
    setFkFilterPanelOpen,
    addFkFilter,
    removeFkFilter,
    setFkFilterConfig,
    isFkGroupByFieldChecked,
    toggleFkGroupByField,
    setFkGroupByPreset,
  } = useSourceEditorLocalState({
    initial,
    connections,
  });

  async function handleIntrospect() {
    setError(null);
    setLog([]);
    clearReviewedSource();
    setPhase('introspecting');

    const tables = form.tables
      .split('\n')
      .map(table => table.trim())
      .filter(Boolean);

    if (!tables.length) {
      setError('Введите хотя бы одну таблицу');
      setPhase('idle');
      return;
    }

    try {
      const response = await fetch(`${BASE_PATH}/api/admin/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          database: form.database,
          schema: form.schema,
          tables,
          connectionId: form.connectionId,
        }),
      });

      const data = await response.json();
      if (data.log) setLog(data.log);

      if (!response.ok || !data.source) {
        setError(data.error ?? 'Неизвестная ошибка');
        setPhase('idle');
        return;
      }

      setSource(data.source);
      setPhase('review');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Сетевая ошибка');
      setPhase('idle');
    }
  }

  async function handleSave() {
    if (!source) return;

    setPhase('saving');
    setError(null);

    const nextSource = normalizeSourceForSave(source, form);

    try {
      const response = await fetch(`${BASE_PATH}/api/admin/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: nextSource }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? 'Ошибка сохранения');
        setPhase('review');
        return;
      }

      setPhase('saved');
      onSaved?.(nextSource);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Сетевая ошибка');
      setPhase('review');
    }
  }

  async function handleRescan(tableName: string) {
    if (!source) return;

    setRescanningTable(tableName);
    setRescanMsg(current => ({ ...current, [tableName]: '' }));

    try {
      const response = await fetch(
        `${BASE_PATH}/api/admin/sources/${encodeURIComponent(source.id)}/rescan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableName }),
        },
      );
      const data = await response.json();

      if (!response.ok || !data.source) {
        setRescanMsg(current => ({
          ...current,
          [tableName]: `Ошибка: ${data.error ?? 'неизвестная ошибка'}`,
        }));
        return;
      }

      setSource(data.source);
      const newColumns = (data.newColumns as string[]) ?? [];

      setRescanMsg(current => ({
        ...current,
        [tableName]:
          newColumns.length > 0
            ? `найдено ${newColumns.length} новых колонок: ${newColumns.join(', ')}`
            : 'новых колонок не найдено',
      }));
    } catch (cause) {
      setRescanMsg(current => ({
        ...current,
        [tableName]: cause instanceof Error ? cause.message : 'Сетевая ошибка',
      }));
    } finally {
      setRescanningTable(null);
    }
  }

  function handleBackToForm() {
    setPhase('idle');
    clearReviewedSource();
    setLog([]);
  }

  function handleReset() {
    setPhase('idle');
    clearReviewedSource();
    setError(null);
    setLog([]);
    setRescanMsg({});
    setRescanningTable(null);
  }

  return (
    <div className="space-y-6">
      {(phase === 'idle' || phase === 'introspecting') && (
        <SourceEditorForm
          form={form}
          phase={phase}
          isEdit={isEdit}
          connections={connections}
          selectedConn={selectedConn}
          onFieldChange={setField}
        />
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {log.length > 0 && (
        <div className="space-y-0.5 rounded-lg border border-outline-variant/15 bg-surface-container p-3 font-mono text-xs text-on-surface-variant">
          {log.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {phase === 'review' && source && (
          <SourceEditorReview
            source={source}
            mainTable={mainTable}
            refTables={refTables}
            isEdit={isEdit}
            rescanningTable={rescanningTable}
            rescanMsg={rescanMsg}
            onToggleManualReport={toggleManualReport}
            onRescan={handleRescan}
            onSetTableDisplayName={setTableDisplayName}
            columnActions={{
              onSetAllColumnFilterTier: setAllColumnFilterTier,
              onSetAllGroupable: setAllGroupable,
              onSetAllHidden: setAllHidden,
              onSetColumnFilterTier: setColumnFilterTier,
              onToggleGroupable: toggleGroupable,
              onTogglePeriodFilter: togglePeriodFilter,
              onToggleHidden: toggleHidden,
              onSetColumnLabel: setColumnLabel,
            }}
            foreignKeyActions={{
              fkFilterOpen,
              onSetFkFilterTier: setFkFilterTier,
              onSetFkFilterPanelOpen: setFkFilterPanelOpen,
              onAddFkFilter: addFkFilter,
              onRemoveFkFilter: removeFkFilter,
              onSetFkFilterConfig: setFkFilterConfig,
              onIsFkGroupByFieldChecked: isFkGroupByFieldChecked,
              onToggleFkGroupByField: toggleFkGroupByField,
              onSetFkGroupByPreset: setFkGroupByPreset,
            }}
          />
        )}
      </AnimatePresence>

      {phase === 'saved' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-300"
        >
          <span>Источник сохранён.</span>
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto text-xs text-emerald-400 underline underline-offset-2 hover:text-emerald-200"
          >
            Добавить ещё
          </button>
        </motion.div>
      )}

      <SourceEditorActions
        phase={phase}
        canIntrospect={canIntrospect}
        onIntrospect={handleIntrospect}
        onBackToForm={handleBackToForm}
        onSave={handleSave}
      />
    </div>
  );
}
