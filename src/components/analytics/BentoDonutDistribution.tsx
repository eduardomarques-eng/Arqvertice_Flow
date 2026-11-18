"use client";

import React from "react";

export interface BentoDonutSlice {
  id: string;
  label: string;
  value: number;
  formattedValue?: string;
}

// Paleta monocromática + âmbar arquitetônico (Linear/Claude)
const MONO_AMBER_HEX = [
  "#D97706", // Âmbar arquitetônico protagonista
  "#18181B", // Studio Obsidian
  "#71717A", // Zinc 500
  "#A1A1AA", // Zinc 400
  "#D4D4D8", // Zinc 300
  "#F59E0B", // Âmbar suave
];

export function BentoDonutDistribution({
  title,
  subtitle,
  centerLabel,
  centerValue,
  slices,
  className = "",
}: {
  title: string;
  subtitle?: string;
  centerLabel: string;
  centerValue: string;
  slices: BentoDonutSlice[];
  className?: string;
}) {
  const total = Math.max(
    1,
    slices.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  );

  // Construção determinística de arcos SVG (sem dependências pesadas)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div
      className={`min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-[#18181B] ${className}`}
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

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Donut SVG fino */}
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              className="text-slate-100 dark:text-white/5"
            />
            {slices.map((slice, idx) => {
              const fraction = Math.max(0, slice.value) / total;
              const dash = fraction * circumference;
              const gap = circumference - dash;
              const offset = -accumulatedOffset;
              accumulatedOffset += dash;
              const strokeColor = MONO_AMBER_HEX[idx % MONO_AMBER_HEX.length];

              return (
                <circle
                  key={slice.id}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {centerLabel}
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100 truncate max-w-full">
              {centerValue}
            </span>
          </div>
        </div>

        {/* Legenda tabular lateral */}
        <div className="w-full min-w-0 flex-1 space-y-2">
          {slices.map((slice, idx) => {
            const pct = Math.round((Math.max(0, slice.value) / total) * 100);
            const dotColor = MONO_AMBER_HEX[idx % MONO_AMBER_HEX.length];
            return (
              <div
                key={slice.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    style={{ backgroundColor: dotColor }}
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                  />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                    {slice.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {slice.formattedValue ?? slice.value}
                  </span>
                  <span className="w-9 text-right text-[11px] text-slate-400">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
