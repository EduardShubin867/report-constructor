import { revalidatePath, revalidateTag } from 'next/cache';
import {
  REPORT_FILTER_OPTIONS_CACHE_TAG,
  revalidateManualReportCaches,
} from '@/lib/report-filters-data';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_cache: jest.fn((fn: unknown) => fn),
}));

jest.mock('@/lib/db', () => ({
  TIMEOUT: { QUERY: 15_000 },
  getPoolForSource: jest.fn(),
  queryWithTimeout: jest.fn(),
}));

jest.mock('@/lib/schema', () => ({
  getDataSources: jest.fn(),
}));

jest.mock('@/lib/visible-columns', () => ({
  getPeriodFilterColumns: jest.fn(() => []),
}));

describe('report cache revalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates filter values and the whole reports route tree', () => {
    revalidateManualReportCaches();

    expect(revalidateTag).toHaveBeenCalledWith(REPORT_FILTER_OPTIONS_CACHE_TAG, { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith('/constructor/reports', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/constructor/reports/manual');
    expect(revalidatePath).toHaveBeenCalledWith('/constructor/reports/linked');
  });
});
