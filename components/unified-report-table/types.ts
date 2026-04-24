export interface ReportColumn {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  /** Число показывать как целое (без ,00). */
  integer?: boolean;
}

export type ServerSortDirection = 'asc' | 'desc' | null;

export interface UnifiedReportTableProps {
  data: Record<string, unknown>[];
  columns: ReportColumn[];
  total?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  sortable?: boolean;
  /** Режим server: клик по заголовку — цикл asc → desc → сброс (родитель шлёт запрос с sortColumn/sortDirection). */
  serverSortColumn?: string | null;
  serverSortDirection?: ServerSortDirection;
  onServerSortClick?: (columnKey: string) => void;
  warnings?: string[];
  mode: 'server' | 'client';
  /**
   * Клиентский режим: сгруппировать отображаемые строки по значению колонки (порядок групп —
   * по первому появлению после текущей сортировки).
   */
  clientGroupByColumnKey?: string | null;
  /** Не дублировать колонку группировки в каждой строке — только в шапке группы. */
  hideGroupColumnWhenGrouped?: boolean;
  /** Fill parent container height instead of using viewport-based calc. Parent must have a constrained height. */
  fillHeight?: boolean;
}
