export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 md:px-10 md:py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-200/50" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-slate-200/50" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
            >
              <div className="h-3 w-24 rounded bg-slate-200/50" />
              <div className="mt-4 h-7 w-16 rounded-lg bg-slate-200/50" />
            </div>
          ))}
        </div>

        <div className="h-64 animate-pulse rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]" />
      </div>
    </div>
  );
}
