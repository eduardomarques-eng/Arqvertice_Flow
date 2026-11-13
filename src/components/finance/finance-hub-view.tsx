"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ProjectFinanceManager,
  type Installment,
  type Stage,
} from "@/components/projects/project-finance-manager";
import { formatCurrencyBRL, formatDateBR, parseDateSafe } from "@/lib/formatters";

export interface ProjectOption {
  id: string;
  name: string;
  clientName: string;
  budget: number | null;
  stages: Stage[];
}

export interface EnrichedInstallment extends Installment {
  projectId: string;
  projectName: string;
  clientName: string;
}

interface FinanceHubViewProps {
  projects: ProjectOption[];
  installmentsByProject: Record<string, Installment[]>;
  initialProjectId?: string;
}

export function FinanceHubView({
  projects,
  installmentsByProject,
  initialProjectId,
}: FinanceHubViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || (projects.length > 0 ? projects[0].id : "all")
  );

  // Combina todas as parcelas enriquecidas com o nome do projeto
  const allInstallments = useMemo(() => {
    const list: EnrichedInstallment[] = [];
    for (const proj of projects) {
      const items = installmentsByProject[proj.id] || [];
      for (const item of items) {
        list.push({
          ...item,
          projectId: proj.id,
          projectName: proj.name,
          clientName: proj.clientName,
        });
      }
    }
    return list;
  }, [projects, installmentsByProject]);

  // Parcelas ativas conforme o filtro selecionado
  const activeInstallments = useMemo(() => {
    if (selectedProjectId === "all") return allInstallments;
    return installmentsByProject[selectedProjectId] || [];
  }, [selectedProjectId, allInstallments, installmentsByProject]);

  // Métricas Consolidadas
  const metrics = useMemo(() => {
    const target = selectedProjectId === "all" ? allInstallments : activeInstallments;
    const total = target.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const paid = target
      .filter((i) => i.status === "PAID" || i.status === "Liquidado")
      .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const pending = target
      .filter((i) => i.status === "PENDING" || i.status === "Pendente")
      .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const overdue = target
      .filter((i) => i.status === "OVERDUE" || i.status === "Atrasado")
      .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);

    const pendingItems = target
      .filter((i) => i.status === "PENDING" || i.status === "Pendente")
      .toSorted((a, b) => {
        const timeA = parseDateSafe(a.dueDate)?.getTime() ?? 0;
        const timeB = parseDateSafe(b.dueDate)?.getTime() ?? 0;
        return timeA - timeB;
      });

    const nextPayment = pendingItems[0] || null;

    return { total, paid, pending, overdue, nextPayment };
  }, [selectedProjectId, allInstallments, activeInstallments]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      {/* Topo Executivo & Seletor de Empreendimento */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Módulo Financeiro Central
          </span>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            💰 Gestão Financeira & Cronograma de Pagamentos
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Controle de fluxo contratual, parcelas, liquidações e emissão de cobranças por empreendimento.
          </p>
        </div>

        {/* Seletor Superior de Empreendimento */}
        <div className="flex items-center gap-2">
          <label htmlFor="project-selector" className="text-xs font-bold text-slate-600 whitespace-nowrap">
            Filtrar Empreendimento:
          </label>
          <select
            id="project-selector"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">⭐ Todos os Projetos (Visão Consolidada)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.clientName ? `(${p.clientName})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Contratado</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{formatCurrencyBRL(metrics.total)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {selectedProjectId === "all" ? `${projects.length} projeto(s)` : "Valor global do contrato"}
          </p>
        </Card>

        <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Total Recebido</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatCurrencyBRL(metrics.paid)}</p>
          <p className="mt-0.5 text-[10px] text-emerald-600">
            {metrics.total > 0
              ? `${Math.round((metrics.paid / metrics.total) * 100)}% liquidado`
              : "0% liquidado"}
          </p>
        </Card>

        <Card className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Saldo a Receber</p>
          <p className="mt-1 text-xl font-extrabold text-blue-700">{formatCurrencyBRL(metrics.pending)}</p>
          <p className="mt-0.5 text-[10px] text-blue-600">
            {metrics.nextPayment
              ? `Próx: ${formatDateBR(metrics.nextPayment.dueDate)}`
              : "Sem parcelas a vencer"}
          </p>
        </Card>

        <Card className={`rounded-2xl border p-4 shadow-xs ${
          metrics.overdue > 0 ? "border-rose-200 bg-rose-50/60" : "border-slate-200/80 bg-white"
        }`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${
            metrics.overdue > 0 ? "text-rose-800" : "text-slate-400"
          }`}>
            Atrasado / Pendente Crítico
          </p>
          <p className={`mt-1 text-xl font-extrabold ${
            metrics.overdue > 0 ? "text-rose-700" : "text-slate-900"
          }`}>
            {formatCurrencyBRL(metrics.overdue)}
          </p>
          <p className={`mt-0.5 text-[10px] ${
            metrics.overdue > 0 ? "text-rose-600 font-semibold" : "text-slate-500"
          }`}>
            {metrics.overdue > 0 ? "Requer cobrança imediata" : "Nenhum atraso"}
          </p>
        </Card>
      </div>

      {/* Visão de Edição por Empreendimento Selecionado */}
      {selectedProjectId !== "all" && selectedProject && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="text-xl">🏢</span>
              <div>
                <p className="text-sm font-bold">{selectedProject.name}</p>
                <p className="text-xs text-slate-300">Cliente: {selectedProject.clientName || "—"}</p>
              </div>
            </div>
            <Link
              href={`/admin/projetos/${selectedProject.id}`}
              className="text-xs font-semibold text-blue-300 hover:text-white underline underline-offset-4"
            >
              Abrir Acervo Técnico do Projeto →
            </Link>
          </div>

          <ProjectFinanceManager
            key={selectedProject.id}
            projectId={selectedProject.id}
            initialInstallments={installmentsByProject[selectedProject.id] || []}
            stages={selectedProject.stages || []}
          />
        </div>
      )}

      {/* Visão Consolidada de Todos os Projetos */}
      {selectedProjectId === "all" && (
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Quadro Geral Consolidado de Parcelas do Estúdio
              </h3>
              <p className="text-xs text-slate-500">
                Visualização integrada de todas as parcelas e recebíveis de todos os projetos ativos.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600">
              Total: {allInstallments.length} parcela(s)
            </span>
          </div>

          {allInstallments.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">
              Nenhuma parcela cadastrada nos projetos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 pl-3 pr-2">Empreendimento</th>
                    <th className="py-3 px-2">Cliente</th>
                    <th className="py-3 px-2">Descrição da Parcela</th>
                    <th className="py-3 px-2">Vencimento</th>
                    <th className="py-3 px-2 text-right">Valor</th>
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 pr-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allInstallments.map((inst) => {
                    const isPaid = inst.status === "PAID" || inst.status === "Liquidado";
                    const isOverdue = inst.status === "OVERDUE" || inst.status === "Atrasado";

                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 pl-3 pr-2 font-bold text-slate-900">
                          {inst.projectName}
                        </td>
                        <td className="py-3 px-2 text-slate-600">{inst.clientName || "—"}</td>
                        <td className="py-3 px-2 font-medium text-slate-800">{inst.description}</td>
                        <td className="py-3 px-2 font-mono text-[11px] text-slate-600">
                          {formatDateBR(inst.dueDate)}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-slate-900">
                          {formatCurrencyBRL(inst.amount)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge tone={isPaid ? "green" : isOverdue ? "red" : "blue"}>
                            {isPaid ? "Liquidado" : isOverdue ? "Atrasado" : "Pendente"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedProjectId(inst.projectId)}
                            className="inline-flex min-h-[32px] items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-100 active:scale-95 transition"
                          >
                            Gerenciar Projeto →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

