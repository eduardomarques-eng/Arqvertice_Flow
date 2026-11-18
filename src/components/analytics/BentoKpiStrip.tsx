"use client";

import React from "react";

export interface BentoKpiItem {
  id: string;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  subtitle?: string;
  featured?: boolean;
}

export function BentoKpiStrip({
  items,
  columns = 6,
  className = "",
}: {
  items: BentoKpiItem[];
  columns?: 3 | 4 | 5 | 6;
  className?: string;
}) {
  const gridColsClass =
    columns === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : columns === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : columns === 5
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

  return (
    <div className={`grid ${gridColsClass} gap-3 ${className}`}>
      {items.map((item) => {
        const isFeatured = Boolean(item.featured);
        const deltaColor =
          item.deltaTone === "positive"
            ? "text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30"
            : item.deltaTone === "negative"
            ? "text-rose-700 bg-rose-50 border-rose-200/80 dark:text-rose-300 dark:bg-rose-500/15 dark:border-rose-500/30"
            : "text-slate-600 bg-slate-100 border-slate-200/80 dark:text-slate-300 dark:bg-white/10 dark:border-white/10";

        return (
          <div
            key={item.id}
            className={`min-w-0 rounded-2xl border p-4 transition-colors ${
              isFeatured
                ? "border-amber-500/40 bg-gradient-to-br from-[#EDE5D8]/60 via-white to-amber-50/40 dark:border-amber-500/40 dark:from-[#18181B] dark:via-[#18181B] dark:to-amber-950/20 shadow-sm"
                : "border-slate-200/70 bg-white dark:border-white/10 dark:bg-[#18181B] shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                {item.label}
              </p>
              {item.delta && (
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${deltaColor}`}
                >
                  {item.delta}
                </span>
              )}
            </div>

            <p
              className={`mt-2 font-mono text-lg sm:text-xl font-semibold tracking-tight tabular-nums truncate ${
                isFeatured
                  ? "text-[#18181B] dark:text-[#EDE5D8]"
                  : "text-slate-900 dark:text-slate-100"
              }`}
              title={item.value}
            >
              {item.value}
            </p>

            {item.subtitle && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {item.subtitle}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
