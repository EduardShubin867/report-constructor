import type { Metadata } from 'next';
import ManualReportRoute from '@/components/ManualReportRoute';
import { loadSourceFilterOptions, type ManualReportSourcePayload } from '@/lib/report-filters-data';
import { getManualReportSources } from '@/lib/schema';
import { getVisibleColumnDefs, getGroupByColumnDefs } from '@/lib/visible-columns';

export const metadata: Metadata = { title: 'Конструктор — Отчёты' };

/** Не отдавать устаревший bootstrap из Full Route Cache после деплоя / смены схемы. */
export const dynamic = 'force-dynamic';

async function bootstrapManualSource(id: string): Promise<ManualReportSourcePayload> {
  let filterOptions;
  let filterError = false;
  try {
    filterOptions = await loadSourceFilterOptions(id);
  } catch {
    filterOptions = { filterDefs: [], options: {}, dateFilterCol: null };
    filterError = true;
  }
  return {
    columns: getVisibleColumnDefs(id),
    groupByColumns: getGroupByColumnDefs(id),
    filterOptions,
    filterError,
  };
}

export default async function ReportsManualPage() {
  const sources = getManualReportSources().map(s => ({ id: s.id, name: s.name }));
  const defaultSourceId = sources[0]?.id ?? '';

  const payloads = await Promise.all(sources.map(async ({ id }) => [id, await bootstrapManualSource(id)] as const));
  const initialBootstrapBySourceId: Record<string, ManualReportSourcePayload> =
    payloads.length > 0 ? (Object.fromEntries(payloads) as Record<string, ManualReportSourcePayload>) : {};

  return (
    <ManualReportRoute
      initialSourceId={defaultSourceId}
      sources={sources}
      initialBootstrapBySourceId={initialBootstrapBySourceId}
    />
  );
}
