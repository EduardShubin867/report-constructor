import type { ColumnDef } from '@/lib/report-columns';
import type { ManualReportSourcePayload } from '@/lib/report-filters-data';

export type ManualSortState = { col: string | null; dir: 'asc' | 'desc' | null };

export type AppliedReportSnapshot = {
  columns: string[];
  groupBy: string[];
  filters: Record<string, string[]>;
  periodFilters: Record<string, { from: string; to: string }>;
  showContractCount: boolean;
  sort: ManualSortState;
};

export type ReportResult = {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

export type ManualReportRouteProps = {
  initialSourceId?: string;
  sources?: { id: string; name: string }[];
  initialBootstrapBySourceId?: Record<string, ManualReportSourcePayload> | null;
};

export type ColumnGroup = { id: string; name: string; columns: ColumnDef[] };
