'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ColumnSelector from '@/components/ColumnSelector';
import ReportFilters, {
  EMPTY_FILTERS,
  type FilterOptions,
  type FilterValues,
} from '@/components/ReportFilters';
import ReportsChrome from '@/components/ReportsChrome';
import UnifiedReportTable from '@/components/UnifiedReportTable';
import { ALL_COLUMNS, DEFAULT_COLUMNS, type ColumnDef } from '@/lib/report-columns';
import { BASE_PATH } from '@/lib/constants';

interface ReportResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

interface ManualReportRouteProps {
  /** Filters prefetched on the server so the UI is immediately populated. */
  initialFilterOptions: FilterOptions;
  /** True when the server prefetch failed — client should retry over HTTP. */
  initialFilterError?: boolean;
}

export default function ManualReportRoute({
  initialFilterOptions,
  initialFilterError = false,
}: ManualReportRouteProps) {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(initialFilterOptions);
  const [filtersLoading, setFiltersLoading] = useState(initialFilterError);
  const [visibleColumns, setVisibleColumns] = useState<ColumnDef[]>(ALL_COLUMNS);
  const [manualError, setManualError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Retry over HTTP only if the server prefetch failed.
  useEffect(() => {
    if (!initialFilterError) return;
    fetch(`${BASE_PATH}/api/report/filters`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(setFilterOptions)
      .catch(() => {
        /* DbStatus displays connectivity issues */
      })
      .finally(() => setFiltersLoading(false));
  }, [initialFilterError]);

  // Fetch visible columns (admin may have hidden some via schema settings).
  useEffect(() => {
    fetch(`${BASE_PATH}/api/report/columns`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { columns: ColumnDef[] } | null) => {
        if (data?.columns?.length) {
          setVisibleColumns(data.columns);
          // Drop any selected columns that are now hidden.
          setSelectedColumns(prev =>
            prev.filter(k => data.columns.some(c => c.key === k)),
          );
        }
      })
      .catch(() => { /* keep ALL_COLUMNS fallback */ });
  }, []);

  const fetchReport = useCallback(async (
    nextPage: number,
    nextPageSize: number,
    nextFilters: FilterValues,
    columns: string[],
  ) => {
    if (columns.length === 0) {
      setManualError('Выберите хотя бы одну колонку');
      return;
    }

    setLoading(true);
    setManualError(null);

    try {
      const res = await fetch(`${BASE_PATH}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nextFilters,
          columns,
          page: nextPage,
          pageSize: nextPageSize,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Ошибка сервера');
      setResult(await res.json());
      setHasSearched(true);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = () => {
    setPage(1);
    void fetchReport(1, pageSize, filters, selectedColumns);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    void fetchReport(nextPage, pageSize, filters, selectedColumns);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
    void fetchReport(1, nextPageSize, filters, selectedColumns);
  };

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
      const anchor = Object.assign(document.createElement('a'), {
        href: url,
        download: `report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setExporting(false);
    }
  }

  const headerActions = hasSearched && result ? (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="hidden sm:flex">
      <ExportButton loading={exporting} onClick={handleExportManual} />
    </motion.div>
  ) : null;

  return (
    <ReportsChrome
      onCreateReport={() => {
        setHasSearched(false);
        setResult(null);
        setManualError(null);
        setPage(1);
      }}
      headerActions={headerActions}
    >
      <motion.div {...fadeSlide} className="flex flex-col gap-5">
        <header>
          <h1 className="mb-2 font-headline text-3xl font-bold tracking-tight text-on-surface">
            Ручной отчёт
          </h1>
          <p className="max-w-2xl leading-7 text-on-surface-variant">
            Выберите фильтры и колонки — таблица сформируется по правилам ручного конструктора.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <ReportFilters
            filters={filters}
            options={filterOptions}
            loading={loading}
            filtersLoading={filtersLoading}
            onFiltersChange={setFilters}
            onSubmit={handleSubmit}
          />
          <ColumnSelector selected={selectedColumns} onChange={setSelectedColumns} columns={visibleColumns} />
        </div>

        <AnimatePresence>
          {manualError ? (
            <motion.div {...fadeSlide}>
              <InlineError message={manualError} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {hasSearched || loading ? (
          <UnifiedReportTable
            data={result?.data ?? []}
            columns={selectedColumns
              .map(key => visibleColumns.find(column => column.key === key))
              .filter(Boolean)
              .map(column => ({ key: column!.key, label: column!.label, type: column!.type }))}
            total={result?.total ?? 0}
            page={page}
            pageSize={pageSize}
            loading={loading}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            mode="server"
          />
        ) : null}

        {!hasSearched && !loading ? (
          <EmptyState
            title="Настройте фильтры и нажмите «Сформировать отчёт»"
            subtitle="Выберите агентов, регионы, даты и другие параметры"
          />
        ) : null}

        {hasSearched && result ? (
          <div className="flex justify-end pb-4 sm:hidden">
            <ExportButton loading={exporting} onClick={handleExportManual} />
          </div>
        ) : null}
      </motion.div>
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

function ExportButton({ loading, onClick }: { loading: boolean; onClick: () => void | Promise<void> }) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
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
    <motion.div
      {...fadeSlide}
      className="ui-panel-muted rounded-2xl border border-dashed border-outline-variant/30 p-8 text-left sm:p-10"
    >
      <FileText className="mb-4 block h-10 w-10 text-on-surface-variant/40" strokeWidth={1.8} />
      <p className="text-sm font-medium text-on-surface">{title}</p>
      <p className="mt-2 text-xs text-on-surface-variant">{subtitle}</p>
    </motion.div>
  );
}
