"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EapCostReportPayload } from "@/server/eap/eap-cost-report";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtCompactBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return fmtBRL(v);
}

const CHART_PALETTE = [
  "#0f172a",
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#6d28d9",
  "#be123c",
  "#0e7490",
];

export function EapCostReportView({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<EapCostReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/cost-report`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Não foi possível carregar o Relatório de Custos da EAP.");
        return;
      }
      setReport(json.report as EapCostReportPayload);
    } catch {
      setError("Erro de conexão ao carregar o Relatório de Custos da EAP.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  async function handleDownloadPdf() {
    setExportingPdf(true);
    setError(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/cost-report/pdf`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Erro ao exportar PDF de Custos da EAP.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const slug = (report?.meta.projectName || "obra")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      link.download = `EAP-Custos-${slug || "obra"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return (
      <Card className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
        Calculando indicadores e composição de custos da Planilha EAP...
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
        {error || "Nenhum dado de custos disponível."}
      </Card>
    );
  }

  const k = report.kpis;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Corporativo */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Relatório de Custos da Planilha EAP</Badge>
              <Badge tone="neutral">
                Revisão R{String(report.meta.revision).padStart(2, "0")}
              </Badge>
              {report.meta.isParametricFallback && (
                <Badge tone="amber">Estimativa Paramétrica (EAP sem itens orçados)</Badge>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
              {report.meta.projectName}
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Cliente: <strong className="text-slate-900 dark:text-zinc-200">{report.meta.clientName}</strong>{" "}
              · Praça: {report.meta.cityLabel} · Área Construída:{" "}
              <span className="font-mono font-semibold tabular-nums">{report.meta.builtAreaM2} m²</span>{" "}
              · BDI: <span className="font-mono font-semibold tabular-nums">{report.meta.bdiPercent}%</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadReport()}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              ↻ Atualizar Custos
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={exportingPdf}
              className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {exportingPdf ? "Gerando PDF..." : "📄 Exportar Relatório EAP PDF"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}
      </Card>

      {/* KPIs de Custo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total Geral (c/ BDI)
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {fmtBRL(k.totalCommercialPrice)}
          </p>
          <p className="mt-1 font-mono text-xs text-emerald-700 dark:text-emerald-400">
            {fmtBRL(k.costPerM2)} / m²
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Custo Direto + BDI ({k.bdiPercent}%)
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {fmtBRL(k.totalDirectCost)}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-600 dark:text-zinc-400">
            BDI: {fmtBRL(k.bdiValue)} ({fmtBRL(k.directCostPerM2)}/m²)
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Materiais ({k.materialSharePercent.toFixed(1)}%)
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {fmtBRL(k.totalMaterialCost)}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-600 dark:text-zinc-400">
            Terceiros ({k.thirdPartySharePercent.toFixed(1)}%): {fmtBRL(k.totalThirdPartyCost)}
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Mão de Obra ({k.laborSharePercent.toFixed(1)}%)
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {fmtBRL(k.totalLaborCost)}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            <span className="font-mono font-semibold">{k.totalItemsCount}</span> serviços na planilha ·{" "}
            <span className="font-mono font-semibold">{report.teams.length}</span> equipes
          </p>
        </Card>
      </div>

      {/* Quantidades-Chave de Engenharia */}
      <Card className="rounded-2xl border border-slate-200/90 bg-slate-50/70 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
            Quantidades-Chave Extraídas:
          </span>
          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-slate-800 dark:text-zinc-200">
            <span>Concreto: <strong>{k.concreteM3.toFixed(1)} m³</strong></span>
            <span>Aço: <strong>{k.steelKg.toFixed(0)} kg</strong></span>
            <span>Alvenaria: <strong>{k.masonryM2.toFixed(1)} m²</strong></span>
            <span>Pisos &amp; Revest.: <strong>{k.ceramicTileM2.toFixed(1)} m²</strong></span>
            <span>Coberta: <strong>{k.roofM2.toFixed(1)} m²</strong></span>
          </div>
        </div>
      </Card>

      {/* Gráficos: Custos por Pavimento & Disciplina */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Composição de Custos por Pavimento / Zona
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Distribuição proporcional pelas quantidades alocadas em Infraestrutura, Térreo, Superior, Coberta e Externa.
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byFloor} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickFormatter={fmtCompactBRL} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => fmtBRL(Number(value ?? 0))} />
                <Bar dataKey="commercialPrice" name="Total c/ BDI" radius={[0, 6, 6, 0]}>
                  {report.byFloor.map((_, idx) => (
                    <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Custos por Disciplina Técnica
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Agrupamento por especialidade de engenharia e arquitetura (c/ BDI).
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byDiscipline} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tickFormatter={fmtCompactBRL} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="discipline" width={155} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => fmtBRL(Number(value ?? 0))} />
                <Bar dataKey="commercialPrice" name="Total c/ BDI" fill="#1d4ed8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabelas: Fases Construtivas & Pavimentos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Consolidado por Fase Construtiva (Fases 1–6)
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Fase</th>
                  <th className="px-3 py-2 text-right">Custo Direto</th>
                  <th className="px-3 py-2 text-right">Total c/ BDI</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {report.byPhase.map((p) => (
                  <tr key={p.phaseCode} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2 font-medium">{p.phaseName}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtBRL(p.directCost)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{fmtBRL(p.commercialPrice)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{p.sharePercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Detalhamento por Pavimento / Zona
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Pavimento</th>
                  <th className="px-3 py-2 text-right">Material</th>
                  <th className="px-3 py-2 text-right">Mão de Obra</th>
                  <th className="px-3 py-2 text-right">Total c/ BDI</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {report.byFloor.map((f) => (
                  <tr key={f.code} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2 font-medium">{f.label}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtBRL(f.materialCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtBRL(f.laborCost)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{fmtBRL(f.commercialPrice)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{f.sharePercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Etapas Analíticas */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
        <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
          Composição de Custos por Etapa da Planilha EAP
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Disciplina</th>
                <th className="px-3 py-2 text-right">Material</th>
                <th className="px-3 py-2 text-right">Mão de Obra</th>
                <th className="px-3 py-2 text-right">Terceiros</th>
                <th className="px-3 py-2 text-right">Total c/ BDI</th>
                <th className="px-3 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {report.stages
                .filter((s) => s.commercialPrice > 0)
                .map((s) => (
                  <tr key={s.code} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2 font-medium">
                      <span className="font-mono text-[11px] text-slate-500">{s.code}</span> — {s.name}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">{s.discipline}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtBRL(s.materialCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtBRL(s.laborCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtBRL(s.thirdPartyCost)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{fmtBRL(s.commercialPrice)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{s.sharePercent.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Curva ABC */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Curva ABC de Custos (Top 30 Insumos &amp; Serviços)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Priorização Pareto dos itens de maior impacto financeiro no orçamento da EAP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <Badge tone="green">
              Classe A: {report.abcCurve.summaryByClass.A.count} itens ({report.abcCurve.summaryByClass.A.sharePercent.toFixed(1)}%)
            </Badge>
            <Badge tone="amber">
              Classe B: {report.abcCurve.summaryByClass.B.count} itens ({report.abcCurve.summaryByClass.B.sharePercent.toFixed(1)}%)
            </Badge>
            <Badge tone="neutral">
              Classe C: {report.abcCurve.summaryByClass.C.count} itens ({report.abcCurve.summaryByClass.C.sharePercent.toFixed(1)}%)
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Classe</th>
                <th className="px-3 py-2">Etapa · Descrição</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Total c/ BDI</th>
                <th className="px-3 py-2 text-right">% Part.</th>
                <th className="px-3 py-2 text-right">% Acum.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {report.abcCurve.items.map((item) => (
                <tr key={`${item.rank}-${item.code}`} className="text-slate-800 dark:text-zinc-200">
                  <td className="px-3 py-2">
                    <Badge
                      tone={
                        item.abcClass === "A"
                          ? "green"
                          : item.abcClass === "B"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {item.abcClass}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <span className="font-mono text-[10px] text-slate-500">{item.stageCode}</span> ·{" "}
                    {item.description}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                    {fmtBRL(item.totalCommercialPrice)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {item.sharePercent.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {item.cumulativePercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Equipes de Mão de Obra */}
      {report.teams.length > 0 && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Equipes Cadastradas &amp; Custo Diário Estimado de Mão de Obra
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.teams.map((t) => (
              <div
                key={t.teamCode}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                    Equipe {t.teamCode} — {t.name}
                  </span>
                  <Badge tone="neutral">{t.headcount} prof.</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-400">{t.rolesSummary}</p>
                <p className="mt-2 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                  Diária est.: {fmtBRL(t.dailyCostEstimate)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
