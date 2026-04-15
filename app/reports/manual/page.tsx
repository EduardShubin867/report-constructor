import type { Metadata } from 'next';
import ManualReportRoute from '@/components/ManualReportRoute';

export const dynamic = 'force-dynamic';
import { loadSourceFilterOptions, type ManualReportSourcePayload } from '@/lib/report-filters-data';
import { getManualReportSources } from '@/lib/schema';
import { getVisibleColumnDefs, getGroupByColumnDefs } from '@/lib/visible-columns';

export const metadata: Metadata = { title: 'Конструктор — Отчёты' };
const SOURCE_QUERY_PARAM = 'sourceId';

interface ReportsManualPageProps {
  searchParams?: Promise<{ sourceId?: string | string[] | undefined }>;
}

async function bootstrapManualSource(id: string): Promise<ManualReportSourcePayload> {
  return {
    columns: getVisibleColumnDefs(id),
    groupByColumns: getGroupByColumnDefs(id),
    filterOptions: await loadSourceFilterOptions(id),
  };
}

export default async function ReportsManualPage({ searchParams }: ReportsManualPageProps) {
  const sources = getManualReportSources().map(s => ({ id: s.id, name: s.name }));
  const defaultSourceId = sources[0]?.id ?? '';
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedSourceIdRaw = resolvedSearchParams[SOURCE_QUERY_PARAM];
  const requestedSourceId = Array.isArray(requestedSourceIdRaw)
    ? requestedSourceIdRaw[0]
    : requestedSourceIdRaw;
  const initialSourceId = sources.some(source => source.id === requestedSourceId)
    ? requestedSourceId
    : defaultSourceId;

  const payloads = await Promise.all(sources.map(async ({ id }) => [id, await bootstrapManualSource(id)] as const));
  const initialBootstrapBySourceId: Record<string, ManualReportSourcePayload> =
    payloads.length > 0 ? (Object.fromEntries(payloads) as Record<string, ManualReportSourcePayload>) : {};

  return (
    <ManualReportRoute
      initialSourceId={initialSourceId}
      sources={sources}
      initialBootstrapBySourceId={initialBootstrapBySourceId}
    />
  );
}
