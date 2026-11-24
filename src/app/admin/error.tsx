"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ADMIN_ERROR_BOUNDARY]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F7] p-6 dark:bg-[#111116]">
      <Card className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white/85 p-6 shadow-lg backdrop-blur-md dark:border-amber-800/60 dark:bg-zinc-900/85">
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Command Center
        </p>
        <h2 className="mt-1 text-base font-bold text-slate-950 dark:text-zinc-100">
          Não foi possível carregar o Painel Geral
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300">
          Ocorreu uma instabilidade momentânea ao consultar os indicadores do estúdio.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
          >
            Recarregar Painel
          </button>
          <Link
            href="/admin/projetos"
            className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Ir para Projetos
          </Link>
        </div>
      </Card>
    </main>
  );
}
