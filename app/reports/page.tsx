'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReportFilters, { FilterValues, FilterOptions, EMPTY_FILTERS } from '@/components/ReportFilters';
import ColumnSelector from '@/components/ColumnSelector';
import ReportTable from '@/components/ReportTable';
import AgentInput, { AgentQueryResult } from '@/components/AgentInput';
import DataTable from '@/components/DataTable';
import VersionTabs from '@/components/VersionTabs';
import DbStatus from '@/components/DbStatus';
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

/* ───────────────────────── Animation presets ──────────────────────── */
const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

/* ───────────────────────────── Page ──────────────────────────────── */
export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('ai');

  // Shared
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    агенты: [], регионы: [], видыДоговора: [], территории: [], дг: [], крм: [], крп: [],
  });
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI state — versioned
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [activeVersionIdx, setActiveVersionIdx] = useState(0);
  const [exportingVersionId, setExportingVersionId] = useState<number | null>(null);
  const [aiKey, setAiKey] = useState(0);

  const activeVersion = versions[activeVersionIdx] ?? null;

  // Manual state
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
      .catch(() => { /* handled by DbStatus indicator */ })
      .finally(() => setFiltersLoading(false));
  }, []);

  /* ── Manual report ──────────────────────────────────────────────── */
  const fetchReport = useCallback(async (
    pg: number, ps: number, f: FilterValues, cols: string[],
  ) => {
    if (cols.length === 0) { setError('Выберите хотя бы одну колонку'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, columns: cols, page: pg, pageSize: ps }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка сервера');
      setResult(await res.json());
      setHasSearched(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
    finally { setLoading(false); }
  }, []);

  const handleSubmit = () => { setPage(1); fetchReport(1, pageSize, filters, selectedColumns); };
  const handlePageChange = (p: number) => { setPage(p); fetchReport(p, pageSize, filters, selectedColumns); };
  const handlePageSizeChange = (s: number) => { setPageSize(s); setPage(1); fetchReport(1, s, filters, selectedColumns); };

  /* ── AI report (versioned) ────────────────────────────────────── */
  const handleAgentResult = (r: AgentQueryResult, queryText: string) => {
    setVersions(prev => {
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
    setAiKey(k => k + 1);
  };

  /* ── Export ─────────────────────────────────────────────────────── */
  async function handleExportVersion(version: ReportVersion) {
    setExportingVersionId(version.id);
    setError(null);
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
    finally { setExportingVersionId(null); }
  }

  async function handleExportManual() {
    setExporting(true);
    setError(null);
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
    finally { setExporting(false); }
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="relative flex items-center justify-between h-14">
            {/* Brand + DB status */}
            <div className="flex items-center gap-3 z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h1 className="text-sm font-bold text-gray-900 tracking-tight">
                  Умный Аналитик
                </h1>
              </div>
              <div className="hidden sm:block w-px h-5 bg-gray-200" />
              <DbStatus />
            </div>

            {/* Tabs — absolutely centered */}
            <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <TabButton active={tab === 'ai'} onClick={() => setTab('ai')} icon={<AiIcon />}
                tooltip="Опишите что нужно словами — AI построит отчёт">
                Свободный запрос
              </TabButton>
              <TabButton active={tab === 'manual'} onClick={() => setTab('manual')} icon={<FilterIcon />}
                tooltip="Выберите фильтры и колонки вручную">
                Конструктор
              </TabButton>
            </nav>

            {/* Header actions */}
            <div className="flex items-center gap-2">
              {tab === 'ai' && versions.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-2">
                  <button onClick={handleNewReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    <PlusIcon />
                    Новый отчёт
                  </button>
                </motion.div>
              )}
              {tab === 'manual' && hasSearched && result && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <ExportButton loading={exporting} onClick={handleExportManual} />
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          {tab === 'ai' ? (
            <motion.div key="ai" {...fadeSlide} className="flex flex-col gap-5">
              <AgentInput key={aiKey} onResult={handleAgentResult} disabled={loading} />

              <AnimatePresence>
                {versions.length > 0 && activeVersion && (
                  <motion.div {...fadeSlide} className="flex flex-col gap-3">
                    {/* Result header: version tabs + row count + export */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {versions.length > 1 ? (
                            <VersionTabs
                              versions={versions}
                              activeIdx={activeVersionIdx}
                              onSelect={setActiveVersionIdx}
                            />
                          ) : (
                            <span className="text-xs text-gray-400">v1</span>
                          )}
                          <div className="w-px h-4 bg-gray-200" />
                          <span className="text-xs text-gray-500 font-medium">
                            {activeVersion.result.rowCount.toLocaleString('ru-RU')} {pluralRows(activeVersion.result.rowCount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {new Date(activeVersion.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ExportButton
                            loading={exportingVersionId === activeVersion.id}
                            onClick={() => handleExportVersion(activeVersion)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Data table */}
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
            <motion.div key="manual" {...fadeSlide} className="flex flex-col gap-4">
              <ReportFilters filters={filters} options={filterOptions} loading={loading}
                filtersLoading={filtersLoading} onFiltersChange={setFilters} onSubmit={handleSubmit} />
              <ColumnSelector selected={selectedColumns} onChange={setSelectedColumns} />

              <AnimatePresence>
                {error && (
                  <motion.div {...fadeSlide} className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {error}
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ───────────────── Shared small components ─────────────────────── */

function TabButton({ active, onClick, icon, tooltip, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; tooltip?: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={tooltip}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
        ${active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'}`}>
      {icon}
      {children}
    </button>
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
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {loading ? 'Экспорт…' : 'Excel'}
    </button>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div {...fadeSlide}
      className="rounded-xl border-2 border-dashed border-gray-200 bg-white/60 p-16 text-center">
      <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </motion.div>
  );
}

/* ──── Icons ──────────────────────────────────────────────────────── */
function AiIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
