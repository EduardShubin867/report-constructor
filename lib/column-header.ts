import { ALL_COLUMNS } from '@/lib/report-columns';

const LABEL_BY_KEY = new Map(ALL_COLUMNS.map(c => [c.key, c.label]));

/**
 * Вставляет пробелы на границах «слов» в идентификаторах PascalCase
 * (кириллица и латиница), например: КоличествоДоговоров → Количество Договоров.
 * Подчёркивания заменяются на пробелы.
 */
export function splitIdentifierWords(name: string): string {
  if (!name) return '';
  let s = name.trim().replace(/_/g, ' ');
  // Строчная буква или цифра, затем заглавная — граница слова
  s = s.replace(/([a-zа-яё0-9])([A-ZА-ЯЁ])/g, '$1 $2');
  return s.replace(/\s+/g, ' ').trim();
}

/** Заголовок колонки для таблицы результатов AI: известный label из схемы или разбивка PascalCase */
export function resolveAiColumnHeader(columnKey: string): string {
  return LABEL_BY_KEY.get(columnKey) ?? splitIdentifierWords(columnKey);
}
