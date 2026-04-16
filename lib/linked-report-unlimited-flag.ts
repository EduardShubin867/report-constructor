/** Разрешить mergedRowLimit/sourceRowLimit = -1 (без TOP и без обрезки при склейке). */
export function isLinkedReportUnlimitedRowsAllowed(): boolean {
  const v = process.env.LINKED_REPORT_ALLOW_UNLIMITED?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
