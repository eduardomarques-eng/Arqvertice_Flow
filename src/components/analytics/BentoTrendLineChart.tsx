"use client";

import React from "react";

export interface BentoTrendPoint {
  label: string;
  primary: number;
  secondary?: number;
  primaryFormatted?: string;
}

export function BentoTrendLineChart({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  points,
  className = "",
}: {
  title: string;
  subtitle?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  points: BentoTrendPoint[];
  className?: string;
}) {
  const width = 560;
  const height = 180;
  const padX = 28;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const maxVal = Math.max(
    1,
    ...points.flatMap((p) => [p.primary, p.secondary ?? 0])
  );

  const getCoord = (idx: number, val: number) => {
    const x =
      points.length <= 1
        ? padX + plotW / 2
        : padX + (idx / (points.length - 1)) * plotW;
    const y = padY + plotH - (Math.max(0, val) / maxVal) * plotH;
    return { x, y };
  };

  const primaryPath = points
    .map((p, i) => {
      const { x, y } = getCoord(i, p.primary);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const secondaryPath =
    secondaryLabel && points.some((p) => p.secondary !== undefined)
      ? points
          .map((p, i) => {
            const { x, y } = getCoord(i, p.secondary ?? 0);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ")
      : null;

  return (
    <div
      className={`min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#18181B] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
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
            <span className="h-2 w-4 rounded-full bg-amber-600" />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-slate-400 dark:bg-slate-500" />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-400">
          Sem pontos de série temporal.
        </div>
      ) : (
        <div className="w-full min-w-0 overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-48 sm:h-56 w-full">
            {/* Linhas horizontais de referência */}
            {[0.25, 0.5, 0.75, 1].map((t) => {
              const y = padY + plotH * (1 - t);
              return (
                <line
                  key={t}
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-slate-200 dark:text-white/10"
                />
              );
            })}

            {secondaryPath && (
              <path
                d={secondaryPath}
                fill="none"
                stroke="#71717A"
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            <path
              d={primaryPath}
              fill="none"
              stroke="#D97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((p, i) => {
              const { x, y } = getCoord(i, p.primary);
              return (
                <g key={`${p.label}-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#D97706"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y={Math.max(12, y - 9)}
                    textAnchor="middle"
                    className="fill-slate-600 dark:fill-slate-300 font-mono text-[10px] font-semibold"
                  >
                    {p.primaryFormatted ?? p.primary}
                  </text>
                  <text
                    x={x}
                    y={height - 4}
                    textAnchor="middle"
                    className="fill-slate-400 font-mono text-[10px] uppercase"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
