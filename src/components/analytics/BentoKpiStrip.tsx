"use client";

import React from "react";
import { HorizontalScrollTrack } from "@/components/ui/horizontal-scroll-track";

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
  const desktopGridClass =
    columns === 3
      ? "md:grid md:grid-cols-3 md:gap-4"
      : columns === 4
      ? "md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4"
      : columns === 5
      ? "md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 md:gap-3"
      : "md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 md:gap-3";

  return (
    <HorizontalScrollTrack
      desktopGridClass={desktopGridClass}
      itemCount={items.length}
      label="Deslize os indicadores"
      className={className}
    >
      {items.map((item) => {
        const isFeatured = Boolean(item.featured);
        const deltaColor =
          item.deltaTone === "positive"
            ? "text-emerald-800 bg-emerald-50 border-emerald-200/80 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30"
            : item.deltaTone === "negative"
            ? "text-rose-800 bg-rose-50 border-rose-200/80 dark:text-rose-300 dark:bg-rose-500/15 dark:border-rose-500/30"
            : "text-zinc-700 bg-zinc-100 border-zinc-200/80 dark:text-zinc-300 dark:bg-white/10 dark:border-white/10";

        return (
          <div
            key={item.id}
            className={`min-w-[240px] sm:min-w-[250px] md:min-w-0 snap-start rounded-2xl p-4 sm:p-5 transition-colors ${
              isFeatured
                ? "border border-[#D6CFC2] bg-[#EDE5D8] text-[#18181B] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] dark:border-amber-500/40 dark:bg-[#18181B] dark:text-[#EDE5D8]"
                : "border border-slate-200/70 bg-white text-slate-900 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#18181B] dark:text-slate-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-[11px] font-medium uppercase tracking-wider break-words whitespace-normal ${
                  isFeatured
                    ? "text-[#18181B]/75 dark:text-[#EDE5D8]/75"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {item.label}
              </p>
              {item.delta && (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${deltaColor}`}
                >
                  {item.delta}
                </span>
              )}
            </div>

            <p
              className={`mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums break-words ${
                isFeatured
                  ? "text-[#18181B] dark:text-[#EDE5D8]"
                  : "text-slate-900 dark:text-slate-100"
              }`}
              title={item.value}
            >
              {item.value}
            </p>

            {item.subtitle && (
              <p
                className={`mt-1 text-[11px] break-words whitespace-normal ${
                  isFeatured
                    ? "text-[#18181B]/70 dark:text-slate-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {item.subtitle}
              </p>
            )}
          </div>
        );
      })}
    </HorizontalScrollTrack>
  );
}
