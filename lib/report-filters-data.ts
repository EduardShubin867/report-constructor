import { unstable_cache } from 'next/cache';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';

export interface ReportFilterOptions {
  агенты: string[];
  регионы: string[];
  видыДоговора: string[];
  территории: string[];
  дг: string[];
  крм: string[];
  крп: string[];
}

export const EMPTY_REPORT_FILTER_OPTIONS: ReportFilterOptions = {
  агенты: [],
  регионы: [],
  видыДоговора: [],
  территории: [],
  дг: [],
  крм: [],
  крп: [],
};

export const REPORT_FILTERS_CACHE_TAG = 'report-filters';

async function fetchReportFilterOptions(): Promise<ReportFilterOptions> {
  const pool = await getPool();
  const t = TIMEOUT.QUERY;

  const [агенты, регионы, видыДоговора, территории, дг, крм, крп] = await Promise.all([
    queryWithTimeout(pool.request(),
      'SELECT DISTINCT Агент FROM [dbo].[Журнал_ОСАГО_Маржа] WHERE Агент IS NOT NULL ORDER BY Агент', t),
    queryWithTimeout(pool.request(),
      'SELECT DISTINCT Регион FROM [dbo].[Журнал_ОСАГО_Маржа] WHERE Регион IS NOT NULL ORDER BY Регион', t),
    queryWithTimeout(pool.request(),
      'SELECT DISTINCT ВидДоговора FROM [dbo].[Журнал_ОСАГО_Маржа] WHERE ВидДоговора IS NOT NULL ORDER BY ВидДоговора', t),
    queryWithTimeout(pool.request(),
      'SELECT DISTINCT Наименование FROM [dbo].[Территории] WHERE Наименование IS NOT NULL AND ПометкаУдаления = 0 ORDER BY Наименование', t),
    queryWithTimeout(pool.request(),
      'SELECT DISTINCT Наименование FROM [dbo].[ДГ] WHERE Наименование IS NOT NULL ORDER BY Наименование', t),
    queryWithTimeout(pool.request(),
      'SELECT DISTINCT КРМ FROM [dbo].[КРМ] ORDER BY КРМ', t),
    queryWithTimeout(pool.request(),
      'SELECT DISTINCT КРП FROM [dbo].[КРП] ORDER BY КРП', t),
  ]);

  return {
    агенты: агенты.recordset.map(r => String(r.Агент)),
    регионы: регионы.recordset.map(r => String(r.Регион)),
    видыДоговора: видыДоговора.recordset.map(r => String(r.ВидДоговора)),
    территории: территории.recordset.map(r => String(r.Наименование)),
    дг: дг.recordset.map(r => String(r.Наименование)),
    крм: крм.recordset.map(r => String(r.КРМ)),
    крп: крп.recordset.map(r => String(r.КРП)),
  };
}

// Cached by Next.js on the server: shared across requests, 5-minute TTL,
// invalidatable via `revalidateTag(REPORT_FILTERS_CACHE_TAG)`.
export const loadReportFilterOptions = unstable_cache(
  fetchReportFilterOptions,
  ['report-filter-options'],
  { revalidate: 300, tags: [REPORT_FILTERS_CACHE_TAG] },
);
