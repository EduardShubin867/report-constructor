import type { Metadata } from 'next';
import ManualReportRoute from '@/components/ManualReportRoute';
import { loadSourceFilterOptions, type ManualReportSourcePayload } from '@/lib/report-filters-data';
import { getManualReportSources } from '@/lib/schema';
import { getVisibleColumnDefs, getGroupByColumnDefs } from '@/lib/visible-columns';

export const metadata: Metadata = { title: 'Конструктор — Отчёты' };

async function bootstrapManualSource(id: string): Promise<ManualReportSourcePayload> {
  return {
    columns: getVisibleColumnDefs(id),
    groupByColumns: getGroupByColumnDefs(id),
    filterOptions: await loadSourceFilterOptions(id),
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
