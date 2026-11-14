export function AcervoSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-36 animate-pulse rounded-xl bg-slate-200/50" />
        <div className="h-8 w-80 max-w-full animate-pulse rounded-xl bg-slate-200/50" />
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
          >
            <div className="h-3 w-24 rounded-lg bg-slate-200/50" />
            <div className="mt-4 h-7 w-16 rounded-xl bg-slate-200/50" />
            <div className="mt-2 h-3 w-32 rounded-lg bg-slate-200/50" />
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="h-64 w-full animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="h-4 w-48 rounded-xl bg-slate-200/50" />
        <div className="mt-4 h-44 w-full rounded-xl bg-slate-200/50" />
      </div>

      {/* Table Skeleton */}
      <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-12 w-full animate-pulse rounded-xl bg-slate-200/50" />
        ))}
      </div>
    </div>
  );
}
