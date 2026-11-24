"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ExecutiveReportPayload,
  ReportAudience,
} from "@/server/eap/executive-report";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function EapExecutiveReportView({
  projectId,
  isAdmin = false,
  initialAudience = "CLIENT",
  onPublished,
}: {
  projectId: string;
  isAdmin?: boolean;
  initialAudience?: ReportAudience;
  onPublished?: () => void;
}) {
  const [audience, setAudience] = useState<ReportAudience>(
    isAdmin ? initialAudience : "CLIENT"
  );
  const [report, setReport] = useState<ExecutiveReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const loadReport = useCallback(async (aud: ReportAudience) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/eap/projects/${projectId}/report?audience=${aud}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Não foi possível carregar o relatório executivo.");
        setReport(null);
        return;
      }
      setReport(json.report as ExecutiveReportPayload);
    } catch {
      setError("Erro de conexão ao buscar relatório executivo.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadReport(audience);
  }, [audience, loadReport]);

  async function handlePublishToClient() {
    setPublishing(true);
    setPublishFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/report/publish`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setPublishFeedback("Relatório Executivo publicado no Portal do Cliente!");
        await loadReport(audience);
        onPublished?.();
      } else {
        setPublishFeedback(json.error || "Falha ao publicar relatório.");
      }
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
        Montando Relatório Executivo EAP...
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 text-center text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        {error || "Relatório indisponível."}
      </Card>
    );
  }

  const activeStages = report.stages.filter((s) => s.totalCommercialPrice > 0 || s.itemsCount > 0);
  const topStagesChart = [...activeStages]
    .sort((a, b) => b.totalCommercialPrice - a.totalCommercialPrice)
    .slice(0, 10)
    .map((s) => ({
      name: `${s.code} ${s.name.slice(0, 22)}`,
      valor: s.totalCommercialPrice,
      peso: s.weightPercent,
    }));

  const abcChartData = report.abcCurve.items.slice(0, 12).map((i) => ({
    name: i.description.slice(0, 18),
    valor: i.totalCommercialPrice,
    acumulado: i.cumulativePercent,
    classe: i.abcClass,
  }));

  const pdfHref = `/api/eap/projects/${projectId}/report/pdf?audience=${audience}`;

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 overflow-y-auto bg-[#F5F5F7] p-6 dark:bg-[#09090B]"
          : "space-y-6"
      }
    >
      <div className={isFullscreen ? "mx-auto max-w-7xl space-y-6" : "space-y-6"}>
        {/* Barra de Controle Superior (oculta na impressão) */}
        <Card className="print:hidden rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{report.meta.baselineLabel}</Badge>
              <Badge tone={report.meta.isPublishedToClient ? "green" : "amber"}>
                {report.meta.isPublishedToClient
                  ? "Publicado no Portal do Cliente"
                  : "Rascunho Interno"}
              </Badge>
              {isAdmin && (
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setAudience("CLIENT")}
                    className={`rounded-lg px-3 py-1 text-[11px] font-semibold cursor-pointer ${
                      audience === "CLIENT"
                        ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                        : "text-slate-600 dark:text-zinc-300"
                    }`}
                  >
                    Modo Apresentação Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudience("INTERNAL")}
                    className={`rounded-lg px-3 py-1 text-[11px] font-semibold cursor-pointer ${
                      audience === "INTERNAL"
                        ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                        : "text-slate-600 dark:text-zinc-300"
                    }`}
                  >
                    Modo Detalhado Escritório
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handlePublishToClient}
                  disabled={publishing}
                  className="h-9 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  {publishing ? "Publicando..." : "Publicar no Portal do Cliente"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                className="h-9 rounded-xl border border-slate-300 px-3.5 text-xs font-semibold text-slate-800 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
              >
                {isFullscreen ? "✕ Sair Tela Cheia" : "⛶ Modo Tela Cheia (Reunião)"}
              </button>
              <a
                href={pdfHref}
                className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-zinc-950"
              >
                ↓ Exportar PDF Executivo
              </a>
            </div>
          </div>

          {publishFeedback && (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              {publishFeedback}
            </p>
          )}
        </Card>

        {/* BLOCO 1 — HERO EXECUTIVO & KPIs */}
        <Card className="rounded-3xl border border-slate-200/90 bg-slate-950 p-6 text-white dark:border-zinc-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">
                ArqVértice Studio · Dossiê Executivo de Obra
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">{report.meta.projectName}</h2>
              <p className="mt-1 text-xs text-slate-300">
                Cliente: {report.meta.clientName} · Praça: {report.meta.cityLabel} · Área:{" "}
                {report.meta.builtAreaM2} m² · {report.meta.baselineLabel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                Investimento Previsto
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums text-amber-300">
                {fmtBRL(report.kpis.totalCommercialPrice)}
              </p>
              <p className="font-mono text-xs tabular-nums text-slate-300">
                {fmtBRL(report.kpis.costPerM2)} / m²
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white/5 p-3.5">
              <p className="text-[10px] uppercase text-slate-400">Prazo Previsto</p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums">
                {report.meta.totalMonths} meses ({report.meta.totalWorkingDays} d.u.)
              </p>
              <p className="text-[11px] text-slate-400">
                {report.meta.startDate || "—"} → {report.meta.endDate || "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3.5">
              <p className="text-[10px] uppercase text-slate-400">Composição da Obra</p>
              <p className="mt-1 font-mono text-xs font-bold tabular-nums">
                Mat {report.kpis.materialSharePercent}% · MO {report.kpis.laborSharePercent}% · Terc{" "}
                {report.kpis.thirdPartySharePercent}%
              </p>
              {audience === "INTERNAL" && report.kpis.totalDirectCost !== undefined && (
                <p className="text-[11px] text-amber-300 font-mono">
                  Direto: {fmtBRL(report.kpis.totalDirectCost)} (BDI {report.meta.bdiPercent}%)
                </p>
              )}
            </div>
            <div className="rounded-2xl bg-white/5 p-3.5">
              <p className="text-[10px] uppercase text-slate-400">Indicadores Estruturais</p>
              <p className="mt-1 font-mono text-xs font-bold tabular-nums">
                Aço: {report.kpis.steelRateKgPerM3} kg/m³ · Conc: {report.kpis.concreteM3PerM2} m³/m²
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Alvenaria: {report.kpis.masonryM2PerM2} m²/m²
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3.5">
              <p className="text-[10px] uppercase text-slate-400">Curva ABC (Pareto 80/20)</p>
              <p className="mt-1 font-mono text-xs font-bold tabular-nums">
                Classe A: {report.abcCurve.summaryByClass.A.itemsCount} itens (
                {report.abcCurve.summaryByClass.A.sharePercent}%)
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                B: {report.abcCurve.summaryByClass.B.itemsCount} · C:{" "}
                {report.abcCurve.summaryByClass.C.itemsCount}
              </p>
            </div>
          </div>
        </Card>

        {/* BLOCO 2 — PAINEL GRÁFICO: MACRO-ETAPAS + CURVA ABC */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Distribuição por Macro-Etapa da EAP (Top 10)
            </h3>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStagesChart} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={135} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => fmtBRL(Number(val) || 0)} />
                  <Bar dataKey="valor" name="Valor Comercial" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                Curva ABC de Insumos & Serviços (Pareto 80/20)
              </h3>
              <div className="flex gap-1.5">
                <Badge tone="red">A: {report.abcCurve.summaryByClass.A.sharePercent}%</Badge>
                <Badge tone="amber">B: {report.abcCurve.summaryByClass.B.sharePercent}%</Badge>
                <Badge tone="neutral">C: {report.abcCurve.summaryByClass.C.sharePercent}%</Badge>
              </div>
            </div>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={abcChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="valor" name="Valor (R$)" fill="#0f172a" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="acumulado"
                    name="% Acumulado"
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* BLOCO 3 — CRONOGRAMA & DESEMBOLSO DO CLIENTE */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Curva S — Evolução Físico-Financeira (%)
            </h3>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={report.schedule.monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis unit="%" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="cumulativePhysicalPercent"
                    name="Evolução Acumulada (%)"
                    fill="#10b981"
                    fillOpacity={0.2}
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Fluxo de Desembolso Mensal Previsto
            </h3>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.schedule.monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v) || 0)} />
                  <Bar dataKey="commercialCost" name="Desembolso Mês" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* BLOCO 4 — GALERIA DO PROJETO & PLANTAS DO ACERVO MANAGER */}
        {(report.acervoVisuals.technicalSheets.length > 0 ||
          report.acervoVisuals.galleryImages.length > 0) && (
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Contextualização Visual — Plantas Oficiais (Acervo Manager) & Imagens
            </h3>

            {report.acervoVisuals.galleryImages.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.acervoVisuals.galleryImages.map((img) => (
                  <a
                    key={img.id}
                    href={img.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="p-3">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {img.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {img.discipline} · {img.version}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {report.acervoVisuals.technicalSheets.length > 0 && (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {report.acervoVisuals.technicalSheets.map((sheet) => (
                  <a
                    key={sheet.id}
                    href={sheet.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 hover:border-blue-400 transition dark:border-zinc-800 dark:hover:border-amber-400"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {sheet.code} · {sheet.revisionNumber}
                      </div>
                      <div className="truncate text-[11px] text-slate-600 dark:text-zinc-400">
                        {sheet.title}
                      </div>
                    </div>
                    <Badge tone={sheet.status === "BOM_PARA_OBRA" ? "green" : "neutral"}>
                      {sheet.discipline}
                    </Badge>
                  </a>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* BLOCO 5 — TABELA EAP EXECUTIVA COM DRILL-DOWN */}
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Resumo Orçamentário por Macro-Etapa (Clique para Detalhar)
          </h3>
          <div className="mt-3 space-y-2">
            {activeStages.map((st) => {
              const open = Boolean(expandedStages[st.code]);
              return (
                <div
                  key={st.code}
                  className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStages((prev) => ({ ...prev, [st.code]: !prev[st.code] }))
                    }
                    className="flex w-full items-center justify-between bg-slate-50 px-4 py-2.5 text-left text-xs cursor-pointer dark:bg-zinc-900"
                  >
                    <span className="font-bold text-slate-900 dark:text-zinc-100">
                      {open ? "▼" : "▶"} {st.code} — {st.name}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-slate-950 dark:text-zinc-100">
                      {fmtBRL(st.totalCommercialPrice)} ({st.weightPercent.toFixed(1)}%)
                    </span>
                  </button>
                  {open && (
                    <div className="overflow-x-auto border-t border-slate-200 dark:border-zinc-800">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50/60 text-[10px] uppercase text-slate-500 dark:bg-zinc-950 dark:text-zinc-400">
                          <tr>
                            <th className="px-3 py-1.5">Descrição</th>
                            <th className="px-2 py-1.5">Un.</th>
                            <th className="px-2 py-1.5 text-right">Qtd</th>
                            <th className="px-2 py-1.5 text-right">Unit. Comercial</th>
                            <th className="px-3 py-1.5 text-right">Total Comercial</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono tabular-nums dark:divide-zinc-800">
                          {st.items.map((it) => (
                            <tr key={it.id} className="text-slate-800 dark:text-zinc-200">
                              <td className="px-3 py-1.5 font-sans">{it.description}</td>
                              <td className="px-2 py-1.5">{it.unit}</td>
                              <td className="px-2 py-1.5 text-right">{it.totalQtyWithLoss.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right">{fmtBRL(it.unitCommercialPrice)}</td>
                              <td className="px-3 py-1.5 text-right font-bold">
                                {fmtBRL(it.totalCommercialPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* BLOCO 6 — PREMISSAS & EXCLUSÕES */}
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Premissas Técnicas & Comerciais
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-zinc-400">
                {report.premises.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Itens Não Inclusos na Proposta (Exclusões)
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-zinc-400">
                {report.exclusions.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
