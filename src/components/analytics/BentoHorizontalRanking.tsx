"use client";

import React from "react";

export interface BentoRankingItem {
  id: string;
  label: string;
  value: number;
  formattedValue?: string;
  secondaryText?: string;
  highlight?: boolean;
}

export function BentoHorizontalRanking({
  title,
  subtitle,
  items,
  maxScale,
  className = "",
}: {
  title: string;
  subtitle?: string;
  items: BentoRankingItem[];
  maxScale?: number;
  className?: string;
}) {
  const maxVal =
    maxScale ?? Math.max(1, ...items.map((item) => Math.max(0, item.value)));

  return (
    <div
      className={`min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#18181B] ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {subtitle}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">
          Nenhum item para exibir no ranking.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const pct = Math.min(
              100,
              Math.max(2, Math.round((Math.max(0, item.value) / maxVal) * 100))
            );
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                      {item.label}
                    </span>
                    {item.secondaryText && (
                      <span className="text-[10px] text-slate-400 truncate block">
                        {item.secondaryText}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {item.formattedValue ?? item.value}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      item.highlight
                        ? "bg-amber-600 dark:bg-amber-500"
                        : "bg-[#18181B] dark:bg-[#EDE5D8]"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
