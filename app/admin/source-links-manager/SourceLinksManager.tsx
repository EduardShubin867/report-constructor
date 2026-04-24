'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BASE_PATH } from '@/lib/constants';
import type { ColumnDef } from '@/lib/report-columns';
import type { SharedPeriodLink, SourceLink } from '@/lib/schema';
import { emptyForm } from './constants';
import { SourceLinkEditor } from './SourceLinkEditor';
import { SourceLinkErrorBanner } from './SourceLinkErrorBanner';
import { SourceLinksManagerHeader } from './SourceLinksManagerHeader';
import { SourceLinksSavedList } from './SourceLinksSavedList';
import type { EditorState, SourceLinkFormState, SourceOption } from './types';

export default function SourceLinksManager() {
  const [links, setLinks] = useState<SourceLink[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [columnsBySource, setColumnsBySource] = useState<Record<string, ColumnDef[]>>({});
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [form, setForm] = useState<SourceLinkFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch(`${BASE_PATH}/api/admin/source-links`).then(response => response.json()),
      fetch(`${BASE_PATH}/api/admin/schema`).then(response => response.json()),
    ])
      .then(([linksData, schemaData]) => {
        setLinks(linksData.links ?? []);
        setSources(schemaData.sources ?? []);
      })
      .catch(() => {
        setError('Не удалось загрузить связи источников');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const sourceIds = [
      ...new Set(
        [
          ...links.flatMap(link => [link.leftSourceId, link.rightSourceId]),
          ...(editor.open ? [form.leftSourceId, form.rightSourceId] : []),
        ].filter(Boolean),
      ),
    ];

    for (const sourceId of sourceIds) {
      if (columnsBySource[sourceId]) continue;

      void fetch(`${BASE_PATH}/api/report/columns?sourceId=${encodeURIComponent(sourceId)}`)
        .then(response => response.json())
        .then(data => {
          const columns = ((data.columns ?? []) as ColumnDef[]).filter(
            column => column.type !== 'boolean',
          );
          setColumnsBySource(current => ({ ...current, [sourceId]: columns }));
        })
        .catch(() => {
          setError('Не удалось загрузить поля источника');
        });
    }
  }, [columnsBySource, editor, form.leftSourceId, form.rightSourceId, links]);

  function resetEditor(next?: Partial<SourceLinkFormState>) {
    setForm({ ...emptyForm, ...next });
    setError(null);
  }

  function openCreate() {
    setEditor({ open: true });
    resetEditor({
      leftSourceId: sources[0]?.id ?? '',
      rightSourceId: sources[1]?.id ?? sources[0]?.id ?? '',
    });
  }

  function openEdit(link: SourceLink) {
    setEditor({ open: true, initialId: link.id });
    resetEditor({
      id: link.id,
      name: link.name,
      description: link.description ?? '',
      leftSourceId: link.leftSourceId,
      leftJoinField: link.leftJoinField,
      rightSourceId: link.rightSourceId,
      rightJoinField: link.rightJoinField,
      sharedPeriodEnabled: !!link.sharedPeriodLink,
      sharedPeriodLabel: link.sharedPeriodLink?.label ?? '',
      sharedPeriodMode: link.sharedPeriodLink?.left.toField ? 'range' : 'single',
      sharedPeriodLeftFrom: link.sharedPeriodLink?.left.fromField ?? '',
      sharedPeriodLeftTo: link.sharedPeriodLink?.left.toField ?? '',
      sharedPeriodRightFrom: link.sharedPeriodLink?.right.fromField ?? '',
      sharedPeriodRightTo: link.sharedPeriodLink?.right.toField ?? '',
    });
  }

  function setField<K extends keyof SourceLinkFormState>(key: K, value: SourceLinkFormState[K]) {
    setForm(current => {
      const next = { ...current, [key]: value };

      if (key === 'leftSourceId') {
        next.leftJoinField = '';
      }
      if (key === 'rightSourceId') {
        next.rightJoinField = '';
      }

      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const payload: SourceLink = {
        id: form.id.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        leftSourceId: form.leftSourceId,
        leftJoinField: form.leftJoinField,
        rightSourceId: form.rightSourceId,
        rightJoinField: form.rightJoinField,
        sharedPeriodLink:
          form.sharedPeriodEnabled && form.sharedPeriodLeftFrom && form.sharedPeriodRightFrom
            ? {
                label: form.sharedPeriodLabel || 'Период',
                left:
                  form.sharedPeriodMode === 'range' && form.sharedPeriodLeftTo
                    ? { fromField: form.sharedPeriodLeftFrom, toField: form.sharedPeriodLeftTo }
                    : { fromField: form.sharedPeriodLeftFrom },
                right:
                  form.sharedPeriodMode === 'range' && form.sharedPeriodRightTo
                    ? { fromField: form.sharedPeriodRightFrom, toField: form.sharedPeriodRightTo }
                    : { fromField: form.sharedPeriodRightFrom },
              } satisfies SharedPeriodLink
            : undefined,
      };

      const response = await fetch(`${BASE_PATH}/api/admin/source-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: payload }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Ошибка сохранения');
      }

      setLinks(current => {
        const index = current.findIndex(link => link.id === payload.id);
        if (index >= 0) {
          const next = [...current];
          next[index] = payload;
          return next;
        }
        return [...current, payload];
      });

      setEditor({ open: false });
      resetEditor();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(
        `${BASE_PATH}/api/admin/source-links/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Ошибка удаления');
      }

      setLinks(current => current.filter(link => link.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  }

  const leftColumns = columnsBySource[form.leftSourceId] ?? [];
  const rightColumns = columnsBySource[form.rightSourceId] ?? [];
  const leftDateCols = leftColumns.filter(c => c.type === 'date');
  const rightDateCols = rightColumns.filter(c => c.type === 'date');
  const sourceSelectOptions = sources.map(source => ({
    value: source.id,
    label: source.name,
  }));
  const leftColumnOptions = leftColumns.map(column => ({
    value: column.key,
    label: column.label,
  }));
  const rightColumnOptions = rightColumns.map(column => ({
    value: column.key,
    label: column.label,
  }));
  const leftDateOptions = leftDateCols.map(column => ({
    value: column.key,
    label: column.label,
  }));
  const rightDateOptions = rightDateCols.map(column => ({
    value: column.key,
    label: column.label,
  }));
  const leftSourceName =
    sources.find(source => source.id === form.leftSourceId)?.name ?? 'Выберите источник';
  const rightSourceName =
    sources.find(source => source.id === form.rightSourceId)?.name ?? 'Выберите источник';
  const leftJoinLabel =
    leftColumns.find(column => column.key === form.leftJoinField)?.label ?? 'Поле не выбрано';
  const rightJoinLabel =
    rightColumns.find(column => column.key === form.rightJoinField)?.label ?? 'Поле не выбрано';

  function enableSharedPeriod() {
    setForm(cur => ({
      ...cur,
      sharedPeriodEnabled: true,
      sharedPeriodLabel: cur.sharedPeriodLabel || 'Период',
      sharedPeriodLeftFrom: cur.sharedPeriodLeftFrom || leftDateCols[0]?.key || '',
      sharedPeriodRightFrom: cur.sharedPeriodRightFrom || rightDateCols[0]?.key || '',
    }));
  }

  function disableSharedPeriod() {
    setForm(cur => ({ ...cur, sharedPeriodEnabled: false }));
  }

  function setPeriodField<K extends keyof SourceLinkFormState>(
    key: K,
    value: SourceLinkFormState[K],
  ) {
    setForm(cur => ({ ...cur, [key]: value }));
  }

  const canSave =
    Boolean(form.id.trim()) &&
    Boolean(form.name.trim()) &&
    Boolean(form.leftSourceId) &&
    Boolean(form.leftJoinField) &&
    Boolean(form.rightSourceId) &&
    Boolean(form.rightJoinField);

  function closeEditor() {
    setEditor({ open: false });
    resetEditor();
  }

  return (
    <div className="space-y-6">
      <SourceLinksManagerHeader editorOpen={editor.open} onAdd={openCreate} />

      <SourceLinkErrorBanner message={error} />

      <AnimatePresence>
        {editor.open ? (
          <SourceLinkEditor
            key="source-link-editor"
            initialId={editor.initialId}
            form={form}
            saving={saving}
            canSave={canSave}
            leftColumns={leftColumns}
            rightColumns={rightColumns}
            sourceSelectOptions={sourceSelectOptions}
            leftColumnOptions={leftColumnOptions}
            rightColumnOptions={rightColumnOptions}
            leftDateOptions={leftDateOptions}
            rightDateOptions={rightDateOptions}
            leftSourceName={leftSourceName}
            rightSourceName={rightSourceName}
            leftJoinLabel={leftJoinLabel}
            rightJoinLabel={rightJoinLabel}
            setField={setField}
            setPeriodField={setPeriodField}
            onClose={closeEditor}
            onSave={handleSave}
            onEnableSharedPeriod={enableSharedPeriod}
            onDisableSharedPeriod={disableSharedPeriod}
          />
        ) : null}
      </AnimatePresence>

      <SourceLinksSavedList
        loading={loading}
        links={links}
        sources={sources}
        columnsBySource={columnsBySource}
        deletingId={deletingId}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
