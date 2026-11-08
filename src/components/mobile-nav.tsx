"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";

type NavLink = readonly [string, string];

interface MobileNavProps {
  links: readonly NavLink[];
  environment?: "admin" | "client";
  areaLabel: string;
  groupLabel: string;
}

export function MobileNav({ links, environment = "admin", areaLabel, groupLabel }: MobileNavProps) {
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

  const isClientEnv = environment === "client";

  return (
    <div className="lg:hidden">
      {/* Botão Hambúrguer no Header Mobile */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-[0.98] transition-transform duration-75 select-none hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Drawer deslizante Apple-style */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-4/5 max-w-xs transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          isClientEnv ? "bg-slate-950 text-white" : "bg-white text-slate-900"
        } border-r border-slate-200 shadow-2xl flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
          <Link href="/" onClick={() => setIsOpen(false)} className="block">
            <Brand compact showTagline={false} />
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98] transition-transform duration-75 select-none"
            aria-label="Fechar navegação"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-3">
          <p className="text-xs text-slate-400">{areaLabel}</p>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {groupLabel}
          </p>
        </div>

        <nav className="mt-3 flex-1 overflow-y-auto px-4 py-2 space-y-1.5" aria-label="Navegação móvel">
          {links.map(([label, href]) => {
            const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`flex min-h-[44px] items-center rounded-xl px-4 py-2.5 text-sm font-medium active:scale-[0.98] transition-transform duration-75 select-none ${
                  isActive
                    ? isClientEnv
                      ? "bg-blue-600 text-white font-semibold"
                      : "bg-blue-50 text-blue-700 font-semibold"
                    : isClientEnv
                      ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4 pb-safe">
          <div className="text-xs text-slate-400 text-center">
            ArqVértice Flow · Mobile iOS/Android
          </div>
        </div>
      </div>
    </div>
  );
}

