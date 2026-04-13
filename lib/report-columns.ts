export type ColumnType = 'string' | 'number' | 'date' | 'boolean';

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  /** Число без дробной части в таблице / Excel (например кол-во договоров). */
  integer?: boolean;
  /** If set, this column is fetched via a LEFT JOIN; value is the FK alias from schema */
  joinKey?: string;
  /** SQL expression used in SELECT (e.g. "[dg].[Наименование]") */
  sqlExpr?: string;
  /** If true, column is available as a GROUP BY dimension */
  groupable?: boolean;
}

/**
 * Static label/metadata reference for known columns.
 * Serves as a lookup table for UI labels and JOIN-derived column definitions.
 * Logic (hidden, filterable, groupable, dateFilter) now comes from data/sources.json.
 *
 * FK column aliases use the schema FK alias (dg, ter, krm, krp).
 */
export const ALL_COLUMNS: ColumnDef[] = [
  // --- Main table columns ---
  { key: 'НомерДоговора', label: 'Номер договора', type: 'string' },
  { key: 'Агент', label: 'Агент', type: 'string' },
  { key: 'СубАгент', label: 'Субагент', type: 'string' },
  { key: 'ДатаЗаключения', label: 'Дата заключения', type: 'date' },
  { key: 'ДатаНачала', label: 'Дата начала', type: 'date' },
  { key: 'ДатаОкончания', label: 'Дата окончания', type: 'date' },
  { key: 'ДатаНачисления', label: 'Дата начисления', type: 'date' },
  { key: 'Марка', label: 'Марка', type: 'string' },
  { key: 'Модель', label: 'Модель', type: 'string' },
  { key: 'МаркаМодель', label: 'Марка/Модель', type: 'string' },
  { key: 'ГодВыпуска', label: 'Год выпуска', type: 'number' },
  { key: 'VIN', label: 'VIN', type: 'string' },
  { key: 'ГРЗ', label: 'ГРЗ', type: 'string' },
  { key: 'МощностьДвигателя', label: 'Мощность двигателя', type: 'number' },
  { key: 'Страхователь', label: 'Страхователь', type: 'string' },
  { key: 'СобственникТС', label: 'Собственник ТС', type: 'string' },
  { key: 'Премия', label: 'Премия', type: 'number' },
  { key: 'ПремияКросс', label: 'Премия кросс', type: 'number' },
  { key: 'ПремияОСАГОПлюсКросс', label: 'Премия ОСАГО+Кросс', type: 'number' },
  { key: 'ДоплатаВозврат', label: 'Доплата/Возврат', type: 'number' },
  { key: 'Регион', label: 'Регион', type: 'string' },
  { key: 'РегионФакт', label: 'Регион факт', type: 'string' },
  { key: 'ВидДоговора', label: 'Вид договора', type: 'string' },
  { key: 'КатегорияПолная', label: 'Категория полная', type: 'string' },
  { key: 'КатегорияСокращенная', label: 'Категория сокр.', type: 'string' },
  { key: 'КБМ', label: 'КБМ', type: 'number' },
  { key: 'КВС', label: 'КВС', type: 'number' },
  { key: 'КМ', label: 'КМ', type: 'number' },
  { key: 'ТарифБазовый', label: 'Тариф базовый', type: 'number' },
  { key: 'ДоляОСАГО', label: 'Доля ОСАГО', type: 'number' },
  { key: 'ПереданВПул', label: 'Передан в пул', type: 'number' },
  { key: 'ЦельИспользования', label: 'Цель использования', type: 'string' },
  { key: 'КлассБонусМалус', label: 'Класс Бонус-Малус', type: 'string' },
  { key: 'ИсточникДокумента', label: 'Источник документа', type: 'string' },
  { key: 'Срок', label: 'Срок', type: 'number' },
  { key: 'ЗаработаноДоля', label: 'Заработано доля', type: 'number' },
  { key: 'ЗаработаннаяПремияОСАГОПлюсКросс', label: 'Заработанная премия ОСАГО+Кросс', type: 'number' },

  // --- JOIN-derived columns (aliases match schema foreignKeys) ---
  {
    key: 'ТерриторияНаименование',
    label: 'Территория (название)',
    type: 'string',
    joinKey: 'ter',
    sqlExpr: '[ter].[Наименование]',
  },
  {
    key: 'ТерриторияКТ',
    label: 'Территория КТ',
    type: 'number',
    joinKey: 'ter',
    sqlExpr: '[ter].[КТ]',
  },
  {
    key: 'ДГНаименование',
    label: 'ДГ (название)',
    type: 'string',
    joinKey: 'dg',
    sqlExpr: '[dg].[Наименование]',
  },
  {
    key: 'КРМзначение',
    label: 'КРМ',
    type: 'number',
    joinKey: 'krm',
    sqlExpr: '[krm].[КРМ]',
  },
  {
    key: 'КРПзначение',
    label: 'КРП',
    type: 'number',
    joinKey: 'krp',
    sqlExpr: '[krp].[КРП]',
  },
];

/**
 * O(1) lookup map: column key → metadata.
 * Used by visible-columns.ts to resolve labels and sqlExpr for known columns.
 */
export const COLUMN_LABEL_MAP = new Map(ALL_COLUMNS.map(c => [c.key, c]));

/**
 * Lookup by sqlExpr — used by visible-columns.ts to match FK-derived columns
 * from schema foreignKeys to their known key/label entries.
 */
export const COLUMN_BY_SQL_EXPR = new Map(
  ALL_COLUMNS.filter(c => c.sqlExpr).map(c => [c.sqlExpr!, c]),
);

export const DEFAULT_COLUMNS: string[] = [
  'НомерДоговора',
  'Агент',
  'СубАгент',
  'ДатаЗаключения',
  'МаркаМодель',
  'Страхователь',
  'Премия',
  'ПремияКросс',
  'Регион',
];

/** Ключ колонки COUNT(*) в сгруппированном ручном отчёте (совпадает с AS в SQL). */
export const CONTRACT_COUNT_COLUMN_KEY = 'КоличествоДоговоров';
