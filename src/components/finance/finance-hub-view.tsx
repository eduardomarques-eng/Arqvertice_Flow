"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { RealtimeSyncBadge, type RealtimeSyncStatus } from "@/hooks/use-realtime-mutation";
import {
  COMPANY_PIX_CNPJ,
  ProjectFinanceManager,
  isInstallmentOverdue,
  isInstallmentPaid,
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
  basePath?: string;
}

export function FinanceHubView({
  projects,
  installmentsByProject,
  initialProjectId,
  basePath = "/admin",
}: FinanceHubViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || (projects.length > 0 ? projects[0].id : "all")
  );
  const [installmentsMap, setInstallmentsMap] =
    useState<Record<string, Installment[]>>(installmentsByProject);
  const [syncStatus, setSyncStatus] = useState<RealtimeSyncStatus>("idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleProjectInstallmentsChange = useCallback(
    (projectId: string, nextItems: Installment[]) => {
      setInstallmentsMap((prev) => ({ ...prev, [projectId]: nextItems }));
    },
    []
  );

  // Combina todas as parcelas enriquecidas com o nome do projeto
  const allInstallments = useMemo(() => {
    const list: EnrichedInstallment[] = [];
    for (const proj of projects) {
      const items = installmentsMap[proj.id] || [];
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
  }, [projects, installmentsMap]);

  // Parcelas ativas conforme o filtro selecionado
  const activeInstallments = useMemo(() => {
    if (selectedProjectId === "all") return allInstallments;
    return installmentsMap[selectedProjectId] || [];
  }, [selectedProjectId, allInstallments, installmentsMap]);

  // Métricas Consolidadas com Detecção Automática de Atraso
  const metrics = useMemo(() => {
    const target = selectedProjectId === "all" ? allInstallments : activeInstallments;
    const total = target.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const paid = target
      .filter((i) => isInstallmentPaid(i.status))
      .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const overdue = target
      .filter((i) => isInstallmentOverdue(i))
      .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const pending = Math.max(0, total - paid - overdue);

    const pendingItems = target
      .filter((i) => !isInstallmentPaid(i.status))
      .toSorted((a, b) => {
        const timeA = parseDateSafe(a.dueDate)?.getTime() ?? 0;
        const timeB = parseDateSafe(b.dueDate)?.getTime() ?? 0;
        return timeA - timeB;
      });

    const nextPayment = pendingItems[0] || null;
    return { total, paid, pending, overdue, nextPayment };
  }, [selectedProjectId, allInstallments, activeInstallments]);

  // Série Mensal de Fluxo de Caixa (Previsto vs Realizado vs Atrasado)
  const monthlyCashflow = useMemo(() => {
    const target = selectedProjectId === "all" ? allInstallments : activeInstallments;
    const map = new Map<
      string,
      { key: string; label: string; previsto: number; realizado: number; atrasado: number }
    >();

    for (const item of target) {
      const d = parseDateSafe(item.dueDate);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const bucket = map.get(key) || { key, label, previsto: 0, realizado: 0, atrasado: 0 };
      const amt = Number(item.amount) || 0;
      bucket.previsto += amt;
      if (isInstallmentPaid(item.status)) {
        bucket.realizado += amt;
      } else if (isInstallmentOverdue(item)) {
        bucket.atrasado += amt;
      }
      map.set(key, bucket);
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
    const maxVal = Math.max(1, ...sorted.map((s) => s.previsto));
    return { buckets: sorted, maxVal };
  }, [selectedProjectId, allInstallments, activeInstallments]);

  // Baixa rápida com 1 clique diretamente na visão consolidada (Optimistic UI)
  const handleQuickMarkPaid = async (inst: EnrichedInstallment) => {
    const isPaid = isInstallmentPaid(inst.status);
    const nextStatus = isPaid ? "PENDING" : "PAID";
    const nextPaidDate = isPaid ? null : new Date().toISOString();

    const prevMap = installmentsMap;
    setInstallmentsMap((curr) => ({
      ...curr,
      [inst.projectId]: (curr[inst.projectId] || []).map((item) =>
        item.id === inst.id ? { ...item, status: nextStatus, paidDate: nextPaidDate } : item
      ),
    }));
    setSyncStatus("syncing");

    try {
      const res = await fetch(`/api/projects/${inst.projectId}/installments/${inst.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, paidDate: nextPaidDate }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar parcela.");
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2200);
    } catch {
      setInstallmentsMap(prevMap);
      setSyncStatus("error");
    }
  };

  const handleCopyPixConsolidated = async (inst: EnrichedInstallment) => {
    const text = `Cobrança ArqVértice · ${inst.projectName} · ${inst.description} · Valor: ${formatCurrencyBRL(
      inst.amount
    )} · Vencimento: ${formatDateBR(inst.dueDate)} · Pix CNPJ: ${COMPANY_PIX_CNPJ}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(inst.id);
      setTimeout(() => setCopiedId((c) => (c === inst.id ? null : c)), 2200);
    } catch {
      // ignore
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Topo Executivo & Seletor de Empreendimento */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/80 dark:border-white/10 pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-900 dark:bg-[#EDE5D8] dark:text-[#18181B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Módulo Financeiro Central
            </span>
            <RealtimeSyncBadge status={syncStatus} />
          </div>
          <h1 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            💰 Gestão Financeira & Cronograma de Pagamentos
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Controle de fluxo contratual, parcelas, liquidações em 1 clique e cobrança Pix CNPJ ({COMPANY_PIX_CNPJ}).
          </p>
        </div>

        {/* Seletor Superior de Empreendimento */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
          <label
            htmlFor="project-selector"
            className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap"
          >
            Filtrar Empreendimento:
          </label>
          <select
            id="project-selector"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="min-h-[44px] w-full sm:w-auto max-w-full rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

      {/* KPIs & Resumo de Caixa (1 -> 2 -> 4 colunas, tabular-nums truncate) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-zinc-900 p-4 shadow-xs min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
            Total Contratado
          </p>
          <p className="mt-1 text-xl font-extrabold font-mono tabular-nums truncate text-slate-900 dark:text-slate-100">
            {formatCurrencyBRL(metrics.total)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {selectedProjectId === "all" ? `${projects.length} projeto(s)` : "Valor global do contrato"}
          </p>
        </Card>

        <Card className="rounded-2xl border border-emerald-100 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-950/20 p-4 shadow-xs min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 truncate">
            Total Recebido
          </p>
          <p className="mt-1 text-xl font-extrabold font-mono tabular-nums truncate text-emerald-700 dark:text-emerald-400">
            {formatCurrencyBRL(metrics.paid)}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-300/80 truncate">
            {metrics.total > 0
              ? `${Math.round((metrics.paid / metrics.total) * 100)}% liquidado`
              : "0% liquidado"}
          </p>
        </Card>

        <Card className="rounded-2xl border border-blue-100 bg-blue-50/40 dark:border-blue-500/20 dark:bg-blue-950/20 p-4 shadow-xs min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 truncate">
            Saldo a Receber (Em Dia)
          </p>
          <p className="mt-1 text-xl font-extrabold font-mono tabular-nums truncate text-blue-700 dark:text-blue-400">
            {formatCurrencyBRL(metrics.pending)}
          </p>
          <p className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-300/80 truncate">
            {metrics.nextPayment
              ? `Próx: ${formatDateBR(metrics.nextPayment.dueDate)}`
              : "Sem parcelas a vencer"}
          </p>
        </Card>

        <Card
          className={`rounded-2xl border p-4 shadow-xs min-w-0 ${
            metrics.overdue > 0
              ? "border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-950/30"
              : "border-slate-200/80 bg-white dark:border-white/10 dark:bg-zinc-900"
          }`}
        >
          <p
            className={`text-[11px] font-bold uppercase tracking-wider truncate ${
              metrics.overdue > 0 ? "text-rose-800 dark:text-rose-300" : "text-slate-400"
            }`}
          >
            Em Atraso (Automático)
          </p>
          <p
            className={`mt-1 text-xl font-extrabold font-mono tabular-nums truncate ${
              metrics.overdue > 0
                ? "text-rose-700 dark:text-rose-400"
                : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {formatCurrencyBRL(metrics.overdue)}
          </p>
          <p
            className={`mt-0.5 text-[10px] truncate ${
              metrics.overdue > 0
                ? "text-rose-600 dark:text-rose-300 font-semibold"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {metrics.overdue > 0 ? "Vencimento anterior a hoje" : "Nenhum atraso detectado"}
          </p>
        </Card>
      </div>

      {/* Gráfico Fluido de Fluxo de Caixa (Previsto × Realizado × Atrasado) */}
      {monthlyCashflow.buckets.length > 0 && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-zinc-900 p-4 sm:p-5 shadow-xs w-full min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Fluxo de Caixa Mensal (Previsto × Realizado)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Recalculado instantaneamente conforme liquidações e vencimentos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-zinc-600" />
                Previsto
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Recebido
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                Atrasado
              </span>
            </div>
          </div>

          <div className="w-full min-w-0 overflow-hidden">
            <div className="h-56 sm:h-72 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 border-b border-slate-100 dark:border-white/10">
              {monthlyCashflow.buckets.map((b) => {
                const previstoPct = Math.max(6, Math.round((b.previsto / monthlyCashflow.maxVal) * 100));
                const realizadoPct = Math.round((b.realizado / monthlyCashflow.maxVal) * 100);
                const atrasadoPct = Math.round((b.atrasado / monthlyCashflow.maxVal) * 100);
                return (
                  <div key={b.key} className="flex-1 min-w-0 flex flex-col items-center h-full justify-end gap-1.5">
                    <span className="hidden sm:block text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate max-w-full">
                      {formatCurrencyBRL(b.previsto)}
                    </span>
                    <div className="w-full max-w-[52px] h-full flex items-end gap-1 justify-center">
                      <div
                        style={{ height: `${previstoPct}%` }}
                        title={`Previsto: ${formatCurrencyBRL(b.previsto)}`}
                        className="w-1/2 rounded-t-md bg-slate-200 dark:bg-zinc-700 transition-all duration-300"
                      />
                      <div className="w-1/2 h-full flex flex-col justify-end gap-0.5">
                        {atrasadoPct > 0 && (
                          <div
                            style={{ height: `${Math.max(4, atrasadoPct)}%` }}
                            title={`Atrasado: ${formatCurrencyBRL(b.atrasado)}`}
                            className="w-full rounded-t-sm bg-rose-500 transition-all duration-300"
                          />
                        )}
                        <div
                          style={{ height: `${Math.max(realizadoPct > 0 ? 4 : 0, realizadoPct)}%` }}
                          title={`Recebido: ${formatCurrencyBRL(b.realizado)}`}
                          className="w-full rounded-t-md bg-emerald-500 transition-all duration-300"
                        />
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 uppercase">
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Visão de Edição por Empreendimento Selecionado */}
      {selectedProjectId !== "all" && selectedProject && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl bg-slate-900 dark:bg-zinc-900 dark:border dark:border-white/10 px-5 py-3.5 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0">🏢</span>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{selectedProject.name}</p>
                <p className="text-xs text-slate-300 truncate">
                  Cliente: {selectedProject.clientName || "—"}
                </p>
              </div>
            </div>
            <Link
              href={`${basePath}/projetos/${selectedProject.id}`}
              className="inline-flex min-h-[44px] items-center text-xs font-semibold text-blue-300 hover:text-white underline underline-offset-4 shrink-0"
            >
              Abrir Acervo Técnico do Projeto →
            </Link>
          </div>

          <ProjectFinanceManager
            key={selectedProject.id}
            projectId={selectedProject.id}
            initialInstallments={installmentsMap[selectedProject.id] || []}
            stages={selectedProject.stages || []}
            projectBudget={selectedProject.budget}
            onInstallmentsChange={(next) =>
              handleProjectInstallmentsChange(selectedProject.id, next)
            }
          />
        </div>
      )}

      {/* Visão Consolidada de Todos os Projetos (Dual-View Automática) */}
      {selectedProjectId === "all" && (
        <Card className="rounded-3xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-zinc-900 p-4 sm:p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-white/10 pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Quadro Geral Consolidado de Parcelas do Estúdio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualização integrada de todas as parcelas e recebíveis com baixa rápida em 1 clique.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Total: {allInstallments.length} parcela(s)
            </span>
          </div>

          <ResponsiveDataView
            items={allInstallments}
            emptyState={
              <p className="py-12 text-center text-xs text-slate-400">
                Nenhuma parcela cadastrada nos projetos.
              </p>
            }
            renderDesktopTable={() => (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 pl-3 pr-2">Empreendimento</th>
                    <th className="py-3 px-2">Cliente</th>
                    <th className="py-3 px-2">Descrição da Parcela</th>
                    <th className="py-3 px-2">Vencimento</th>
                    <th className="py-3 px-2 text-right">Valor</th>
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {allInstallments.map((inst) => {
                    const isPaid = isInstallmentPaid(inst.status);
                    const isOverdue = isInstallmentOverdue(inst);
                    const isReadyToBill = inst.status === "READY_TO_BILL";

                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition">
                        <td className="py-3 pl-3 pr-2 font-bold text-slate-900 dark:text-slate-100">
                          {inst.projectName}
                        </td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                          {inst.clientName || "—"}
                        </td>
                        <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-200">
                          {inst.description}
                        </td>
                        <td className="py-3 px-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatDateBR(inst.dueDate)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatCurrencyBRL(inst.amount)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge tone={isPaid ? "green" : isOverdue ? "red" : isReadyToBill ? "amber" : "blue"}>
                            {isPaid ? "PAGO" : isOverdue ? "ATRASADO" : isReadyToBill ? "AGENDADO" : "PENDENTE"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleQuickMarkPaid(inst)}
                              className={`min-h-[34px] rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                                isPaid
                                  ? "border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-300"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              }`}
                            >
                              {isPaid ? "Reabrir" : "✓ Pago"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedProjectId(inst.projectId)}
                              className="inline-flex min-h-[34px] items-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-100 active:scale-95 transition"
                            >
                              Gerenciar →
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            renderMobileCard={(inst, idx) => {
              const isPaid = isInstallmentPaid(inst.status);
              const isOverdue = isInstallmentOverdue(inst);
              const isReadyToBill = inst.status === "READY_TO_BILL";
              return (
                <div
                  key={inst.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          #{String(idx + 1).padStart(2, "0")}
                        </span>
                        <Badge tone={isPaid ? "green" : isOverdue ? "red" : isReadyToBill ? "amber" : "blue"}>
                          {isPaid ? "PAGO" : isOverdue ? "ATRASADO" : isReadyToBill ? "AGENDADO" : "PENDENTE"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {inst.projectName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {inst.clientName || "—"} · {inst.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-base font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrencyBRL(inst.amount)}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateBR(inst.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-white/10 pt-3">
                    <button
                      type="button"
                      onClick={() => void handleQuickMarkPaid(inst)}
                      className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-bold transition ${
                        isPaid
                          ? "border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {isPaid ? "Reabrir" : "✓ Confirmar Recebimento"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyPixConsolidated(inst)}
                      className="min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {copiedId === inst.id ? "Pix Copiado ✓" : "Copiar Pix CNPJ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(inst.projectId)}
                      className="col-span-2 min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-800/60 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      Gerenciar Projeto →
                    </button>
                  </div>
                </div>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
}
