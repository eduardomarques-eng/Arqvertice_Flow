"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientFinancialCard, type ClientData, type InstallmentData } from "@/components/admin/client-financial-card";

type Project = { id: string; name: string; type: string | null; progress: number };

interface ClientDetailManagerProps {
  client: ClientData;
  installments: InstallmentData[];
  projects: Project[];
  hasAccess: boolean;
}

export function ClientDetailManager({
  client,
  installments,
  projects,
  hasAccess,
}: ClientDetailManagerProps) {
  const [error, setError] = useState("");
  const [access, setAccess] = useState<{ email: string; temporaryPassword: string | null } | null>(null);

  async function createAccess() {
    setError("");
    const response = await fetch(`/api/clients/${client.id}/create-access`, { method: "POST" });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Não foi possível criar o acesso.");
      return;
    }
    setAccess(await response.json());
  }

  return (
    <div className="space-y-8 mt-6">
      {/* Barra de Ações Rápidas no Topo */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-3 w-3 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                hasAccess || access ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                hasAccess || access ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span className="text-xs font-bold text-slate-700">
            {hasAccess || access ? "Acesso ao Portal: Ativo" : "Acesso ao Portal: Não Criado"}
          </span>
        </div>

        <button
          type="button"
          onClick={createAccess}
          className="rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100/80 px-4 py-2 text-xs font-bold text-blue-700 transition"
        >
          {hasAccess ? "↺ Redefinir Credenciais de Acesso" : "+ Gerar Acesso do Cliente ao Portal"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">
          {error}
        </div>
      ) : null}

      {access ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-900 shadow-sm">
          <div className="flex items-center justify-between">
            <strong className="text-base font-bold text-emerald-950">
              Acesso ao Portal Liberado com Sucesso!
            </strong>
            <span className="rounded-full bg-emerald-200/80 px-3 py-1 text-xs font-bold text-emerald-900">
              Pronto para envio
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-emerald-800">
            Copie e envie a mensagem abaixo diretamente pelo WhatsApp para o cliente:
          </p>
          <div className="mt-2 rounded-xl bg-white/90 p-4 font-mono text-xs text-slate-800 border border-emerald-200/60 whitespace-pre-line select-all">
            Olá, {client.name}! Seu acesso ao portal ArqVértice está disponível em {typeof window !== "undefined" ? window.location.origin : "https://arqvertice-flow.vercel.app"}/login.
            {"\n"}• E-mail: {access.email}
            {"\n"}• Senha de acesso: {access.temporaryPassword || "sua senha cadastrada"}
            {"\n\n"}Acesse para acompanhar o cronograma e o briefing do seu projeto.
          </div>
        </div>
      ) : null}

      {/* Componente Novo e Reformulado: Dados do Cliente + Controle Interativo de Pagamentos */}
      <ClientFinancialCard
        initialClient={client}
        initialInstallments={installments}
      />

      {/* Projetos Vinculados */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Projetos Ativos</span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">Obras e Contratos Vinculados</h3>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {projects.length} projeto(s) associado(s)
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 hover:border-slate-300 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900 text-base">{project.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{project.type ?? "Residencial Alto Padrão"}</p>
                </div>
                <span className="text-sm font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                  {project.progress}%
                </span>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/operacao?project=${project.id}`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                >
                  Abrir Kanban Operacional →
                </Link>
                <Link
                  href={`/admin/projetos/${project.id}`}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  Detalhes do Projeto
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
