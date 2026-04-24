export function looksLikeDiagnosticExplanation(text: string): boolean {
  return /(ошибк|не удалось|невозможно|несуществующ|не найден|не найдены|связана с|в таблице используются значения|поле\s+[«"][^«"]+[»"]|колонк\w+|данные\s+за\s+прошл\w+\s+\w+\s+отсутствуют|нет\s+договоров)/i.test(text);
}

export function formatRecordCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count.toLocaleString('ru-RU')} запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count.toLocaleString('ru-RU')} записи`;
  }
  return `${count.toLocaleString('ru-RU')} записей`;
}

export function normalizeSuccessfulExplanation(explanation: string, rowCount: number): string {
  const trimmed = explanation.trim();
  if (!trimmed) {
    return `Отчёт сформирован. В выборке ${formatRecordCount(rowCount)}.`;
  }
  if (!looksLikeDiagnosticExplanation(trimmed)) {
    return trimmed;
  }
  return `Отчёт сформирован. В выборке ${formatRecordCount(rowCount)}.`;
}

export function isRecoverableSqlSchemaError(text: string): boolean {
  return /(invalid column name|invalid object name|ambiguous column name|multi-part identifier .* could not be bound|неверное имя столбца|неверное имя объекта|не удалось привязать multipart identifier|ошибка валидации: недопустимые таблицы)/i.test(text);
}
