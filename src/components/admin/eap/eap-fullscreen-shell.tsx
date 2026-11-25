"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface EapFullscreenShellProps {
  open: boolean;
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function EapFullscreenShell({
  open,
  title,
  subtitle,
  toolbar,
  onClose,
  children,
}: EapFullscreenShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trava scroll do body enquanto tela cheia estiver ativa (sem scroll duplo)
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Esc fecha o modo tela cheia (preservando edições) quando não há input ativo capturando Esc
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const active = document.activeElement;
      const tag = active?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }
      e.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-white text-slate-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      {/* Cabeçalho compacto com efeito vidro no topo do modo tela cheia */}
      <header className="shrink-0 border-b border-slate-200/80 bg-white/85 px-4 py-2.5 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/85">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="truncate text-sm font-bold text-slate-950 dark:text-zinc-100">
                {title}
              </h2>
            </div>
            {subtitle && (
              <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {toolbar}
            <button
              type="button"
              onClick={onClose}
              title="Sair do modo tela cheia (Esc)"
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              Recolher
              <kbd className="rounded bg-white/15 px-1 text-[9px] font-mono">Esc</kbd>
            </button>
          </div>
        </div>
      </header>

      {/* Área principal única de rolagem para a planilha */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3">
        {children}
      </div>
    </div>,
    document.body
  );
}
