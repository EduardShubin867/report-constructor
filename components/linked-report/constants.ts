import type { ManualReportSourcePayload } from '@/lib/report-filters-data';

export const emptyBootstrap: ManualReportSourcePayload = {
  columns: [],
  groupByColumns: [],
  filterOptions: { filterDefs: [], options: {}, periodFilterCols: [] },
};

export const NO_AGGREGATION_VALUE = '__none__';

export const TYPE_META: Record<string, { short: string; cls: string }> = {
  string:  { short: 'abc',  cls: 'bg-[#eef1f4] text-[#506577]' },
  number:  { short: '123',  cls: 'bg-[#eef3ee] text-[#476a52]' },
  date:    { short: 'дата', cls: 'bg-[#f2ecef] text-[#7a4460]' },
  boolean: { short: '0/1',  cls: 'bg-[#eef1f4] text-[#506577]' },
};
