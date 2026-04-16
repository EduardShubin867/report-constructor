'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AppSelect from '@/components/ui/app-select';
import { BASE_PATH } from '@/lib/constants';
import type { ColumnDef } from '@/lib/report-columns';
import type { SharedPeriodLink, SourceLink } from '@/lib/schema';

type SourceOption = { id: string; name: string };

type EditorState =
  | { open: false }
  | {
      open: true;
      initialId?: string;
    };

type SourceLinkFormState = {
  id: string;
  name: string;
  description: string;
  leftSourceId: string;
  leftJoinField: string;
  rightSourceId: string;
  rightJoinField: string;
  // Shared period (flat, converted to SharedPeriodLink on save)
  sharedPeriodEnabled: boolean;
  sharedPeriodLabel: string;
  /** 'single' — one date field per source filtered with both >= from AND <= to.
   *  'range'  — separate fromField (>= from) and toField (<= to) per source. */
  sharedPeriodMode: 'single' | 'range';
  sharedPeriodLeftFrom: string;
  sharedPeriodLeftTo: string;
  sharedPeriodRightFrom: string;
  sharedPeriodRightTo: string;
};

const emptyForm: SourceLinkFormState = {
  id: '',
  name: '',
  description: '',
  leftSourceId: '',
  leftJoinField: '',
  rightSourceId: '',
  rightJoinField: '',
  sharedPeriodEnabled: false,
  sharedPeriodLabel: '',
  sharedPeriodMode: 'single',
  sharedPeriodLeftFrom: '',
  sharedPeriodLeftTo: '',
  sharedPeriodRightFrom: '',
  sharedPeriodRightTo: '',
};
const SHARED_PERIOD_MODE_OPTIONS = [
  {
    value: 'single',
    label: 'Одно поле (от — до по одному столбцу)',
  },
  {
    value: 'range',
    label: 'Два поля (начало ≥ от, конец ≤ до)',
  },
] as const;

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
    const sourceIds = [...new Set([
      ...links.flatMap(link => [link.leftSourceId, link.rightSourceId]),
      ...(editor.open ? [form.leftSourceId, form.rightSourceId] : []),
    ].filter(Boolean))];

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
        sharedPeriodLink: form.sharedPeriodEnabled && form.sharedPeriodLeftFrom && form.sharedPeriodRightFrom
          ? {
              label: form.sharedPeriodLabel || 'Период',
              left: form.sharedPeriodMode === 'range' && form.sharedPeriodLeftTo
                ? { fromField: form.sharedPeriodLeftFrom, toField: form.sharedPeriodLeftTo }
                : { fromField: form.sharedPeriodLeftFrom },
              right: form.sharedPeriodMode === 'range' && form.sharedPeriodRightTo
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
      const response = await fetch(`${BASE_PATH}/api/admin/source-links/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
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
  // All date-type columns — no periodFilter flag required for the shared period config
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

  function setPeriodField<K extends keyof SourceLinkFormState>(key: K, value: SourceLinkFormState[K]) {
    setForm(cur => ({ ...cur, [key]: value }));
  }

  const canSave =
    Boolean(form.id.trim()) &&
    Boolean(form.name.trim()) &&
    Boolean(form.leftSourceId) &&
    Boolean(form.leftJoinField) &&
    Boolean(form.rightSourceId) &&
    Boolean(form.rightJoinField);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Конструктор связей
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-on-surface">
              Визуальные связи между источниками
            </h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Здесь можно заранее описать, как два источника нужно связывать между собой. Эти
              настройки затем используются в новой вкладке сводного отчёта.
            </p>
          </div>

          {!editor.open ? (
            <button
              type="button"
              onClick={openCreate}
              className="ui-button-secondary rounded-xl px-4 py-2 text-sm font-medium"
            >
              + Добавить связь
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <AnimatePresence>
        {editor.open ? (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Редактор связи
                </p>
                <h3 className="mt-1 text-lg font-semibold text-on-surface">
                  {editor.initialId ? `Изменение: ${form.name || editor.initialId}` : 'Новая связь'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditor({ open: false });
                  resetEditor();
                }}
                className="text-on-surface-variant hover:text-on-surface text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-on-surface-variant">ID связи</span>
                <input
                  value={form.id}
                  onChange={event => setField('id', event.target.value)}
                  disabled={Boolean(editor.initialId)}
                  className="ui-field h-11 w-full rounded-xl px-3 text-sm focus:border-primary/50 focus:outline-none disabled:opacity-60"
                  placeholder="client-product-link"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-on-surface-variant">Название</span>
                <input
                  value={form.name}
                  onChange={event => setField('name', event.target.value)}
                  className="ui-field h-11 w-full rounded-xl px-3 text-sm focus:border-primary/50 focus:outline-none"
                  placeholder="Клиент ↔ продукт"
                />
              </label>

              <label className="block xl:col-span-2">
                <span className="mb-1 block text-xs text-on-surface-variant">Описание</span>
                <textarea
                  value={form.description}
                  onChange={event => setField('description', event.target.value)}
                  rows={3}
                  className="ui-field w-full rounded-xl px-3 py-3 text-sm focus:border-primary/50 focus:outline-none"
                  placeholder="Например: связываем журнал клиентов с продуктовой витриной по фамилии и коду продукта."
                />
              </label>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
              <div className="rounded-[26px] border border-primary/15 bg-primary-fixed/35 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                  Левая сторона
                </p>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-on-surface-variant">Источник</span>
                    <AppSelect
                      value={form.leftSourceId}
                      onValueChange={value => setField('leftSourceId', value)}
                      options={sourceSelectOptions}
                      placeholder="Выберите источник"
                      triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
                      labelClassName="text-sm"
                      ariaLabel="Выбор левого источника"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-on-surface-variant">Поле связи</span>
                    <AppSelect
                      value={form.leftJoinField}
                      onValueChange={value => setField('leftJoinField', value)}
                      options={leftColumnOptions}
                      placeholder="Выберите поле"
                      triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
                      labelClassName="text-sm"
                      ariaLabel="Выбор левого поля связи"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="rounded-full border border-outline-variant/15 bg-surface-container p-4 text-center">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    join
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-tertiary/15 bg-tertiary-fixed/35 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-tertiary/80">
                  Правая сторона
                </p>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-on-surface-variant">Источник</span>
                    <AppSelect
                      value={form.rightSourceId}
                      onValueChange={value => setField('rightSourceId', value)}
                      options={sourceSelectOptions}
                      placeholder="Выберите источник"
                      triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
                      labelClassName="text-sm"
                      ariaLabel="Выбор правого источника"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-on-surface-variant">Поле связи</span>
                    <AppSelect
                      value={form.rightJoinField}
                      onValueChange={value => setField('rightJoinField', value)}
                      options={rightColumnOptions}
                      placeholder="Выберите поле"
                      triggerClassName="ui-field h-11 rounded-xl px-3 text-sm focus:border-primary/50"
                      labelClassName="text-sm"
                      ariaLabel="Выбор правого поля связи"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[26px] border border-outline-variant/15 bg-surface-container-low/45 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Предпросмотр графа
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                  <p className="text-xs text-on-surface-variant">Источник</p>
                  <p className="mt-1 font-semibold text-on-surface">{leftSourceName}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">Поле</p>
                  <p className="mt-1 text-sm text-on-surface">{leftJoinLabel}</p>
                </div>

                <div className="flex items-center justify-center text-sm font-medium text-on-surface-variant">
                  <span className="rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2">
                    совпадение по значению
                  </span>
                </div>

                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                  <p className="text-xs text-on-surface-variant">Источник</p>
                  <p className="mt-1 font-semibold text-on-surface">{rightSourceName}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">Поле</p>
                  <p className="mt-1 text-sm text-on-surface">{rightJoinLabel}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[26px] border border-outline-variant/15 bg-surface-container-low/45 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    Общий период
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Единый фильтр диапазона дат для обоих источников — можно выбрать любое поле типа date.
                  </p>
                </div>
                {leftDateCols.length > 0 && rightDateCols.length > 0 && (
                  form.sharedPeriodEnabled ? (
                    <button type="button" onClick={disableSharedPeriod}
                      className="shrink-0 text-sm text-red-500 hover:text-red-400 transition-colors">
                      Убрать
                    </button>
                  ) : (
                    <button type="button" onClick={enableSharedPeriod}
                      className="shrink-0 text-sm text-primary hover:text-primary/70 transition-colors">
                      + Включить
                    </button>
                  )
                )}
              </div>

              {!form.leftSourceId || !form.rightSourceId ? (
                <p className="mt-3 text-xs text-on-surface-variant/70">Выберите оба источника.</p>
              ) : leftDateCols.length === 0 || rightDateCols.length === 0 ? (
                <p className="mt-3 text-xs text-on-surface-variant/70">
                  Один или оба источника не содержат полей типа date. Добавьте их в схеме источника.
                </p>
              ) : !form.sharedPeriodEnabled ? (
                <p className="mt-3 text-xs text-on-surface-variant/70">
                  Не настроен. Нажмите «+ Включить».
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {/* Mode toggle */}
                  <div className="flex gap-4">
                    <AppSelect
                      value={form.sharedPeriodMode}
                      onValueChange={value =>
                        setPeriodField('sharedPeriodMode', value as 'single' | 'range')
                      }
                      options={[...SHARED_PERIOD_MODE_OPTIONS]}
                      triggerClassName="ui-field h-10 rounded-xl px-3 text-sm focus:border-primary/50"
                      contentClassName="max-w-[min(32rem,calc(100vw-2rem))]"
                      itemClassName="items-start py-2.5 whitespace-normal"
                      labelClassName="text-sm"
                      ariaLabel="Выбор режима общего периода"
                    />
                  </div>

                  {/* Label */}
                  <label className="block max-w-sm">
                    <span className="mb-1 block text-xs text-on-surface-variant">Название фильтра</span>
                    <input
                      value={form.sharedPeriodLabel}
                      onChange={e => setPeriodField('sharedPeriodLabel', e.target.value)}
                      className="ui-field h-9 w-full rounded-xl px-3 text-sm focus:border-primary/50 focus:outline-none"
                      placeholder="Период договора"
                    />
                  </label>

                  {/* Field selectors */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-primary/12 bg-primary-fixed/20 p-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/70">Слева</p>
                      <label className="block">
                        <span className="mb-1 block text-xs text-on-surface-variant">
                          {form.sharedPeriodMode === 'range' ? 'Поле начала (≥ от)' : 'Поле даты'}
                        </span>
                        <AppSelect
                          value={form.sharedPeriodLeftFrom}
                          onValueChange={value => setPeriodField('sharedPeriodLeftFrom', value)}
                          options={leftDateOptions}
                          placeholder="— выберите —"
                          triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                          labelClassName="text-sm"
                          ariaLabel="Выбор левого поля периода"
                        />
                      </label>
                      {form.sharedPeriodMode === 'range' && (
                        <label className="block">
                          <span className="mb-1 block text-xs text-on-surface-variant">Поле конца (≤ до)</span>
                          <AppSelect
                            value={form.sharedPeriodLeftTo}
                            onValueChange={value => setPeriodField('sharedPeriodLeftTo', value)}
                            options={leftDateOptions}
                            placeholder="— выберите —"
                            triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                            labelClassName="text-sm"
                            ariaLabel="Выбор левого поля конца периода"
                          />
                        </label>
                      )}
                    </div>

                    <div className="rounded-2xl border border-tertiary/12 bg-tertiary-fixed/20 p-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary/70">Справа</p>
                      <label className="block">
                        <span className="mb-1 block text-xs text-on-surface-variant">
                          {form.sharedPeriodMode === 'range' ? 'Поле начала (≥ от)' : 'Поле даты'}
                        </span>
                        <AppSelect
                          value={form.sharedPeriodRightFrom}
                          onValueChange={value => setPeriodField('sharedPeriodRightFrom', value)}
                          options={rightDateOptions}
                          placeholder="— выберите —"
                          triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                          labelClassName="text-sm"
                          ariaLabel="Выбор правого поля периода"
                        />
                      </label>
                      {form.sharedPeriodMode === 'range' && (
                        <label className="block">
                          <span className="mb-1 block text-xs text-on-surface-variant">Поле конца (≤ до)</span>
                          <AppSelect
                            value={form.sharedPeriodRightTo}
                            onValueChange={value => setPeriodField('sharedPeriodRightTo', value)}
                            options={rightDateOptions}
                            placeholder="— выберите —"
                            triggerClassName="ui-field h-9 rounded-xl px-3 text-sm focus:border-primary/50"
                            labelClassName="text-sm"
                            ariaLabel="Выбор правого поля конца периода"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditor({ open: false });
                  resetEditor();
                }}
                className="px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || saving}
                className="ui-button-primary rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Сохраняем…' : editor.initialId ? 'Сохранить изменения' : 'Сохранить связь'}
              </button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Сохранённые связи</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Каждая связь определяет пару источников и поля, по которым новая вкладка будет собирать общий отчёт.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-6 text-sm text-on-surface-variant">
              Загрузка…
            </div>
          ) : links.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-lowest px-4 py-8 text-center text-sm text-on-surface-variant">
              Пока нет ни одной связи. Создайте первую, чтобы в отчётах появилась вкладка сводки.
            </div>
          ) : (
            links.map(link => {
              const leftName =
                sources.find(source => source.id === link.leftSourceId)?.name ?? link.leftSourceId;
              const rightName =
                sources.find(source => source.id === link.rightSourceId)?.name ?? link.rightSourceId;
              const leftLabel =
                columnsBySource[link.leftSourceId]?.find(column => column.key === link.leftJoinField)
                  ?.label ?? link.leftJoinField;
              const rightLabel =
                columnsBySource[link.rightSourceId]?.find(column => column.key === link.rightJoinField)
                  ?.label ?? link.rightJoinField;

              return (
                <div
                  key={link.id}
                  className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                          {link.id}
                        </span>
                        <h4 className="text-lg font-semibold text-on-surface">{link.name}</h4>
                      </div>
                      {link.description ? (
                        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                          {link.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(link)}
                        className="text-sm text-primary hover:text-primary/70 transition-colors"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(link.id)}
                        disabled={deletingId === link.id}
                        className="text-sm text-red-600 hover:text-red-500 disabled:opacity-50 transition-colors"
                      >
                        {deletingId === link.id ? 'Удаление…' : 'Удалить'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
                    <div className="rounded-2xl border border-outline-variant/15 bg-primary-fixed/25 p-4">
                      <p className="text-xs text-on-surface-variant">Левый источник</p>
                      <p className="mt-1 font-semibold text-on-surface">{leftName}</p>
                      <p className="mt-3 text-xs text-on-surface-variant">Поле связи</p>
                      <p className="mt-1 text-sm text-on-surface">{leftLabel}</p>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2 text-xs font-medium text-on-surface-variant">
                        match
                      </span>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/15 bg-tertiary-fixed/25 p-4">
                      <p className="text-xs text-on-surface-variant">Правый источник</p>
                      <p className="mt-1 font-semibold text-on-surface">{rightName}</p>
                      <p className="mt-3 text-xs text-on-surface-variant">Поле связи</p>
                      <p className="mt-1 text-sm text-on-surface">{rightLabel}</p>
                    </div>
                  </div>

                  {link.sharedPeriodLink ? (
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-full border border-outline-variant/15 bg-surface-container px-3 py-1 text-xs text-on-surface-variant">
                        📅 {link.sharedPeriodLink.label}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
