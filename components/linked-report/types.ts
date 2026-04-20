import type { ManualReportSourcePayload } from '@/lib/report-filters-data';
import type { SourceLink } from '@/lib/schema';

export type Side = 'left' | 'right';

export type FiltersMap = Record<string, string[]>;

export interface LinkedReportRouteProps {
  links: SourceLink[];
  sourceNamesById: Record<string, string>;
  bootstrapBySourceId: Record<string, ManualReportSourcePayload>;
  linkedReportAllowUnlimited?: boolean;
}

export type OrderedItem = { key: string; side: Side };
