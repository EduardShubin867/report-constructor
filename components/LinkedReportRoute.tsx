'use client';

import Link from 'next/link';
import { Calendar, FileSpreadsheet, GitMerge, Network, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ColumnSelector from '@/components/ColumnSelector';
import GenericReportFilters from '@/components/GenericReportFilters';
import ReportsChrome from '@/components/ReportsChrome';
import UnifiedReportTable from '@/components/UnifiedReportTable';
import AppSelect from '@/components/ui/app-select';
import { DatePicker } from '@/components/ui/date-picker';
import { BASE_PATH } from '@/lib/constants';
import type { LinkedReportResponse } from '@/lib/linked-report';
import type { ManualReportSourcePayload } from '@/lib/report-filters-data';
import type { SourceLink } from '@/lib/schema';

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

const emptyBootstrap: ManualReportSourcePayload = {
  columns: [],
  groupByColumns: [],
  filterOptions: { filterDefs: [], options: {}, periodFilterCols: [] },
};
const NO_AGGREGATION_VALUE = '__none__';

interface LinkedReportRouteProps {
  links: SourceLink[];
  sourceNamesById: Record<string, string>;
  bootstrapBySourceId: Record<string, ManualReportSourcePayload>;
  /** Сервер: LINKED_REPORT_ALLOW_UNLIMITED=1 — показать опцию полного снятия лимитов. */
  linkedReportAllowUnlimited?: boolean;
}

type Side = 'left' | 'right';
type FiltersMap = Record<string, string[]>;

function buildDefaultColumns(payload: ManualReportSourcePayload, joinField: string): string[] {
  const preferred = [joinField];
  for (const column of payload.columns) {
    if (column.key !== joinField) {
      preferred.push(column.key);
    }
    if (preferred.length >= 4) break;
  }
  return [...new Set(preferred)].filter(Boolean);
}

function getColumnLabel(payload: ManualReportSourcePayload, key: string): string {
  return payload.columns.find(column => column.key === key)?.label ?? key;
}

function getLinkLabel(
  link: SourceLink,
  sourceNamesById: Record<string, string>,
  bootstrapBySourceId: Record<string, ManualReportSourcePayload>,
) {
  const leftPayload = bootstrapBySourceId[link.leftSourceId] ?? emptyBootstrap;
  const rightPayload = bootstrapBySourceId[link.rightSourceId] ?? emptyBootstrap;
  const leftSourceName = sourceNamesById[link.leftSourceId] ?? link.leftSourceId;
  const rightSourceName = sourceNamesById[link.rightSourceId] ?? link.rightSourceId;
  const leftJoinLabel = getColumnLabel(leftPayload, link.leftJoinField);
  const rightJoinLabel = getColumnLabel(rightPayload, link.rightJoinField);

  return `${link.name} — ${leftSourceName}: ${leftJoinLabel} ↔ ${rightSourceName}: ${rightJoinLabel}`;
}

export default function LinkedReportRoute(props: LinkedReportRouteProps) {
  const [reportKey, setReportKey] = useState(0);

  return (
    <LinkedReportWorkspace
      key={reportKey}
      {...props}
      onNewSession={() => setReportKey(current => current + 1)}
    />
  );
}

interface LinkedReportWorkspaceProps extends LinkedReportRouteProps {
  onNewSession: () => void;
}

function LinkedReportWorkspace({
  links,
  sourceNamesById,
  bootstrapBySourceId,
  linkedReportAllowUnlimited = false,
  onNewSession,
}: LinkedReportWorkspaceProps) {
  const [selectedLinkId, setSelectedLinkId] = useState(links[0]?.id ?? '');
  const activeLink = links.find(link => link.id === selectedLinkId) ?? null;
  const leftBootstrap = activeLink
    ? bootstrapBySourceId[activeLink.leftSourceId] ?? emptyBootstrap
    : emptyBootstrap;
  const rightBootstrap = activeLink
    ? bootstrapBySourceId[activeLink.rightSourceId] ?? emptyBootstrap
    : emptyBootstrap;

  const [leftColumns, setLeftColumns] = useState<string[]>(
    activeLink ? buildDefaultColumns(leftBootstrap, activeLink.leftJoinField) : [],
  );
  const [rightColumns, setRightColumns] = useState<string[]>(
    activeLink ? buildDefaultColumns(rightBootstrap, activeLink.rightJoinField) : [],
  );
  const [leftFilters, setLeftFilters] = useState<FiltersMap>({});
  const [rightFilters, setRightFilters] = useState<FiltersMap>({});
  const [sharedPeriod, setSharedPeriod] = useState({ from: '', to: '' });
  const [lazyOptions, setLazyOptions] = useState<Record<Side, Record<string, string[]>>>({
    left: {},
    right: {},
  });
  const [lazyLoading, setLazyLoading] = useState<Record<Side, Record<string, boolean>>>({
    left: {},
    right: {},
  });
  const [result, setResult] = useState<LinkedReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  /** Пустая строка — без агрегации; иначе ключ колонки ответа (__matchKey, left__…, right__…). */
  const [aggregateByColumnKey, setAggregateByColumnKey] = useState('');
  /** false → лимит 5000 строк результата; true → mergedRowLimit: null (потолок на сервере). */
  const [raiseMergedRowLimit, setRaiseMergedRowLimit] = useState(false);
  /** false → TOP 1000 на каждый источник; true → sourceRowLimit: null (потолок LINKED_REPORT_SOURCE_ROW_CAP). */
  const [raiseSourceRowLimit, setRaiseSourceRowLimit] = useState(false);
  /** mergedRowLimit и sourceRowLimit = -1 (без обрезки и без TOP); только если linkedReportAllowUnlimited. */
  const [fullyUnlimitedRows, setFullyUnlimitedRows] = useState(false);
  const lazyLoadedRef = useRef<Record<Side, Set<string>>>({
    left: new Set<string>(),
    right: new Set<string>(),
  });

  useEffect(() => {
    if (!activeLink) return;
    setLeftColumns(buildDefaultColumns(leftBootstrap, activeLink.leftJoinField));
    setRightColumns(buildDefaultColumns(rightBootstrap, activeLink.rightJoinField));
    setLeftFilters({});
    setRightFilters({});
    setSharedPeriod({ from: '', to: '' });
    setLazyOptions({ left: {}, right: {} });
    setLazyLoading({ left: {}, right: {} });
    setResult(null);
    setError(null);
    setAggregateByColumnKey('');
    setRaiseMergedRowLimit(false);
    setRaiseSourceRowLimit(false);
    setFullyUnlimitedRows(false);
    lazyLoadedRef.current.left = new Set<string>();
    lazyLoadedRef.current.right = new Set<string>();
  }, [activeLink, leftBootstrap, rightBootstrap]);

  useEffect(() => {
    const allowed = new Set([
      '',
      '__matchKey',
      ...leftColumns.map(k => `left__${k}`),
      ...rightColumns.map(k => `right__${k}`),
    ]);
    if (aggregateByColumnKey && !allowed.has(aggregateByColumnKey)) {
      setAggregateByColumnKey('');
    }
  }, [aggregateByColumnKey, leftColumns, rightColumns]);

  async function handleLazyOpen(side: Side, sourceId: string, key: string) {
    if (lazyLoadedRef.current[side].has(key) || lazyLoading[side][key]) {
      return;
    }

    setLazyLoading(current => ({
      ...current,
      [side]: { ...current[side], [key]: true },
    }));

    try {
      const response = await fetch(
        `${BASE_PATH}/api/report/filter-options?sourceId=${encodeURIComponent(sourceId)}&key=${encodeURIComponent(key)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Ошибка загрузки значений');
      }

      setLazyOptions(current => ({
        ...current,
        [side]: { ...current[side], [key]: data.values ?? [] },
      }));
      lazyLoadedRef.current[side].add(key);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка загрузки значений фильтра');
    } finally {
      setLazyLoading(current => ({
        ...current,
        [side]: { ...current[side], [key]: false },
      }));
    }
  }

  function buildLinkedRequestBody() {
    if (!activeLink) return null;

    const base = {
      linkId: activeLink.id,
      leftColumns,
      rightColumns,
      leftFilters,
      rightFilters,
      ...(activeLink.sharedPeriodLink && (sharedPeriod.from || sharedPeriod.to)
        ? { sharedPeriodValue: sharedPeriod }
        : {}),
      ...(aggregateByColumnKey ? { aggregateByColumnKey } : {}),
    };
    if (linkedReportAllowUnlimited && fullyUnlimitedRows) {
      return {
        ...base,
        mergedRowLimit: -1,
        sourceRowLimit: -1,
      };
    }
    return {
      ...base,
      ...(raiseMergedRowLimit ? { mergedRowLimit: null } : {}),
      ...(raiseSourceRowLimit ? { sourceRowLimit: null } : {}),
    };
  }

  async function handleSubmit() {
    if (!activeLink) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BASE_PATH}/api/report/linked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildLinkedRequestBody()),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Ошибка построения сводного отчёта');
      }

      setResult(data as LinkedReportResponse);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Ошибка построения сводного отчёта');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportLinked() {
    if (!activeLink) return;
    setExporting(true);
    setError(null);
    try {
      const body = buildLinkedRequestBody();
      if (!body) return;
      const response = await fetch(`${BASE_PATH}/api/report/linked/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Ошибка экспорта');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = Object.assign(document.createElement('a'), {
        href: url,
        download: `linked_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  }

  if (!activeLink) {
    return (
      <ReportsChrome onCreateReport={onNewSession} headerActions={null}>
        <motion.div {...fadeSlide}>
          <div className="ui-panel rounded-[30px] p-8 sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                Сводный отчёт
              </span>
              <h2 className="mt-4 font-headline text-2xl font-semibold text-on-surface">
                Связи между источниками ещё не настроены
              </h2>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                Сначала создайте хотя бы одну связь в админке: выберите два источника и поле, по которому
                их нужно склеивать.
              </p>
              <Link
                href="/admin/source-links"
                className="ui-button-primary mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-medium"
              >
                Открыть раздел связей
              </Link>
            </div>
          </div>
        </motion.div>
      </ReportsChrome>
    );
  }

  const leftSourceName = sourceNamesById[activeLink.leftSourceId] ?? activeLink.leftSourceId;
  const rightSourceName = sourceNamesById[activeLink.rightSourceId] ?? activeLink.rightSourceId;
  const canRun = leftColumns.length > 0 || rightColumns.length > 0;
  const leftOptions = { ...leftBootstrap.filterOptions.options, ...lazyOptions.left };
  const rightOptions = { ...rightBootstrap.filterOptions.options, ...lazyOptions.right };
  const sharedPeriodLink = activeLink.sharedPeriodLink ?? null;

  const joinShort = `${getColumnLabel(leftBootstrap, activeLink.leftJoinField)} ↔ ${getColumnLabel(rightBootstrap, activeLink.rightJoinField)}`;
  const aggregateSelectOptions: { value: string; label: string }[] = [
    { value: '', label: 'Каждое совпадение — отдельная строка' },
    {
      value: '__matchKey',
      label: `Одна строка на значение связи (${joinShort})`,
    },
    ...leftColumns.map(k => ({
      value: `left__${k}`,
      label: `${leftSourceName}: ${getColumnLabel(leftBootstrap, k)}`,
    })),
    ...rightColumns.map(k => ({
      value: `right__${k}`,
      label: `${rightSourceName}: ${getColumnLabel(rightBootstrap, k)}`,
    })),
  ];
  const linkSelectOptions = links.map(link => ({
    value: link.id,
    label: getLinkLabel(link, sourceNamesById, bootstrapBySourceId),
  }));
  const aggregateAppSelectOptions = aggregateSelectOptions.map(opt => ({
    value: opt.value || NO_AGGREGATION_VALUE,
    label: opt.label,
  }));

  const headerActions =
    result != null ? (
      <div className="hidden sm:flex">
        <LinkedExportButton loading={exporting} onClick={() => void handleExportLinked()} />
      </div>
    ) : null;

  return (
    <ReportsChrome onCreateReport={onNewSession} headerActions={headerActions}>
      <motion.div {...fadeSlide}>
        <div className="space-y-6">
      <section className="ui-panel rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="ui-chip-accent inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                Новый режим
              </span>
              <span className="ui-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                2 источника в одном отчёте
              </span>
            </div>
            <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
              Сводный отчёт по связям между источниками
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Выберите сохранённую связь, задайте отбор отдельно по каждому источнику и получите
              общую таблицу по совпадающим значениям.
            </p>
          </div>

          <label className="block min-w-full xl:min-w-[22rem]">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-on-surface-variant">
              Какая связь нужна
            </span>
            <AppSelect
              value={selectedLinkId}
              onValueChange={setSelectedLinkId}
              options={linkSelectOptions}
              placeholder="Выберите связь"
              triggerClassName="ui-field h-11 rounded-2xl px-4 text-sm focus:border-primary/50"
              contentClassName="max-w-[min(42rem,calc(100vw-2rem))]"
              itemClassName="items-start py-2.5 whitespace-normal"
              labelClassName="text-sm"
              ariaLabel="Выбор связи"
            />
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Активная связь: {leftSourceName} ({getColumnLabel(leftBootstrap, activeLink.leftJoinField)}) ↔{' '}
              {rightSourceName} ({getColumnLabel(rightBootstrap, activeLink.rightJoinField)})
            </p>
          </label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
          <div className="rounded-[24px] border border-primary/12 bg-primary-fixed/42 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.1} />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
                Источник слева
              </p>
            </div>
            <p className="mt-3 text-lg font-semibold text-on-surface">{leftSourceName}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Поле связи: <span className="font-medium text-on-surface">{getColumnLabel(leftBootstrap, activeLink.leftJoinField)}</span>
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div className="rounded-full border border-outline-variant/18 bg-surface-container-low p-3">
              <GitMerge className="h-5 w-5 text-primary" strokeWidth={2.1} />
            </div>
          </div>

          <div className="rounded-[24px] border border-tertiary/15 bg-tertiary-fixed/42 p-4">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-tertiary" strokeWidth={2.1} />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tertiary/80">
                Источник справа
              </p>
            </div>
            <p className="mt-3 text-lg font-semibold text-on-surface">{rightSourceName}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Поле связи: <span className="font-medium text-on-surface">{getColumnLabel(rightBootstrap, activeLink.rightJoinField)}</span>
            </p>
          </div>
        </div>

        {activeLink.description ? (
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">{activeLink.description}</p>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {sharedPeriodLink ? (
        <section className="ui-panel rounded-[28px] px-5 py-5 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" strokeWidth={2.1} />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
              Период для связи
            </p>
          </div>
          <div className="max-w-lg">
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              {sharedPeriodLink.label}
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <DatePicker
                value={sharedPeriod.from}
                onChange={value => setSharedPeriod(current => ({ ...current, from: value }))}
                placeholder="С даты"
              />
              <span className="text-center text-outline-variant">—</span>
              <DatePicker
                value={sharedPeriod.to}
                onChange={value => setSharedPeriod(current => ({ ...current, to: value }))}
                placeholder="По дату"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Этот период применяется сразу к обеим таблицам по настройке связи из админки.
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-2">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Левая часть
            </p>
            <h2 className="mt-1 text-lg font-semibold text-on-surface">{leftSourceName}</h2>
          </div>

          <GenericReportFilters
            filterDefs={leftBootstrap.filterOptions.filterDefs}
            options={leftOptions}
            values={leftFilters}
            periodFilterCols={[]}
            periodFilters={{}}
            lazyFilterLoading={lazyLoading.left}
            onLazyFilterOpen={key => handleLazyOpen('left', activeLink.leftSourceId, key)}
            onFiltersChange={setLeftFilters}
            onPeriodChange={() => {}}
          />

          <ColumnSelector
            selected={leftColumns}
            onChange={setLeftColumns}
            columns={leftBootstrap.columns}
          />
        </section>

        <section className="space-y-4">
          <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Правая часть
            </p>
            <h2 className="mt-1 text-lg font-semibold text-on-surface">{rightSourceName}</h2>
          </div>

          <GenericReportFilters
            filterDefs={rightBootstrap.filterOptions.filterDefs}
            options={rightOptions}
            values={rightFilters}
            periodFilterCols={[]}
            periodFilters={{}}
            lazyFilterLoading={lazyLoading.right}
            onLazyFilterOpen={key => handleLazyOpen('right', activeLink.rightSourceId, key)}
            onFiltersChange={setRightFilters}
            onPeriodChange={() => {}}
          />

          <ColumnSelector
            selected={rightColumns}
            onChange={setRightColumns}
            columns={rightBootstrap.columns}
          />
        </section>
      </div>

      <section className="ui-panel rounded-[28px] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4">
          <label className="block max-w-3xl">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-on-surface-variant">
              Группировка результата
            </span>
            <AppSelect
              value={aggregateByColumnKey || NO_AGGREGATION_VALUE}
              onValueChange={value =>
                setAggregateByColumnKey(value === NO_AGGREGATION_VALUE ? '' : value)
              }
              options={aggregateAppSelectOptions}
              placeholder="Выберите вариант группировки"
              triggerClassName="ui-field h-11 rounded-2xl px-4 text-sm focus:border-primary/50"
              contentClassName="max-w-[min(42rem,calc(100vw-2rem))]"
              itemClassName="items-start py-2.5 whitespace-normal"
              labelClassName="text-sm"
              ariaLabel="Выбор группировки результата"
            />
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              При группировке по полю (например, по агенту) в таблице остаётся одна строка на уникальное
              значение; все числовые колонки суммируются по сгруппированным строкам. Добавляется колонка
              «Строк в группе».
            </p>
          </label>

          <label className="flex max-w-3xl cursor-pointer select-none items-start gap-2.5 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={raiseMergedRowLimit}
              disabled={fullyUnlimitedRows}
              onChange={event => {
                const v = event.target.checked;
                setRaiseMergedRowLimit(v);
                if (v) setFullyUnlimitedRows(false);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline-variant/40 text-primary focus:ring-primary/30 disabled:opacity-50"
            />
            <span>
              <span className="font-medium text-on-surface">Без лимита 5000 строк результата</span>
              <span className="mt-1 block text-xs leading-5 text-on-surface-variant/90">
                По умолчанию после склейки левой и правой части возвращается не больше 5&nbsp;000 пар. Если
                включить эту опцию, лимит поднимается до значения{' '}
                <code className="rounded bg-surface-container-high px-1 py-0.5 text-[11px]">
                  LINKED_REPORT_MERGED_ROW_CAP
                </code>{' '}
                на сервере (по умолчанию 200&nbsp;000). Выборка может занять больше времени и памяти.
              </span>
            </span>
          </label>

          <label className="flex max-w-3xl cursor-pointer select-none items-start gap-2.5 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={raiseSourceRowLimit}
              disabled={fullyUnlimitedRows}
              onChange={event => {
                const v = event.target.checked;
                setRaiseSourceRowLimit(v);
                if (v) setFullyUnlimitedRows(false);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline-variant/40 text-primary focus:ring-primary/30 disabled:opacity-50"
            />
            <span>
              <span className="font-medium text-on-surface">Без лимита 1000 строк на каждый источник</span>
              <span className="mt-1 block text-xs leading-5 text-on-surface-variant/90">
                По умолчанию из каждой стороны берётся не больше 1&nbsp;000 строк (TOP в SQL). Если включить,
                лимит поднимается до{' '}
                <code className="rounded bg-surface-container-high px-1 py-0.5 text-[11px]">
                  LINKED_REPORT_SOURCE_ROW_CAP
                </code>{' '}
                (по умолчанию 50&nbsp;000 на источник). Увеличивает нагрузку на БД.
              </span>
            </span>
          </label>

          {linkedReportAllowUnlimited ? (
            <label className="flex max-w-3xl cursor-pointer select-none items-start gap-2.5 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={fullyUnlimitedRows}
                onChange={event => {
                  const next = event.target.checked;
                  setFullyUnlimitedRows(next);
                  if (next) {
                    setRaiseMergedRowLimit(false);
                    setRaiseSourceRowLimit(false);
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
              />
              <span>
                <span className="font-medium text-on-surface">Полностью без лимитов (источники + результат)</span>
                <span className="mt-1 block text-xs leading-5 text-on-surface-variant/90">
                  SQL без TOP на каждой стороне и без обрезки числа пар после склейки. Включено только если на
                  сервере задано{' '}
                  <code className="rounded bg-surface-container-high px-1 py-0.5 text-[11px]">
                    LINKED_REPORT_ALLOW_UNLIMITED=1
                  </code>
                  . На больших таблицах возможны таймауты и большой расход памяти.
                </span>
              </span>
            </label>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                Запуск
              </p>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                Сводка собирает только те строки, которые совпали по выбранным полям связи в обоих
                источниках.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {result != null ? (
                <div className="flex w-full sm:hidden">
                  <LinkedExportButton loading={exporting} onClick={() => void handleExportLinked()} />
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canRun || loading}
                className="ui-button-primary w-full rounded-2xl px-5 py-3 text-sm font-semibold sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Собираем сводку…' : 'Сформировать сводный отчёт'}
              </button>
            </div>
          </div>
        </div>
      </section>

          {result ? (
            <UnifiedReportTable
              data={result.data}
              columns={result.columns}
              warnings={result.warnings}
              sortable
              mode="client"
              loading={loading}
            />
          ) : null}
        </div>
      </motion.div>
    </ReportsChrome>
  );
}

function LinkedExportButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={loading}
      className="ui-button-secondary flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      <FileSpreadsheet className="h-4 w-4 text-primary" strokeWidth={2.1} />
      {loading ? 'Экспорт…' : 'Excel'}
    </button>
  );
}
