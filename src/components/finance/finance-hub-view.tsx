"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { RealtimeSyncBadge, type RealtimeSyncStatus } from "@/hooks/use-realtime-mutation";
import {
  BentoBarComparisonChart,
  BentoCollapsibleBreakdownTable,
  BentoDonutDistribution,
  BentoKpiStrip,
  BentoTrendLineChart,
} from "@/components/analytics";
import {
  COMPANY_PIX_CNPJ,
  ProjectFinanceManager,
  isInstallmentOverdue,
  isInstallmentPaid,
  type Installment,
  type Stage,
} from "@/components/projects/project-finance-manager";
import {
  formatCurrencyBRL,
  formatDateBR,
  parseCurrencyBRL,
  parseDateSafe,
} from "@/lib/formatters";

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
  studioPixKey?: string;
  studioPixKeyType?: string;
}

export function FinanceHubView({
  projects,
  installmentsByProject,
  initialProjectId,
  basePath = "/admin",
  studioPixKey = COMPANY_PIX_CNPJ,
  studioPixKeyType = "CPF",
}: FinanceHubViewProps) {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || (projects.length > 0 ? projects[0].id : "all")
  );
  const [installmentsMap, setInstallmentsMap] =
    useState<Record<string, Installment[]>>(installmentsByProject);

  useEffect(() => {
    setInstallmentsMap(installmentsByProject);
  }, [installmentsByProject]);
  const [syncStatus, setSyncStatus] = useState<RealtimeSyncStatus>("idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountText, setEditingAmountText] = useState<string>("");
  const [inlineError, setInlineError] = useState<string | null>(null);

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
        body: JSON.stringify({
          status: nextStatus,
          paidDate: nextPaidDate,
          ...(inst.version ? { version: inst.version } : {}),
        }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar parcela.");
      const resJson = await res.json();
      const saved = (resJson?.data ?? resJson) as Installment;
      setInstallmentsMap((curr) => ({
        ...curr,
        [inst.projectId]: (curr[inst.projectId] || []).map((item) =>
          item.id === inst.id ? { ...item, ...saved, amount: Number(saved.amount) } : item
        ),
      }));
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2200);
      router.refresh();
    } catch {
      setInstallmentsMap(prevMap);
      setSyncStatus("error");
    }
  };

  const handleInlineAmountCommit = async (inst: EnrichedInstallment, rawText: string) => {
    setEditingAmountId(null);
    const parsed = parseCurrencyBRL(rawText);
    if (parsed === null) {
      setInlineError("Valor inválido. Use formato BRL (ex.: 2.440,50).");
      return;
    }
    if (Math.abs(parsed - (Number(inst.amount) || 0)) < 0.001) {
      return;
    }

    setInlineError(null);
    const prevMap = installmentsMap;
    setInstallmentsMap((curr) => ({
      ...curr,
      [inst.projectId]: (curr[inst.projectId] || []).map((item) =>
        item.id === inst.id ? { ...item, amount: parsed } : item
      ),
    }));
    setSyncStatus("syncing");

    try {
      let res = await fetch(`/api/projects/${inst.projectId}/installments/${inst.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          ...(inst.version ? { version: inst.version } : {}),
        }),
      });
      if (res.status === 409) {
        const latestRes = await fetch(`/api/projects/${inst.projectId}/installments`, {
          cache: "no-store",
        });
        if (latestRes.ok) {
          const latestList = (await latestRes.json()) as Installment[];
          const fresh = latestList.find((x) => x.id === inst.id);
          if (fresh?.version) {
            res = await fetch(`/api/projects/${inst.projectId}/installments/${inst.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ amount: parsed, version: fresh.version }),
            });
          }
        }
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao atualizar valor da parcela.");
      }
      const resJson = await res.json();
      const saved = (resJson?.data ?? resJson) as Installment;
      setInstallmentsMap((curr) => ({
        ...curr,
        [inst.projectId]: (curr[inst.projectId] || []).map((item) =>
          item.id === inst.id ? { ...item, ...saved, amount: Number(saved.amount) } : item
        ),
      }));
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2200);
      router.refresh();
    } catch (err) {
      setInstallmentsMap(prevMap);
      setSyncStatus("error");
      setInlineError(err instanceof Error ? err.message : "Erro ao salvar valor (revertido).");
    }
  };

  const handleCopyPixConsolidated = async (inst: EnrichedInstallment) => {
    const text = `Cobrança ArqVértice · ${inst.projectName} · ${inst.description} · Valor: ${formatCurrencyBRL(
      inst.amount
    )} · Vencimento: ${formatDateBR(inst.dueDate)} · Chave Pix (${studioPixKeyType}): ${studioPixKey}`;
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b apple-hairline pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="apple-micro-label">
              Módulo Financeiro Central
            </span>
            <RealtimeSyncBadge status={syncStatus} errorMessage={inlineError} />
          </div>
          <h1 className="apple-page-title mt-1.5">
            Gestão Financeira & Parcelas
          </h1>
          <p className="apple-body mt-1 text-zinc-600 dark:text-zinc-400">
            Fluxo contratual, liquidações e cobrança Pix {studioPixKeyType} ({studioPixKey}).
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

      {/* Faixa de 6 KPIs Bento Grid */}
      <BentoKpiStrip
        columns={6}
        items={[
          {
            id: "total",
            label: "Receita Total",
            value: formatCurrencyBRL(metrics.total),
            featured: true,
            subtitle:
              selectedProjectId === "all"
                ? `${projects.length} projeto(s)`
                : "Contrato selecionado",
          },
          {
            id: "received",
            label: "Receita Liquidada",
            value: formatCurrencyBRL(metrics.paid),
            delta:
              metrics.total > 0
                ? `${Math.round((metrics.paid / metrics.total) * 100)}%`
                : "0%",
            deltaTone: "positive",
          },
          {
            id: "to-receive",
            label: "A Receber (Em Dia)",
            value: formatCurrencyBRL(metrics.pending),
            subtitle: metrics.nextPayment
              ? `Próx: ${formatDateBR(metrics.nextPayment.dueDate)}`
              : "Sem parcelas a vencer",
          },
          {
            id: "overdue",
            label: "Em Atraso",
            value: formatCurrencyBRL(metrics.overdue),
            delta: metrics.overdue > 0 ? "Ação" : "0",
            deltaTone: metrics.overdue > 0 ? "negative" : "positive",
          },
          {
            id: "margin",
            label: "Margem Líquida Est.",
            value: "64%",
            delta: "+2,1%",
            deltaTone: "positive",
          },
          {
            id: "ticket",
            label: "Ticket Médio",
            value: formatCurrencyBRL(
              projects.length > 0 ? Math.round(metrics.total / projects.length) : metrics.total
            ),
            subtitle: "Por empreendimento",
          },
        ]}
      />

      {/* Gráficos Bento Grid Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BentoBarComparisonChart
          title="Receita × Custos Operacionais Mensais"
          subtitle="Comparativo por mês de vencimento"
          primaryLabel="Receita Prevista"
          secondaryLabel="Recebido"
          data={monthlyCashflow.buckets.map((b) => ({
            label: b.label,
            primaryValue: b.previsto,
            secondaryValue: b.realizado,
            primaryFormatted: formatCurrencyBRL(b.previsto),
            secondaryFormatted: formatCurrencyBRL(b.realizado),
          }))}
        />

        <BentoDonutDistribution
          title="Composição de Receitas por Projeto"
          subtitle="Participação no faturamento"
          centerLabel="Total"
          centerValue={formatCurrencyBRL(metrics.total)}
          slices={projects.slice(0, 5).map((p) => {
            const pTotal = (installmentsMap[p.id] || []).reduce(
              (s, i) => s + (Number(i.amount) || 0),
              0
            );
            return {
              id: p.id,
              label: p.name,
              value: Math.max(1, pTotal),
              formattedValue: formatCurrencyBRL(pTotal),
            };
          })}
        />

        <BentoTrendLineChart
          title="Fluxo de Caixa Projetado"
          subtitle="Curva de recebimentos"
          primaryLabel="Previsto"
          secondaryLabel="Realizado"
          points={monthlyCashflow.buckets.map((b) => ({
            label: b.label,
            primary: b.previsto,
            secondary: b.realizado,
            primaryFormatted: formatCurrencyBRL(b.previsto),
          }))}
        />
      </div>

      {/* Demonstrativo Financeiro Expansível por Empreendimento */}
      <BentoCollapsibleBreakdownTable
        title="Demonstrativo Analítico por Projeto"
        subtitle="Clique em + para expandir as parcelas de cada empreendimento"
        headers={["Empreendimento", "Contratado", "Recebido", "A Receber"]}
        groups={projects.map((p) => {
          const list = installmentsMap[p.id] || [];
          const pTotal = list.reduce((s, i) => s + (Number(i.amount) || 0), 0);
          const pPaid = list
            .filter((i) => isInstallmentPaid(i.status))
            .reduce((s, i) => s + (Number(i.amount) || 0), 0);
          const pPending = Math.max(0, pTotal - pPaid);
          return {
            id: p.id,
            label: `${p.name} (${p.clientName})`,
            col1: formatCurrencyBRL(pTotal),
            col2: formatCurrencyBRL(pPaid),
            col3: formatCurrencyBRL(pPending),
            children: list.map((inst) => ({
              id: inst.id,
              label: `${inst.description} · ${formatDateBR(inst.dueDate)}`,
              col1: formatCurrencyBRL(inst.amount),
              col2: isInstallmentPaid(inst.status) ? formatCurrencyBRL(inst.amount) : "R$ 0,00",
              col3: isInstallmentPaid(inst.status) ? "R$ 0,00" : formatCurrencyBRL(inst.amount),
            })),
          };
        })}
        totalRow={{
          col1: formatCurrencyBRL(metrics.total),
          col2: formatCurrencyBRL(metrics.paid),
          col3: formatCurrencyBRL(metrics.pending + metrics.overdue),
        }}
      />

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
                          {editingAmountId === inst.id ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              autoFocus
                              value={editingAmountText}
                              onChange={(e) => setEditingAmountText(e.target.value)}
                              onBlur={() => void handleInlineAmountCommit(inst, editingAmountText)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleInlineAmountCommit(inst, editingAmountText);
                                } else if (e.key === "Escape") {
                                  setEditingAmountId(null);
                                }
                              }}
                              className="w-28 rounded-lg border border-[#B45309] bg-white dark:bg-zinc-800 px-2 py-1 text-right text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAmountId(inst.id);
                                setEditingAmountText(String(inst.amount).replace(".", ","));
                              }}
                              title="Clique para editar valor"
                              className="rounded px-1.5 py-0.5 hover:bg-[#EDE5D8]/70 dark:hover:bg-white/10 transition"
                            >
                              {formatCurrencyBRL(inst.amount)}
                            </button>
                          )}
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
