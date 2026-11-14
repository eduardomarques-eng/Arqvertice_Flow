"use client";

import Link from "next/link";
import { PLUGIN_PACKAGES } from "@/lib/acervo/plugin-packages";

export function AcervoPluginsHub({ basePath }: { basePath: "/admin" | "/equipe" }) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href={`${basePath}/acervo`} className="hover:text-slate-900">
                ← Voltar ao Acervo Manager
              </Link>
              <span>·</span>
              <span>Conectores Nativos CAD / BIM / 3D</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#18181B]">
              Central de Plugins & Conectores CDE
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Pacotes pré-configurados com o endpoint{" "}
              <code className="rounded bg-[#F5F5F7] px-1.5 py-0.5 text-xs text-slate-800">
                https://arqvertice-flow.vercel.app
              </code>{" "}
              para publicação em lote com validação de máscara e emissão automática de GRD.
            </p>
          </div>

          {basePath === "/admin" && (
            <Link
              href="/admin/acervo/configuracoes"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#18181B] px-4 text-xs font-semibold text-white transition hover:bg-zinc-800"
            >
              Gerenciar Tokens API
            </Link>
          )}
        </div>

        {/* Endpoints Reference Bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { method: "POST", path: "/api/acervo/plugins/auth", desc: "Auth & Disciplinas" },
            { method: "GET", path: "/api/acervo/plugins/context", desc: "Pastas & Máscara" },
            { method: "POST", path: "/api/acervo/plugins/check-revisions", desc: "Check R00 ➔ R01" },
            { method: "POST", path: "/api/acervo/plugins/publish-batch", desc: "Publicação + GRD" },
          ].map((ep) => (
            <div
              key={ep.path}
              className="rounded-2xl border border-slate-200/60 bg-white p-3.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#EDE5D8] px-2 py-0.5 font-mono text-[10px] font-bold text-[#18181B]">
                  {ep.method}
                </span>
                <span className="text-[11px] font-medium text-slate-500">{ep.desc}</span>
              </div>
              <p className="mt-2 truncate font-mono text-[11px] text-slate-800">{ep.path}</p>
            </div>
          ))}
        </div>

        {/* 6 Plugin Cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PLUGIN_PACKAGES.map((plugin) => (
            <article
              key={plugin.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      {plugin.category}
                    </span>
                    <h2 className="mt-2 text-base font-semibold text-[#18181B]">{plugin.name}</h2>
                    <p className="text-xs text-slate-500">{plugin.software}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-600">{plugin.summary}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plugin.formats.map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded-lg border border-slate-200/80 bg-[#F5F5F7] px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                    >
                      .{fmt.toLowerCase()}
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Instalação em 3 passos
                  </p>
                  <ol className="space-y-1.5 text-[11px] text-slate-600">
                    {plugin.steps.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#EDE5D8] text-[10px] font-bold text-[#18181B]">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="mt-5 pt-2">
                <a
                  href={`/api/acervo/plugins/download/${plugin.id}`}
                  download={plugin.fileName}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#18181B] px-4 text-xs font-semibold text-white transition hover:bg-zinc-800"
                >
                  <span>⬇ Baixar {plugin.fileName}</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
