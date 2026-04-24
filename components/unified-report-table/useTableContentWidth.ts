import { type RefObject, useEffect, useState } from 'react';
import type { ReportColumn } from './types';

export function useTableContentWidth(
  tableScrollRef: RefObject<HTMLDivElement | null>,
  data: Record<string, unknown>[],
  displayColumns: ReportColumn[],
): number {
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const measure = () => {
      const t = el.querySelector('table');
      if (t) setContentWidth(t.scrollWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableScrollRef, data, displayColumns]);

  return contentWidth;
}
