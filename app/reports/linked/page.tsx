import type { Metadata } from 'next';
import LinkedReportRoute from '@/components/LinkedReportRoute';
import { isLinkedReportUnlimitedRowsAllowed } from '@/lib/linked-report-unlimited-flag';
import { loadSourceFilterOptions, type ManualReportSourcePayload } from '@/lib/report-filters-data';
import { getDataSources, getSourceLinks } from '@/lib/schema';
import { getVisibleColumnDefs } from '@/lib/visible-columns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Сводный отчёт — Отчёты',
};

async function buildBootstrap(sourceId: string): Promise<ManualReportSourcePayload> {
  return {
    columns: getVisibleColumnDefs(sourceId),
    filterOptions: await loadSourceFilterOptions(sourceId),
  };
}

export default async function ReportsLinkedPage() {
  const sourceNamesById = Object.fromEntries(
    getDataSources().map(source => [source.id, source.name]),
  ) as Record<string, string>;

  const links = getSourceLinks().filter(
    link => sourceNamesById[link.leftSourceId] && sourceNamesById[link.rightSourceId],
  );

  const sourceIds = [...new Set(links.flatMap(link => [link.leftSourceId, link.rightSourceId]))];
  const payloads = await Promise.all(
    sourceIds.map(async id => [id, await buildBootstrap(id)] as const),
  );

  return (
    <LinkedReportRoute
      links={links}
      sourceNamesById={sourceNamesById}
      bootstrapBySourceId={Object.fromEntries(payloads)}
      linkedReportAllowUnlimited={isLinkedReportUnlimitedRowsAllowed()}
    />
  );
}
