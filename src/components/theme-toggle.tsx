"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useIdleTimer } from "@/components/idle-timer-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { triggerIdleNow } = useIdleTimer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="inline-flex h-9 w-24 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 px-2.5 text-xs text-slate-400 dark:border-white/10 dark:bg-[#18181B]" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/70 bg-[#F5F5F7] p-1 dark:border-white/10 dark:bg-[#18181B]">
      <button
        type="button"
        data-testid="theme-toggle-button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Ativar Modo Claro (Warm Minimalist)" : "Ativar Modo Noturno (Studio Dark)"}
        title={
          isDark
            ? "Modo Noturno Ativo (#09090B · Studio Dark) — Clique para Modo Claro (#F5F5F7)"
            : "Modo Claro Ativo (#F5F5F7 · Warm Minimalist) — Clique para Modo Noturno (#09090B)"
        }
        className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
          isDark
            ? "bg-[#09090B] text-[#EDE5D8] border border-white/10 shadow-xs"
            : "bg-white text-[#18181B] border border-slate-200/80 shadow-xs"
        }`}
      >
        <span>{isDark ? "🌙" : "☀️"}</span>
        {!compact && <span>{isDark ? "Studio Dark" : "Warm Light"}</span>}
      </button>

      {!compact && (
        <button
          type="button"
          onClick={() => setTheme("system")}
          title="Sincronizar com o tema do sistema operacional"
          className={`hidden sm:inline-flex min-h-[30px] items-center rounded-lg px-2 py-1 text-[11px] font-medium transition ${
            theme === "system"
              ? "bg-[#EDE5D8]/80 text-[#18181B] dark:bg-white/10 dark:text-slate-200 font-semibold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Auto
        </button>
      )}

      {!compact && (
        <button
          type="button"
          data-testid="screensaver-trigger-button"
          onClick={triggerIdleNow}
          title="Ativar Tela de Descanso (Screen Saver 3D)"
          className="hidden md:inline-flex min-h-[30px] items-center rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200 transition"
        >
          💤
        </button>
      )}
    </div>
  );
}
