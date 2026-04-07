'use client';

import { Brain, FileSpreadsheet, FileText } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReportFilters, { FilterValues, FilterOptions, EMPTY_FILTERS } from '@/components/ReportFilters';
import ColumnSelector from '@/components/ColumnSelector';
import ReportTable from '@/components/ReportTable';
import AgentInput, { AgentQueryResult, type AgentResultMode } from '@/components/AgentInput';
import DataTable from '@/components/DataTable';
import VersionTabs from '@/components/VersionTabs';
import ReportsChrome from '@/components/ReportsChrome';
import { DEFAULT_COLUMNS } from '@/lib/report-columns';
import { BASE_PATH } from '@/lib/constants';

type Tab = 'ai' | 'manual';

interface ReportResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

interface ReportVersion {
  id: number;
  label: string;
  result: AgentQueryResult;
  query: string;
  timestamp: number;
}

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('ai');

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    агенты: [], регионы: [], видыДоговора: [], территории: [], дг: [], крм: [], крп: [],
  });
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [activeVersionIdx, setActiveVersionIdx] = useState(0);
  const [exportingVersionId, setExportingVersionId] = useState<number | null>(null);
  const [aiKey, setAiKey] = useState(0);

  const activeVersion = versions[activeVersionIdx] ?? null;

  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    fetch(`${BASE_PATH}/api/report/filters`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setFilterOptions)
      .catch(() => { /* DbStatus */ })
      .finally(() => setFiltersLoading(false));
  }, []);

  const fetchReport = useCallback(async (
    pg: number, ps: number, f: FilterValues, cols: string[],
  ) => {
    if (cols.length === 0) { setManualError('Выберите хотя бы одну колонку'); return; }
    setLoading(true);
    setManualError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, columns: cols, page: pg, pageSize: ps }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка сервера');
      setResult(await res.json());
      setHasSearched(true);
    } catch (e) { setManualError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
    finally { setLoading(false); }
  }, []);

  const handleSubmit = () => { setPage(1); fetchReport(1, pageSize, filters, selectedColumns); };
  const handlePageChange = (p: number) => { setPage(p); fetchReport(p, pageSize, filters, selectedColumns); };
  const handlePageSizeChange = (s: number) => { setPageSize(s); setPage(1); fetchReport(1, s, filters, selectedColumns); };

  const handleAgentResult = (r: AgentQueryResult, queryText: string, mode: AgentResultMode) => {
    setAiError(null);
    setVersions(prev => {
      if (mode === 'replace') {
        setActiveVersionIdx(0);
        return [{
          id: 1,
          label: 'v1',
          result: r,
          query: queryText,
          timestamp: Date.now(),
        }];
      }

      const next = [...prev, {
        id: prev.length + 1,
        label: `v${prev.length + 1}`,
        result: r,
        query: queryText,
        timestamp: Date.now(),
      }];
      setActiveVersionIdx(next.length - 1);
      return next;
    });
  };

  const handleNewReport = () => {
    setVersions([]);
    setActiveVersionIdx(0);
    setAiError(null);
    setAiKey(k => k + 1);
  };

  const handleCreateReport = () => {
    setTab('ai');
    handleNewReport();
  };

  async function handleExportVersion(version: ReportVersion) {
    setExportingVersionId(version.id);
    setAiError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/query/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: version.result.sql }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка экспорта');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `ai_report_${version.label}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setAiError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
    finally { setExportingVersionId(null); }
  }

  async function handleExportManual() {
    setExporting(true);
    setManualError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/report/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filters, columns: selectedColumns }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка экспорта');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `report_${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setManualError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
    finally { setExporting(false); }
  }

  const headerActions = (
    <>
      {tab === 'manual' && hasSearched && result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="hidden sm:flex">
          <ExportButton loading={exporting} onClick={handleExportManual} />
        </motion.div>
      )}
    </>
  );

  return (
    <ReportsChrome
      tab={tab}
      onTabChange={setTab}
      onCreateReport={handleCreateReport}
      headerActions={headerActions}
    >
      <AnimatePresence mode="wait">
        {tab === 'ai' ? (
          <motion.div key="ai" {...fadeSlide} className="flex flex-col gap-6">
            <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <span className="ui-chip mb-3 inline-flex rounded-full px-3 py-1 text-[11px] font-medium tracking-wide">
                  AI-аналитик
                </span>
                <h1 className="mb-2 font-headline text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
                  Как я могу <span className="text-primary">помочь</span> сегодня?
                </h1>
                <p className="max-w-2xl text-lg leading-7 text-on-surface-variant">
                  Задайте вопрос по вашим данным на естественном языке. Ответ появится как готовая таблица без лишних шагов в интерфейсе.
                </p>
              </div>
            </header>

            <AgentInput key={aiKey} onResult={handleAgentResult} disabled={loading} />

            <AnimatePresence>
              {aiError && (
                <motion.div {...fadeSlide}>
                  <InlineError message={aiError} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {versions.length > 0 && activeVersion && (
                <motion.div {...fadeSlide} className="flex flex-col gap-4">
                  <section>
                    <div className="ui-panel rounded-xl px-4 py-4 sm:px-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="ui-chip-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                            <Brain className="h-[18px] w-[18px]" strokeWidth={2.1} />
                          </div>
                          <div className="min-w-0">
                            <span className="ui-chip-accent mb-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide">
                              Ваш запрос
                            </span>
                            <p className="font-headline text-base font-semibold leading-7 text-on-surface md:text-lg">
                              &ldquo;{activeVersion.query}&rdquo;
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                          {versions.length > 1 ? (
                            <VersionTabs
                              versions={versions}
                              activeIdx={activeVersionIdx}
                              onSelect={setActiveVersionIdx}
                            />
                          ) : (
                            <span className="flex items-center gap-1 rounded-lg border border-primary bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary shadow-[0_6px_16px_rgba(52,92,150,0.18)]">
                              <span className="h-1.5 w-1.5 rounded-full bg-on-primary/90" aria-hidden />
                              v1
                            </span>
                          )}
                          <span className="hidden h-4 w-px bg-outline-variant/20 sm:block" />
                          <span className="text-xs font-medium text-on-surface-variant">
                            {activeVersion.result.rowCount.toLocaleString('ru-RU')} {pluralRows(activeVersion.result.rowCount)}
                          </span>
                          <span className="text-xs text-on-surface-variant/70">
                            {new Date(activeVersion.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ExportButton
                            loading={exportingVersionId === activeVersion.id}
                            onClick={() => handleExportVersion(activeVersion)}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <AnimatePresence mode="wait">
                    <motion.div key={activeVersion.id} {...fadeSlide}>
                      <DataTable
                        data={activeVersion.result.data}
                        columns={activeVersion.result.columns}
                        rowCount={activeVersion.result.rowCount}
                        warnings={activeVersion.result.warnings}
                      />
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="manual" {...fadeSlide} className="flex flex-col gap-5">
            <header>
              <h1 className="mb-2 font-headline text-3xl font-bold tracking-tight text-on-surface">
                Ручной отчёт
              </h1>
              <p className="max-w-2xl leading-7 text-on-surface-variant">
                Выберите фильтры и колонки — таблица сформируется по правилам ручного конструктора.
              </p>
            </header>

            <div className="flex flex-col gap-4">
              <ReportFilters filters={filters} options={filterOptions} loading={loading}
                filtersLoading={filtersLoading} onFiltersChange={setFilters} onSubmit={handleSubmit} />
              <ColumnSelector selected={selectedColumns} onChange={setSelectedColumns} />
            </div>

            <AnimatePresence>
              {manualError && (
                <motion.div {...fadeSlide}>
                  <InlineError message={manualError} />
                </motion.div>
              )}
            </AnimatePresence>

            {(hasSearched || loading) && (
              <motion.div {...fadeSlide}>
                <ReportTable data={result?.data ?? []} columns={selectedColumns}
                  total={result?.total ?? 0} page={page} pageSize={pageSize} loading={loading}
                  onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />
              </motion.div>
            )}

            {!hasSearched && !loading && (
              <EmptyState
                title="Настройте фильтры и нажмите «Сформировать отчёт»"
                subtitle="Выберите агентов, регионы, даты и другие параметры"
              />
            )}

            {tab === 'manual' && hasSearched && result && (
              <div className="flex justify-end pb-4 sm:hidden">
                <ExportButton loading={exporting} onClick={handleExportManual} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ReportsChrome>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-error">
      {message}
    </div>
  );
}

function pluralRows(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'строка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'строки';
  return 'строк';
}

function ExportButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="ui-button-secondary flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <FileSpreadsheet className="h-4 w-4 text-primary" strokeWidth={2.1} />
      {loading ? 'Экспорт…' : 'Excel'}
    </button>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div {...fadeSlide}
      className="ui-panel-muted rounded-2xl border border-dashed border-outline-variant/30 p-8 text-left sm:p-10">
      <FileText className="mb-4 block h-10 w-10 text-on-surface-variant/40" strokeWidth={1.8} />
      <p className="text-sm font-medium text-on-surface">{title}</p>
      <p className="mt-2 text-xs text-on-surface-variant">{subtitle}</p>
    </motion.div>
  );
}
