"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";

type NavLink = readonly [string, string] | readonly [string, string, number];

interface MobileNavProps {
  links: readonly NavLink[];
  environment?: "admin" | "client";
  areaLabel: string;
  groupLabel: string;
}

const ROOT_PATHS = new Set(["/admin", "/equipe", "/portal"]);

export function MobileNav({ links, areaLabel, groupLabel }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer automaticamente ao mudar de rota
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Previne rolagem de fundo quando o drawer estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      {/* Botão Hambúrguer no Header Mobile */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#18181B] text-slate-900 dark:text-slate-100 shadow-sm active:scale-[0.98] transition-transform duration-75 select-none hover:bg-[#EDE5D8]/40 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#18181B]/30"
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isOpen}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Backdrop com desfoque */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Drawer deslizante Apple-style */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-4/5 max-w-xs transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } bg-white/90 dark:bg-[#141419]/90 backdrop-blur-xl text-zinc-900 dark:text-zinc-100 border-r border-zinc-200/70 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200/70 dark:border-white/10 px-5 py-5">
          <Link href="/" onClick={() => setIsOpen(false)} className="block">
            <Brand compact showTagline={false} />
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100/80 dark:hover:bg-white/10 hover:text-zinc-700 dark:hover:text-zinc-200 active:scale-[0.98] transition-all duration-150 select-none"
            aria-label="Fechar navegação"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{areaLabel}</p>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
            {groupLabel}
          </p>
        </div>

        <nav className="mt-3 flex-1 overflow-y-auto px-4 py-2 space-y-1" aria-label="Navegação móvel">
          {links.map(([label, href]) => {
            const isActive =
              pathname === href || (!ROOT_PATHS.has(href) && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm tracking-tight active:scale-[0.985] transition-all duration-150 select-none ${
                  isActive
                    ? "bg-zinc-900/[0.06] dark:bg-white/[0.11] text-zinc-950 dark:text-white font-semibold ring-1 ring-inset ring-zinc-900/[0.06] dark:ring-white/[0.08]"
                    : "font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900/[0.035] dark:hover:bg-white/[0.05] hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200/70 dark:border-white/10 p-4 pb-safe">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
            ArqVértice OS · Mobile iOS/Android
          </div>
        </div>
      </div>
    </div>
  );
}

