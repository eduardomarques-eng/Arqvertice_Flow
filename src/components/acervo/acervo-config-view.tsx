"use client";

import { useState } from "react";
import Link from "next/link";
import { CadBimIntegrationTab } from "@/components/acervo/cad-bim-integration-tab";

export interface AcervoConfigProject {
  id: string;
  name: string;
  clientName?: string;
}

export function AcervoConfigView({
  projects,
  userRole,
}: {
  projects: AcervoConfigProject[];
  userRole: string;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Empreendimento Alvo
          </p>
          <p className="text-xs text-slate-500">
            Selecione o empreendimento para emitir ou revogar chaves de sincronização CAD/BIM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-10 min-w-[240px] rounded-xl border border-slate-200/60 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm focus:border-[#18181B] focus:outline-none"
          >
            {projects.length === 0 ? (
              <option value="">Nenhum empreendimento cadastrado</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.clientName ? `(${p.clientName})` : ""}
                </option>
              ))
            )}
          </select>

          <Link
            href="/admin/acervo"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            ← Voltar ao Acervo
          </Link>
        </div>
      </div>

      {selectedProjectId ? (
        <CadBimIntegrationTab projectId={selectedProjectId} userRole={userRole} />
      ) : (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center text-xs text-slate-500 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          Cadastre ao menos um empreendimento para configurar integrações CAD/BIM.
        </div>
      )}
    </div>
  );
}
