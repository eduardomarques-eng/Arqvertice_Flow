"use client";

import React, { useMemo, useState } from "react";
import {
  BentoBarComparisonChart,
  BentoDonutDistribution,
  BentoHorizontalRanking,
  BentoKpiStrip,
  BentoTrendLineChart,
  type BentoKpiItem,
} from "./index";

export interface ExecutiveBentoProps {
  mode: "admin" | "equipe";
  kpis: {
    contractedRevenue: number;
    activeProjectsCount: number;
    onTimeRatePct: number;
    releasedSheetsCount: number;
    openProposalsCount: number;
    averageTicket: number;
  };
  monthlyRevenueVsExpenses: Array<{
    label: string;
    revenue: number;
    expenses: number;
  }>;
  disciplineDistribution: Array<{
    id: string;
    label: string;
    value: number;
  }>;
  deliveriesAndClientsTrend: Array<{
    label: string;
    deliveries: number;
    clients: number;
  }>;
  projectProgressRanking: Array<{
    id: string;
    name: string;
    clientName: string;
    progressPct: number;
  }>;
}

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

export function ExecutiveBentoDashboard({
  mode,
  kpis,
  monthlyRevenueVsExpenses,
  disciplineDistribution,
  deliveriesAndClientsTrend,
  projectProgressRanking,
}: ExecutiveBentoProps) {
  const [period, setPeriod] = useState<"30d" | "90d" | "all">("all");

  const filteredMonthly = useMemo(() => {
    if (period === "30d") return monthlyRevenueVsExpenses.slice(-2);
    if (period === "90d") return monthlyRevenueVsExpenses.slice(-3);
    return monthlyRevenueVsExpenses;
  }, [monthlyRevenueVsExpenses, period]);

  const filteredTrend = useMemo(() => {
    if (period === "30d") return deliveriesAndClientsTrend.slice(-2);
    if (period === "90d") return deliveriesAndClientsTrend.slice(-4);
    return deliveriesAndClientsTrend;
  }, [deliveriesAndClientsTrend, period]);

  const kpiItems: BentoKpiItem[] = [
    {
      id: "rev",
      label: mode === "admin" ? "Receita Contratada" : "Etapas Atribuídas",
      value: mode === "admin" ? fmtMoney(kpis.contractedRevenue) : `${kpis.activeProjectsCount} obras`,
      delta: "+12,4%",
      deltaTone: "positive",
      featured: true,
    },
    {
      id: "proj",
      label: "Projetos Ativos",
      value: String(kpis.activeProjectsCount),
      subtitle: "Em andamento / planejamento",
    },
    {
      id: "ontime",
      label: "Entregas no Prazo",
      value: `${kpis.onTimeRatePct}%`,
      delta: kpis.onTimeRatePct >= 85 ? "No alvo" : "Atenção",
      deltaTone: kpis.onTimeRatePct >= 85 ? "positive" : "negative",
    },
    {
      id: "cde",
      label: "Pranchas Liberadas",
      value: String(kpis.releasedSheetsCount),
      subtitle: "Acervo CDE Bom p/ Obra",
    },
    {
      id: "prop",
      label: mode === "admin" ? "Propostas em Aberto" : "Marcos 7 dias",
      value: String(kpis.openProposalsCount),
      subtitle: mode === "admin" ? "Pipeline comercial" : "Vencimentos próximos",
    },
    {
      id: "ticket",
      label: mode === "admin" ? "Ticket Médio" : "Conclusão Média",
      value:
        mode === "admin"
          ? fmtMoney(kpis.averageTicket)
          : `${kpis.onTimeRatePct}%`,
      subtitle: mode === "admin" ? "Por empreendimento" : "Avanço físico geral",
    },
  ];

  return (
    <section className="space-y-4 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Analytics Bento Grid · Linear / Claude
          </span>
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {mode === "admin"
              ? "Visão Executiva & Performance do Estúdio"
              : "Painel Operacional da Equipe Técnica"}
          </h2>
        </div>

        {/* Filtro instantâneo de período */}
        <div className="inline-flex rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-1 gap-1">
          {[
            { id: "30d" as const, label: "30 dias" },
            { id: "90d" as const, label: "90 dias" },
            { id: "all" as const, label: "Tudo" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold transition ${
                period === opt.id
                  ? "bg-[#18181B] text-white dark:bg-[#EDE5D8] dark:text-[#18181B]"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Faixa de 6 KPIs */}
      <BentoKpiStrip items={kpiItems} columns={6} />

      {/* 4 Gráficos Integrados em Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BentoBarComparisonChart
          title={
            mode === "admin"
              ? "Faturamento × Despesas por Mês"
              : "Etapas Planejadas × Concluídas por Mês"
          }
          subtitle="Comparativo mensal com escala tabular"
          primaryLabel={mode === "admin" ? "Faturamento" : "Planejado"}
          secondaryLabel={mode === "admin" ? "Despesas" : "Concluído"}
          data={filteredMonthly.map((m) => ({
            label: m.label,
            primaryValue: m.revenue,
            secondaryValue: m.expenses,
            primaryFormatted: mode === "admin" ? fmtMoney(m.revenue) : String(m.revenue),
            secondaryFormatted: mode === "admin" ? fmtMoney(m.expenses) : String(m.expenses),
          }))}
        />

        <BentoDonutDistribution
          title="Distribuição por Tipologia / Disciplina"
          subtitle="Arquitetura, Interiores, Fachadas/BIM e Estrutural"
          centerLabel="Total"
          centerValue={String(
            disciplineDistribution.reduce((acc, d) => acc + d.value, 0)
          )}
          slices={disciplineDistribution.map((d) => ({
            id: d.id,
            label: d.label,
            value: d.value,
            formattedValue: String(d.value),
          }))}
        />

        <BentoTrendLineChart
          title="Evolução de Entregas & Novos Clientes"
          subtitle="Curva contínua de produtividade e expansão"
          primaryLabel="Entregas"
          secondaryLabel="Clientes"
          points={filteredTrend.map((t) => ({
            label: t.label,
            primary: t.deliveries,
            secondary: t.clients,
            primaryFormatted: String(t.deliveries),
          }))}
        />

        <BentoHorizontalRanking
          title="Avanço por Empreendimento Ativo"
          subtitle="Progresso físico ponderado das etapas"
          maxScale={100}
          items={projectProgressRanking.map((p, idx) => ({
            id: p.id,
            label: p.name,
            secondaryText: p.clientName,
            value: p.progressPct,
            formattedValue: `${p.progressPct}%`,
            highlight: idx === 0,
          }))}
        />
      </div>
    </section>
  );
}
