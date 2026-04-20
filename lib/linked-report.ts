import {
  buildGenericSelectAndJoins,
  buildGenericWhere,
  detailReportOrderByLastResort,
  safeColumns,
} from '@/lib/query-builder';
import { getPoolForSource, queryWithTimeout, TIMEOUT } from '@/lib/db';
import type { ColumnDef } from '@/lib/report-columns';
import { getDataSources, getSourceLinks, type DataSource, type SourceLink } from '@/lib/schema';
import { getSourceTableAlias, getSourceTableRef, getVisibleColumnDefs } from '@/lib/visible-columns';
import {
  aggregateLinkedMergedRows,
  columnsWithAggCount,
} from '@/lib/linked-report-aggregate';
import { isLinkedReportUnlimitedRowsAllowed } from '@/lib/linked-report-unlimited-flag';

const DEFAULT_SOURCE_ROW_LIMIT = 1000;
const DEFAULT_MERGED_ROW_LIMIT = 5000;
const MERGED_ROW_HARD_CEILING = 10_000_000;
const SOURCE_ROW_HARD_CEILING = 10_000_000;

/** В теле запроса: без TOP на источнике и/или без обрезки результата при склейке (только при LINKED_REPORT_ALLOW_UNLIMITED). */
export const LINKED_REPORT_ROW_UNLIMITED = -1;

export interface LinkedReportRequest {
  linkId: string;
  leftColumns: string[];
  rightColumns: string[];
  leftFilters: Record<string, string[]>;
  rightFilters: Record<string, string[]>;
  /**
   * Быстрый предпросмотр: до 5 строк склейки, умеренный TOP на источниках, без группировки по колонке.
   * Лимиты в теле запроса для preview игнорируются — задаются на сервере.
   */
  preview?: boolean;
  leftPeriodFilters?: Record<string, { from: string; to: string }>;
  rightPeriodFilters?: Record<string, { from: string; to: string }>;
  /** Value for the admin-configured shared date filter (fields come from SourceLink.sharedPeriodLink). */
  sharedPeriodValue?: { from: string; to: string };
  /**
   * Ключ колонки из ответа сводки (__matchKey, left__…, right__…): одна строка на уникальное значение,
   * числовые поля суммируются по группе.
   */
  aggregateByColumnKey?: string | null;
  /**
   * Сколько строк результата (пар после склейки) вернуть максимум.
   * Не передано — 5000. `null` — до потолка `LINKED_REPORT_MERGED_ROW_CAP` (по умолчанию 200 000).
   * Число — явный лимит, не больше потолка.
   * `-1` (`LINKED_REPORT_ROW_UNLIMITED`) — без обрезки при склейке; только если `LINKED_REPORT_ALLOW_UNLIMITED=1`.
   */
  mergedRowLimit?: number | null;
  /**
   * TOP на каждый источник (левый и правый SQL) до склейки.
   * Не передано — 1000. `null` — до потолка `LINKED_REPORT_SOURCE_ROW_CAP` (по умолчанию 50 000).
   * `-1` — без TOP в SQL; только если `LINKED_REPORT_ALLOW_UNLIMITED=1`.
   */
  sourceRowLimit?: number | null;
}

export interface LinkedReportResponse {
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  warnings: string[];
}

/**
 * Верхняя граница строк итоговой сводки при mergedRowLimit: null (или при явном числе выше).
 * Переменная окружения для self-hosted; по умолчанию 200 000.
 */
export function getLinkedReportMergedRowCap(): number {
  const raw = process.env.LINKED_REPORT_MERGED_ROW_CAP?.trim();
  if (raw === undefined || raw === '') {
    return 200_000;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return 200_000;
  }
  return Math.min(Math.floor(n), MERGED_ROW_HARD_CEILING);
}

/**
 * Верхняя граница TOP на каждый источник при sourceRowLimit: null.
 * `LINKED_REPORT_SOURCE_ROW_CAP`, по умолчанию 50 000.
 */
export function getLinkedReportSourceRowCap(): number {
  const raw = process.env.LINKED_REPORT_SOURCE_ROW_CAP?.trim();
  if (raw === undefined || raw === '') {
    return 50_000;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return 50_000;
  }
  return Math.min(Math.floor(n), SOURCE_ROW_HARD_CEILING);
}

/** Лимит строк после склейки левых и правых совпадений (до агрегации). */
export function resolveMergedRowLimit(body: Pick<LinkedReportRequest, 'mergedRowLimit'>): number {
  if (body.mergedRowLimit === LINKED_REPORT_ROW_UNLIMITED) {
    if (!isLinkedReportUnlimitedRowsAllowed()) {
      throw new Error(
        'Снятие лимита результата (mergedRowLimit=-1) отключено. Задайте на сервере LINKED_REPORT_ALLOW_UNLIMITED=1.',
      );
    }
    return LINKED_REPORT_ROW_UNLIMITED;
  }
  const cap = getLinkedReportMergedRowCap();
  if (body.mergedRowLimit === null) {
    return cap;
  }
  if (typeof body.mergedRowLimit === 'number' && Number.isFinite(body.mergedRowLimit)) {
    return Math.max(1, Math.min(cap, Math.floor(body.mergedRowLimit)));
  }
  return Math.min(DEFAULT_MERGED_ROW_LIMIT, cap);
}

/** TOP на каждый источник до склейки (одинаково для левой и правой части). */
export function resolveSourceRowLimit(body: Pick<LinkedReportRequest, 'sourceRowLimit'>): number {
  if (body.sourceRowLimit === LINKED_REPORT_ROW_UNLIMITED) {
    if (!isLinkedReportUnlimitedRowsAllowed()) {
      throw new Error(
        'Снятие TOP на источниках (sourceRowLimit=-1) отключено. Задайте на сервере LINKED_REPORT_ALLOW_UNLIMITED=1.',
      );
    }
    return LINKED_REPORT_ROW_UNLIMITED;
  }
  const cap = getLinkedReportSourceRowCap();
  if (body.sourceRowLimit === null) {
    return cap;
  }
  if (typeof body.sourceRowLimit === 'number' && Number.isFinite(body.sourceRowLimit)) {
    return Math.max(1, Math.min(cap, Math.floor(body.sourceRowLimit)));
  }
  return Math.min(DEFAULT_SOURCE_ROW_LIMIT, cap);
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeJoinValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim().toLowerCase();
}

function buildLinkedColumn(
  prefix: 'left' | 'right',
  sourceName: string,
  column: ColumnDef,
): ColumnDef {
  return {
    key: `${prefix}__${column.key}`,
    label: `${sourceName}: ${column.label}`,
    type: column.type,
    integer: column.integer,
  };
}

function getSourceOrThrow(sourceId: string): DataSource {
  const source = getDataSources().find(item => item.id === sourceId);
  if (!source) {
    throw new Error(`Источник "${sourceId}" не найден`);
  }
  return source;
}

function getLinkOrThrow(linkId: string): SourceLink {
  const link = getSourceLinks().find(item => item.id === linkId);
  if (!link) {
    throw new Error(`Связь "${linkId}" не найдена`);
  }
  return link;
}

function getColumnDefOrThrow(sourceId: string, key: string): ColumnDef {
  const column = getVisibleColumnDefs(sourceId).find(item => item.key === key);
  if (!column) {
    throw new Error(`Колонка "${key}" не найдена в источнике "${sourceId}"`);
  }
  return column;
}

export function getJoinableColumnDefs(sourceId: string): ColumnDef[] {
  return getVisibleColumnDefs(sourceId).filter(column => column.type !== 'boolean');
}

async function queryLinkedSourceRows(options: {
  source: DataSource;
  sourceId: string;
  selectedColumns: string[];
  joinField: string;
  filters: Record<string, string[]>;
  periodFilters?: Record<string, { from: string; to: string }>;
  trustedPeriodFilters?: Record<string, { from: string; to: string }>;
  limit?: number;
}): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const {
    source,
    sourceId,
    selectedColumns,
    joinField,
    filters,
    periodFilters,
    trustedPeriodFilters,
    limit = DEFAULT_SOURCE_ROW_LIMIT,
  } = options;

  const cols = dedupe(safeColumns([...selectedColumns, joinField], sourceId));
  if (!cols.includes(joinField)) {
    throw new Error(`Поле связи "${joinField}" недоступно для источника "${sourceId}"`);
  }

  const { select, joins } = buildGenericSelectAndJoins(cols, sourceId);
  const tableRef = getSourceTableRef(sourceId);
  const pool = await getPoolForSource(source);
  const request = pool.request();
  const where = buildGenericWhere(request, filters, source, periodFilters, trustedPeriodFilters);
  const orderBy = detailReportOrderByLastResort(sourceId, getSourceTableAlias(sourceId));

  if (limit === LINKED_REPORT_ROW_UNLIMITED) {
    const result = await queryWithTimeout(
      request,
      `SELECT ${select}
       FROM ${tableRef}
       ${joins}
       ${where}
       ${orderBy}`,
      TIMEOUT.REPORT,
    );
    const rows = result.recordset as Record<string, unknown>[];
    return { rows, truncated: false };
  }

  const cap = getLinkedReportSourceRowCap();
  const requested = limit ?? DEFAULT_SOURCE_ROW_LIMIT;
  const safeLimit = Math.max(1, Math.min(cap, requested));

  const result = await queryWithTimeout(
    request,
    `SELECT TOP (${safeLimit + 1}) ${select}
     FROM ${tableRef}
     ${joins}
     ${where}
     ${orderBy}`,
    TIMEOUT.REPORT,
  );

  const rows = result.recordset as Record<string, unknown>[];
  return {
    rows: rows.slice(0, safeLimit),
    truncated: rows.length > safeLimit,
  };
}

export async function buildLinkedReport(
  body: LinkedReportRequest,
): Promise<LinkedReportResponse> {
  const link = getLinkOrThrow(body.linkId);
  const leftSource = getSourceOrThrow(link.leftSourceId);
  const rightSource = getSourceOrThrow(link.rightSourceId);

  const leftSelectedColumns = safeColumns(body.leftColumns ?? [], leftSource.id);
  const rightSelectedColumns = safeColumns(body.rightColumns ?? [], rightSource.id);

  if (leftSelectedColumns.length === 0 && rightSelectedColumns.length === 0) {
    throw new Error('Выберите хотя бы одну колонку для отчёта');
  }

  const leftJoinColumn = getColumnDefOrThrow(leftSource.id, link.leftJoinField);
  const rightJoinColumn = getColumnDefOrThrow(rightSource.id, link.rightJoinField);

  const isPreview = body.preview === true;
  const mergedRowLimit = isPreview ? 5 : resolveMergedRowLimit(body);
  const sourceRowLimit = isPreview
    ? Math.min(500, DEFAULT_SOURCE_ROW_LIMIT)
    : resolveSourceRowLimit(body);

  // Build trusted period filters from admin-configured sharedPeriodLink + user-supplied value
  const spl = link.sharedPeriodLink;
  const spv = body.sharedPeriodValue;
  let leftTrusted: Record<string, { from: string; to: string }> | undefined;
  let rightTrusted: Record<string, { from: string; to: string }> | undefined;
  if (spl && spv && (spv.from || spv.to)) {
    const { from, to } = spv;
    leftTrusted = spl.left.toField
      ? { ...(from ? { [spl.left.fromField]: { from, to: '' } } : {}), ...(to ? { [spl.left.toField]: { from: '', to } } : {}) }
      : { [spl.left.fromField]: { from, to } };
    rightTrusted = spl.right.toField
      ? { ...(from ? { [spl.right.fromField]: { from, to: '' } } : {}), ...(to ? { [spl.right.toField]: { from: '', to } } : {}) }
      : { [spl.right.fromField]: { from, to } };
  }

  const [leftResult, rightResult] = await Promise.all([
    queryLinkedSourceRows({
      source: leftSource,
      sourceId: leftSource.id,
      selectedColumns: leftSelectedColumns,
      joinField: link.leftJoinField,
      filters: body.leftFilters ?? {},
      periodFilters: body.leftPeriodFilters,
      trustedPeriodFilters: leftTrusted,
      limit: sourceRowLimit,
    }),
    queryLinkedSourceRows({
      source: rightSource,
      sourceId: rightSource.id,
      selectedColumns: rightSelectedColumns,
      joinField: link.rightJoinField,
      filters: body.rightFilters ?? {},
      periodFilters: body.rightPeriodFilters,
      trustedPeriodFilters: rightTrusted,
      limit: sourceRowLimit,
    }),
  ]);

  const leftColumns = leftSelectedColumns.map(key => getColumnDefOrThrow(leftSource.id, key));
  const rightColumns = rightSelectedColumns.map(key => getColumnDefOrThrow(rightSource.id, key));

  const rightByKey = new Map<string, Record<string, unknown>[]>();
  for (const row of rightResult.rows) {
    const joinValue = normalizeJoinValue(row[link.rightJoinField]);
    if (!joinValue) continue;
    const bucket = rightByKey.get(joinValue);
    if (bucket) {
      bucket.push(row);
    } else {
      rightByKey.set(joinValue, [row]);
    }
  }

  const mergedRows: Record<string, unknown>[] = [];
  const warnings: string[] = [];

  if (
    !isPreview &&
    (mergedRowLimit === LINKED_REPORT_ROW_UNLIMITED ||
      sourceRowLimit === LINKED_REPORT_ROW_UNLIMITED)
  ) {
    warnings.push(
      'Режим без лимитов: при необходимости SQL без TOP на источниках и/или без обрезки числа пар после склейки. Возможны очень большие выборки, долгое выполнение и высокая нагрузка на БД.',
    );
  }

  if (leftResult.truncated) {
    warnings.push(
      `Левая часть отчёта ограничена первыми ${sourceRowLimit.toLocaleString('ru-RU')} строками.`,
    );
  }
  if (rightResult.truncated) {
    warnings.push(
      `Правая часть отчёта ограничена первыми ${sourceRowLimit.toLocaleString('ru-RU')} строками.`,
    );
  }

  outer: for (const leftRow of leftResult.rows) {
    const joinValueRaw = leftRow[link.leftJoinField];
    const joinValue = normalizeJoinValue(joinValueRaw);
    if (!joinValue) continue;

    const rightMatches = rightByKey.get(joinValue);
    if (!rightMatches?.length) continue;

    for (const rightRow of rightMatches) {
      const nextRow: Record<string, unknown> = {
        __matchKey: joinValueRaw ?? rightRow[link.rightJoinField],
      };

      for (const column of leftColumns) {
        nextRow[`left__${column.key}`] = leftRow[column.key];
      }
      for (const column of rightColumns) {
        nextRow[`right__${column.key}`] = rightRow[column.key];
      }

      mergedRows.push(nextRow);

      if (
        mergedRowLimit !== LINKED_REPORT_ROW_UNLIMITED &&
        mergedRows.length >= mergedRowLimit
      ) {
        warnings.push(
          `Итоговая сводка ограничена первыми ${mergedRowLimit.toLocaleString('ru-RU')} совпадениями.`,
        );
        break outer;
      }
    }
  }

  const baseColumns: ColumnDef[] = [
    {
      key: '__matchKey',
      label: `${leftSource.name}: ${leftJoinColumn.label} ↔ ${rightSource.name}: ${rightJoinColumn.label}`,
      type: leftJoinColumn.type === 'number' && rightJoinColumn.type === 'number' ? 'number' : 'string',
    },
    ...leftColumns.map(column => buildLinkedColumn('left', leftSource.name, column)),
    ...rightColumns.map(column => buildLinkedColumn('right', rightSource.name, column)),
  ];

  const aggKey = isPreview ? undefined : body.aggregateByColumnKey?.trim();
  if (!aggKey) {
    return { columns: baseColumns, data: mergedRows, warnings };
  }

  const allowedKeys = new Set(baseColumns.map(c => c.key));
  if (!allowedKeys.has(aggKey)) {
    throw new Error(`Недопустимая колонка группировки: ${aggKey}`);
  }

  const aggregated = aggregateLinkedMergedRows(mergedRows, baseColumns, aggKey);
  const nextWarnings = [
    ...warnings,
    'Строки сгруппированы по выбранному полю; числовые колонки просуммированы по группе.',
  ];

  return {
    columns: columnsWithAggCount(baseColumns),
    data: aggregated,
    warnings: nextWarnings,
  };
}
