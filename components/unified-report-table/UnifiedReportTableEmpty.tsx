export function UnifiedReportTableEmpty({ isServer }: { isServer: boolean }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <p className="text-[13px] font-medium text-[#1c1b1a]">
          {isServer ? 'По этим условиям ничего не нашлось' : 'В таблице пока нет данных'}
        </p>
        <p className="mt-1 text-xs text-[#75726e]">
          Попробуйте убрать часть фильтров или изменить группировку.
        </p>
      </div>
    </div>
  );
}
