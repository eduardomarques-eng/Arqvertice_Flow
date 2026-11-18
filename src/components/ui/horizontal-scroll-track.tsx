"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Componente utilitário de fluidez horizontal dinâmica para Mobile (< 768px):
 * - No mobile: transforma a lista em trilha deslizante (`snap-x snap-mandatory`)
 *   com pílula indicadora e setas táteis 44×44px, evitando corte ou esmagamento de conteúdo.
 * - No desktop (md+): aplica o grid padrão passado via `desktopGridClass`.
 */
export function HorizontalScrollTrack({
  children,
  desktopGridClass = "md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4",
  itemCount = 0,
  label = "Deslize para ver mais",
  className = "",
}: {
  children: React.ReactNode;
  desktopGridClass?: string;
  itemCount?: number;
  label?: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(maxScroll > 12 && el.scrollLeft < maxScroll - 8);
  }, []);

  useEffect(() => {
    updateScrollEdges();
    window.addEventListener("resize", updateScrollEdges);
    return () => window.removeEventListener("resize", updateScrollEdges);
  }, [updateScrollEdges, itemCount]);

  const scrollByStep = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(240, Math.round(el.clientWidth * 0.78));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {/* Indicador tátil no mobile quando há conteúdo horizontal deslizável */}
      {(canScrollLeft || canScrollRight) && (
        <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-[#18181B] dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
            <span>{label}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollByStep(-1)}
              disabled={!canScrollLeft}
              aria-label="Rolar para esquerda"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-xs font-bold text-slate-700 shadow-2xs disabled:opacity-35 dark:border-white/10 dark:bg-[#18181B] dark:text-slate-200"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollByStep(1)}
              disabled={!canScrollRight}
              aria-label="Rolar para direita"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-xs font-bold text-slate-700 shadow-2xs disabled:opacity-35 dark:border-white/10 dark:bg-[#18181B] dark:text-slate-200"
            >
              ›
            </button>
          </div>
        </div>
      )}

      <div
        ref={trackRef}
        onScroll={updateScrollEdges}
        className={`flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-3 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${desktopGridClass} md:overflow-visible md:pb-0`}
      >
        {children}
      </div>
    </div>
  );
}
