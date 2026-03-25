export type ColumnType = 'string' | 'number' | 'date' | 'boolean';

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  /** If set, this column is fetched via a LEFT JOIN and needs sqlExpr for SELECT */
  joinKey?: string;
  /** SQL expression used in SELECT (e.g. "[j_терр].[Наименование]") */
  sqlExpr?: string;
}

/**
 * JOIN definitions — alias used consistently across SELECT and JOIN clause.
 * Filters that reference these tables use subqueries (no JOIN needed for COUNT).
 */
export interface JoinDef {
  key: string;
  /** Full LEFT JOIN SQL snippet using the alias */
  sql: string;
}

export const JOINS: Record<string, JoinDef> = {
  территория: {
    key: 'территория',
    sql: 'LEFT JOIN [dbo].[Территории] AS [j_терр] ON m.[ID_ТерриторияИспользованияТС] = [j_терр].[ID]',
  },
  дг: {
    key: 'дг',
    sql: 'LEFT JOIN [dbo].[ДГ] AS [j_дг] ON m.[ID_ДГ] = [j_дг].[Код]',
  },
  крм: {
    key: 'крм',
    sql: 'LEFT JOIN [dbo].[КРМ] AS [j_крм] ON m.[ID_КРМ] = [j_крм].[ID]',
  },
  крп: {
    key: 'крп',
    sql: 'LEFT JOIN [dbo].[КРП] AS [j_крп] ON m.[ID_КРП] = [j_крп].[ID]',
  },
};

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

  // --- JOIN columns ---
  {
    key: 'ТерриторияНаименование',
    label: 'Территория (название)',
    type: 'string',
    joinKey: 'территория',
    sqlExpr: '[j_терр].[Наименование]',
  },
  {
    key: 'ТерриторияКТ',
    label: 'Территория КТ',
    type: 'number',
    joinKey: 'территория',
    sqlExpr: '[j_терр].[КТ]',
  },
  {
    key: 'ДГНаименование',
    label: 'ДГ (название)',
    type: 'string',
    joinKey: 'дг',
    sqlExpr: '[j_дг].[Наименование]',
  },
  {
    key: 'КРМзначение',
    label: 'КРМ',
    type: 'number',
    joinKey: 'крм',
    sqlExpr: '[j_крм].[КРМ]',
  },
  {
    key: 'КРПзначение',
    label: 'КРП',
    type: 'number',
    joinKey: 'крп',
    sqlExpr: '[j_крп].[КРП]',
  },
];

/** Set of all valid column keys — used for allowlist validation */
export const COLUMN_KEYS = new Set(ALL_COLUMNS.map(c => c.key));

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
