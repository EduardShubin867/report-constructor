export function UnifiedReportTableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 border-b border-[#e7e5e3] bg-[#f5f5f4]" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-8 border-b border-[#e7e5e3] bg-white" />
      ))}
    </div>
  );
}
