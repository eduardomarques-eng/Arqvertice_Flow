"use client";

import React, { useState } from "react";

export * from "./BentoKpiStrip";
export * from "./BentoBarComparisonChart";
export * from "./BentoDonutDistribution";
export * from "./BentoTrendLineChart";
export * from "./BentoHorizontalRanking";
export * from "./BentoCollapsibleBreakdownTable";

/**
 * Wrapper discreto e recolhível com 1 clique para Dashboards Estratégicos de Nível 2.
 */
export function BentoCollapsiblePanel({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-[#18181B]/70 p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-amber-600 shrink-0" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate">
            {title}
          </h2>
          {badge && (
            <span className="hidden sm:inline-block rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {badge}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#09090B] px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition"
        >
          <span>{isOpen ? "Recolher" : "Expandir"}</span>
          <span>{isOpen ? "▴" : "▾"}</span>
        </button>
      </div>

      {isOpen && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );
}
