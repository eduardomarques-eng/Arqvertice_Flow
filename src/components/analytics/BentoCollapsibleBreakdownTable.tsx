"use client";

import React, { useState } from "react";

export interface BentoBreakdownChildRow {
  id: string;
  label: string;
  col1: string;
  col2: string;
  col3: string;
}

export interface BentoBreakdownGroup {
  id: string;
  label: string;
  col1: string;
  col2: string;
  col3: string;
  children?: BentoBreakdownChildRow[];
}

export function BentoCollapsibleBreakdownTable({
  title,
  subtitle,
  headers,
  groups,
  totalRow,
  className = "",
}: {
  title: string;
  subtitle?: string;
  headers: [string, string, string, string];
  groups: BentoBreakdownGroup[];
  totalRow: { col1: string; col2: string; col3: string };
  className?: string;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleGroup = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={`min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#18181B] ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {/* Desktop Table (>= 1024px) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 pr-3">{headers[0]}</th>
              <th className="py-2.5 px-3 text-right">{headers[1]}</th>
              <th className="py-2.5 px-3 text-right">{headers[2]}</th>
              <th className="py-2.5 pl-3 text-right">{headers[3]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {groups.map((g) => {
              const isExpanded = expandedIds.has(g.id);
              const hasChildren = Boolean(g.children && g.children.length > 0);
              return (
                <React.Fragment key={g.id}>
                  <tr className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                    <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100">
                      <button
                        type="button"
                        onClick={() => hasChildren && toggleGroup(g.id)}
                        className="inline-flex items-center gap-2 text-left"
                      >
                        {hasChildren ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 dark:border-white/15 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            {isExpanded ? "−" : "+"}
                          </span>
                        ) : (
                          <span className="inline-block w-5" />
                        )}
                        <span>{g.label}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {g.col1}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {g.col2}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      {g.col3}
                    </td>
                  </tr>
                  {isExpanded &&
                    g.children?.map((child) => (
                      <tr
                        key={child.id}
                        className="bg-slate-50/50 dark:bg-white/[0.02] text-[11px]"
                      >
                        <td className="py-2 pl-9 pr-3 text-slate-600 dark:text-slate-400">
                          {child.label}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {child.col1}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                          {child.col2}
                        </td>
                        <td className="py-2 pl-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                          {child.col3}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-white/15 bg-slate-50/80 dark:bg-white/5 font-bold text-xs">
              <td className="py-3 pr-3 uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Total Consolidado
              </td>
              <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {totalRow.col1}
              </td>
              <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {totalRow.col2}
              </td>
              <td className="py-3 pl-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                {totalRow.col3}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile & Tablet Stacked Cards (< 1024px) */}
      <div className="space-y-2.5 lg:hidden">
        {groups.map((g) => {
          const isExpanded = expandedIds.has(g.id);
          const hasChildren = Boolean(g.children && g.children.length > 0);
          return (
            <div
              key={g.id}
              className="rounded-xl border border-slate-200/70 dark:border-white/10 p-3.5 space-y-2"
            >
              <button
                type="button"
                onClick={() => hasChildren && toggleGroup(g.id)}
                className="flex w-full items-center justify-between gap-2 text-left min-h-[44px]"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {g.label}
                </span>
                {hasChildren && (
                  <span className="shrink-0 rounded border border-slate-200 dark:border-white/15 px-2 py-0.5 font-mono text-xs font-bold">
                    {isExpanded ? "−" : "+"}
                  </span>
                )}
              </button>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums">
                <div>
                  <span className="block text-[9px] uppercase text-slate-400">{headers[1]}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{g.col1}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-slate-400">{headers[2]}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{g.col2}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-slate-400">{headers[3]}</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">{g.col3}</span>
                </div>
              </div>
              {isExpanded && g.children && (
                <div className="border-t border-slate-100 dark:border-white/10 pt-2 space-y-1.5">
                  {g.children.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="truncate pr-2">{c.label}</span>
                      <span className="font-mono tabular-nums shrink-0">{c.col1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="rounded-xl border border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Consolidado
          </p>
          <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-xs font-bold tabular-nums">
            <span className="text-slate-900 dark:text-slate-100">{totalRow.col1}</span>
            <span className="text-emerald-700 dark:text-emerald-400">{totalRow.col2}</span>
            <span className="text-amber-700 dark:text-amber-400">{totalRow.col3}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
