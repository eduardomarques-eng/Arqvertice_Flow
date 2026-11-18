"use client";

import type { ReactNode } from "react";

/**
 * Padrão Universal Responsivo (Dual-View Automática):
 * - Desktop (>= 1024px): Tabela limpa estilo Apple-minimalista.
 * - Mobile & Tablet (< 1024px): Cards empilhados inteligentes com zero overflow horizontal.
 */
export function ResponsiveDataView<T>({
  items,
  renderDesktopTable,
  renderMobileCard,
  emptyState,
  className = "",
}: {
  items: T[];
  renderDesktopTable: () => ReactNode;
  renderMobileCard: (item: T, index: number) => ReactNode;
  emptyState?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div className={className}>
        {emptyState || (
          <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Nenhum registro encontrado.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {/* Desktop Table (>= 1024px) */}
      <div className="hidden lg:block w-full min-w-0 overflow-x-auto rounded-2xl border border-slate-200/60 bg-white dark:border-white/10 dark:bg-zinc-900">
        {renderDesktopTable()}
      </div>

      {/* Mobile & Tablet Stacked Cards (< 1024px) */}
      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {items.map((item, idx) => renderMobileCard(item, idx))}
      </div>
    </div>
  );
}
