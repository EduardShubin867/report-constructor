import { type RefObject } from 'react';

type Props = {
  floatingScrollRef: RefObject<HTMLDivElement | null>;
  contentWidth: number;
  onScroll: () => void;
};

export function UnifiedReportTableFloatingScroll({
  floatingScrollRef,
  contentWidth,
  onScroll,
}: Props) {
  return (
    <div
      ref={floatingScrollRef}
      className="flex-shrink-0 overflow-x-auto border-t border-[#e7e5e3]"
      onScroll={onScroll}
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>
  );
}
