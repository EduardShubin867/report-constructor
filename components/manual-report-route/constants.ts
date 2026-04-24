import type { ManualReportSourcePayload } from '@/lib/report-filters-data';

import type { ManualSortState } from './types';

export const SOURCE_QUERY_PARAM = 'sourceId';

export const emptyBootstrap: ManualReportSourcePayload = {
  columns: [],
  groupByColumns: [],
  filterOptions: { filterDefs: [], options: {}, periodFilterCols: [] },
};

export const emptyBootstrapBySourceId: Record<string, ManualReportSourcePayload> = {};

export const AGG_LABELS: Record<string, string> = {
  sum: 'сумма',
  avg: 'сред.',
  count: 'кол-во',
  min: 'мин',
  max: 'макс',
};

export const initialManualSort: ManualSortState = { col: null, dir: null };
