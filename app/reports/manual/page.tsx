import type { Metadata } from 'next';
import ManualReportRoute from '@/components/ManualReportRoute';
import {
  EMPTY_REPORT_FILTER_OPTIONS,
  loadReportFilterOptions,
  type ReportFilterOptions,
} from '@/lib/report-filters-data';

export const metadata: Metadata = {
  title: 'Конструктор — Отчёты',
};

// Filter dictionaries change rarely; let Next ISR the shell and reuse
// the `unstable_cache`-wrapped loader for data.
export const revalidate = 300;

async function prefetchFilters(): Promise<{ options: ReportFilterOptions; error: boolean }> {
  try {
    return { options: await loadReportFilterOptions(), error: false };
  } catch (error) {
    console.error('Failed to prefetch report filters:', error);
    return { options: EMPTY_REPORT_FILTER_OPTIONS, error: true };
  }
}

export default async function ReportsManualPage() {
  const { options, error } = await prefetchFilters();
  return <ManualReportRoute initialFilterOptions={options} initialFilterError={error} />;
}
