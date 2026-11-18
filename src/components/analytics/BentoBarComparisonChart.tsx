"use client";

import React, { useState } from "react";

export interface BentoBarGroupItem {
  label: string;
  primaryValue: number;
  secondaryValue?: number;
  primaryFormatted?: string;
  secondaryFormatted?: string;
}

export function BentoBarComparisonChart({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  data,
  heightClass = "h-56 sm:h-64",
  className = "",
}: {
  title: string;
  subtitle?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  data: BentoBarGroupItem[];
  heightClass?: string;
  className?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.primaryValue, d.secondaryValue ?? 0])
  );

  return (
    <div
      className={`min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#18181B] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#18181B] dark:bg-[#EDE5D8]" />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-600 dark:bg-amber-500" />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className={`${heightClass} flex items-center justify-center text-xs text-slate-400`}>
          Sem dados disponíveis para o período.
        </div>
      ) : (
        <div className="w-full min-w-0 overflow-hidden">
          <div
            className={`${heightClass} flex items-end justify-between gap-2 sm:gap-3 pt-7 pb-2 border-b border-slate-100 dark:border-white/10`}
          >
            {data.map((d, idx) => {
              const pHeight = Math.max(4, Math.round((d.primaryValue / maxVal) * 100));
              const sHeight =
                d.secondaryValue !== undefined
                  ? Math.max(d.secondaryValue > 0 ? 4 : 0, Math.round((d.secondaryValue / maxVal) * 100))
                  : 0;
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={`${d.label}-${idx}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="relative flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5 group"
                >
                  {/* Tooltip limpo no hover */}
                  {isHovered && (
                    <div className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono shadow-md dark:border-white/15 dark:bg-[#09090B] dark:text-slate-100">
                      <span className="font-bold">{d.label}:</span>{" "}
                      {d.primaryFormatted ?? d.primaryValue}
                      {secondaryLabel && d.secondaryValue !== undefined
                        ? ` / ${d.secondaryFormatted ?? d.secondaryValue}`
                        : ""}
                    </div>
                  )}

                  <span className="hidden md:block font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400 truncate max-w-full">
                    {d.primaryFormatted ?? d.primaryValue}
                  </span>

                  <div className="w-full max-w-[48px] h-full flex items-end justify-center gap-1">
                    <div
                      style={{ height: `${pHeight}%` }}
                      className={`${
                        secondaryLabel ? "w-1/2" : "w-3/4"
                      } rounded-t-md bg-[#18181B] dark:bg-[#EDE5D8] transition-all duration-300 group-hover:opacity-85`}
                    />
                    {secondaryLabel && d.secondaryValue !== undefined && (
                      <div
                        style={{ height: `${sHeight}%` }}
                        className="w-1/2 rounded-t-md bg-amber-600 dark:bg-amber-500 transition-all duration-300 group-hover:opacity-85"
                      />
                    )}
                  </div>

                  <span className="font-mono text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 truncate max-w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
