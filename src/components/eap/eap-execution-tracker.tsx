"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
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
import { EapMeasurementChartsPanel } from "@/components/admin/eap/eap-measurement-charts-panel";
import type { FieldMeasurementChartData } from "@/lib/eap-measurement-charts";
import type {
  ExecutionDashboardPayload,
  StageTrafficLight,
} from "@/server/eap/execution-control";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const INPUT_CLASS =
  "h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400";

function trafficTone(status: StageTrafficLight): "green" | "amber" | "red" {
  if (status === "ESTOURO") return "red";
  if (status === "ATENCAO") return "amber";
  return "green";
}

function trafficLabel(status: StageTrafficLight): string {
  if (status === "ESTOURO") return "ESTOURO (>100%)";
  if (status === "ATENCAO") return "ATENÇÃO (85–100%)";
  return "SAUDÁVEL (<85%)";
}

export function EapExecutionTracker({
  projectId,
  isAdmin = false,
  onMutated,
}: {
  projectId: string;
  isAdmin?: boolean;
  onMutated?: () => void;
}) {
  const [dashboard, setDashboard] = useState<ExecutionDashboardPayload | null>(null);
  const [measurementChartData, setMeasurementChartData] =
    useState<FieldMeasurementChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Modal Boletim de Medição
  const [showMeasModal, setShowMeasModal] = useState(false);
  const [measDate, setMeasDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [measLabel, setMeasLabel] = useState("");
  const [measMat, setMeasMat] = useState("0");
  const [measLab, setMeasLab] = useState("0");
  const [measThird, setMeasThird] = useState("0");
  const [measNotes, setMeasNotes] = useState("");
  const [segmentDrafts, setSegmentDrafts] = useState<Record<string, number>>({});
  const [submittingMeas, setSubmittingMeas] = useState(false);

  // Modal Aditivo / Nova Baseline
  const [showAdditiveModal, setShowAdditiveModal] = useState(false);
  const [additiveReason, setAdditiveReason] = useState("");
  const [additiveNotes, setAdditiveNotes] = useState("");
  const [submittingAdditive, setSubmittingAdditive] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [execRes, measRes] = await Promise.all([
        fetch(`/api/eap/projects/${projectId}/execution`, { cache: "no-store" }),
        fetch(`/api/eap/projects/${projectId}/measurements`, { cache: "no-store" }).catch(
          () => null
        ),
      ]);
      const json = await execRes.json();
      if (!execRes.ok || !json.ok) {
        setError(json.error || "Não foi possível carregar o controle de execução.");
        setDashboard(null);
        return;
      }
      if (measRes && measRes.ok) {
        const measJson = await measRes.json().catch(() => null);
        if (measJson?.ok && measJson?.chartData) {
          setMeasurementChartData(measJson.chartData as FieldMeasurementChartData);
        }
      }
      const data = json.dashboard as ExecutionDashboardPayload;
      setDashboard(data);
      const initialSegs: Record<string, number> = {};
      for (const pkg of data.packages) {
        for (const seg of pkg.segments) {
          initialSegs[seg.id] = seg.progressPercent;
        }
      }
      setSegmentDrafts(initialSegs);
      setMeasLabel(`Medição #${String(data.measurements.length + 1).padStart(2, "0")}`);
    } catch {
      setError("Erro de conexão ao buscar painel de controle de obra.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function handleSuggestFromFinance() {
    if (!dashboard) return;
    const unpaidDiff = Math.max(
      0,
      dashboard.kpis.financialPaymentsTotal - dashboard.kpis.realizedTotal
    );
    const base = unpaidDiff > 0 ? unpaidDiff : dashboard.kpis.financialPaymentsTotal;
    // Sugestão padrão 50% Material, 35% Mão de Obra, 15% Terceiros (editável pelo engenheiro)
    setMeasMat((base * 0.5).toFixed(2));
    setMeasLab((base * 0.35).toFixed(2));
    setMeasThird((base * 0.15).toFixed(2));
  }

  async function handleSaveMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!dashboard) return;
    setSubmittingMeas(true);
    setFeedback(null);
    try {
      const segmentUpdates = Object.entries(segmentDrafts).map(([segmentId, progressPercent]) => ({
        segmentId,
        progressPercent: Number(progressPercent) || 0,
      }));

      const res = await fetch(`/api/eap/projects/${projectId}/execution/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceDate: measDate,
          periodLabel: measLabel.trim() || `Medição ${measDate}`,
          realizedMaterialCost: Number(measMat) || 0,
          realizedLaborCost: Number(measLab) || 0,
          realizedThirdPartyCost: Number(measThird) || 0,
          notes: measNotes.trim() || null,
          segmentUpdates,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Falha ao registrar medição." });
        return;
      }
      setShowMeasModal(false);
      setMeasMat("0");
      setMeasLab("0");
      setMeasThird("0");
      setMeasNotes("");
      setFeedback({
        type: "success",
        text: `Boletim de medição registrado! Avanço físico atualizado para ${json.physicalProgressPercent}% (Status: ${json.nextStatus}).`,
      });
      await loadDashboard();
      onMutated?.();
    } finally {
      setSubmittingMeas(false);
    }
  }

  async function handleSaveAdditive(e: React.FormEvent) {
    e.preventDefault();
    if (additiveReason.trim().length < 5) return;
    setSubmittingAdditive(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/execution/additive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: additiveReason.trim(),
          notes: additiveNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Falha ao registrar aditivo." });
        return;
      }
      setShowAdditiveModal(false);
      setAdditiveReason("");
      setAdditiveNotes("");
      setFeedback({
        type: "success",
        text: `Nova Baseline ${json.versionLabel} registrada com histórico preservado (Delta: ${fmtBRL(json.deltaCommercialAmount)} / ${json.deltaCommercialPercent}%).`,
      });
      await loadDashboard();
      onMutated?.();
    } finally {
      setSubmittingAdditive(false);
    }
  }

  if (loading) {
    return (
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
        Carregando Painel de Execução & Controle Físico-Financeiro...
      </Card>
    );
  }

  if (error || !dashboard) {
    return (
      <Card className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        {error || "Painel de execução indisponível."}
      </Card>
    );
  }

  const { meta, kpis, dualSCurve, zoneProgress, stageMatrix, measurements, baselineHistory, upcomingProcurement } =
    dashboard;

  const activeStages = stageMatrix.filter(
    (st) => st.budgetedCommercial > 0 || st.realizedTotal > 0
  );

  const spiTone = kpis.spi >= 0.98 ? "green" : kpis.spi >= 0.9 ? "amber" : "red";
  const cpiTone = kpis.cpi >= 0.98 ? "green" : kpis.cpi >= 0.9 ? "amber" : "red";

  return (
    <div className="space-y-6">
      {/* Barra de Ações do Ciclo II */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={meta.status === "CONCLUIDA" ? "green" : "blue"}>{meta.status}</Badge>
              <Badge tone="neutral">Baseline {meta.activeBaselineLabel}</Badge>
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Ref.: {meta.referenceDate}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-950 dark:text-zinc-100">
              Controle Físico-Financeiro da Obra — {meta.projectName}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMeasModal(true)}
                  className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
                >
                  + Registrar Boletim de Medição
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdditiveModal(true)}
                  className="h-9 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Registrar Aditivo / Nova Baseline
                </button>
              </>
            )}
            <a
              href={`/api/eap/projects/${projectId}/execution/evolution-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Exportar Boletim de Evolução (PDF)
            </a>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </Card>

      {/* Cards Executivos de Saúde da Obra */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Avanço Físico (Real × Prev)
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-950 dark:text-zinc-50">
            {kpis.realizedPhysicalPercent.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            Previsto Baseline: <span className="font-mono font-semibold">{kpis.plannedPhysicalPercent.toFixed(1)}%</span>
          </p>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              SPI (Prazo)
            </p>
            <Badge tone={spiTone}>{kpis.spi >= 0.98 ? "No Prazo" : kpis.spi >= 0.9 ? "Atenção" : "Atraso"}</Badge>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-950 dark:text-zinc-50">
            {kpis.spi.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            Desvio: <span className="font-mono font-semibold">{kpis.scheduleVarianceWorkingDays >= 0 ? "+" : ""}{kpis.scheduleVarianceWorkingDays} dias úteis</span>
          </p>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              CPI (Custo)
            </p>
            <Badge tone={cpiTone}>{kpis.cpi >= 0.98 ? "Eficiente" : kpis.cpi >= 0.9 ? "Alerta" : "Estouro"}</Badge>
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-950 dark:text-zinc-50">
            {kpis.cpi.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            Valor Agregado: <span className="font-mono font-semibold">{fmtBRL(kpis.earnedValue)}</span>
          </p>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Orçado vs. Realizado
          </p>
          <p className="mt-1.5 font-mono text-lg font-bold text-slate-950 dark:text-zinc-50">
            {fmtBRL(kpis.realizedTotal)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            Baseline: <span className="font-mono font-semibold">{fmtBRL(kpis.budgetedTotal)}</span>
          </p>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Saldo a Executar
          </p>
          <p
            className={`mt-1.5 font-mono text-lg font-bold ${
              kpis.remainingBudget < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {fmtBRL(kpis.remainingBudget)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            Pagos no Financeiro: <span className="font-mono font-semibold">{fmtBRL(kpis.financialPaymentsTotal)}</span>
          </p>
        </Card>
      </div>

      {/* Painel Gráfico Executivo da Medição de Campo (Expandido no Boletim de Evolução) */}
      {measurementChartData && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Painel Gráfico de Evolução no Canteiro
          </h4>
          <EapMeasurementChartsPanel chartData={measurementChartData} />
        </div>
      )}

      {/* Curva S Dupla + Avanço por Zona */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Curva S Dupla — Previsto (Baseline) × Realizado
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Comparação mensal do avanço físico (%) planejado versus medições reais registradas em obra.
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dualSCurve}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => {
                    const num = Number(value);
                    return [
                      Number.isFinite(num) ? `${num.toFixed(1)}%` : "--",
                      String(name),
                    ];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="plannedPhysicalPct"
                  name="Físico Previsto (%)"
                  stroke="#64748b"
                  fill="#94a3b8"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="realizedPhysicalPct"
                  name="Físico Realizado (%)"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Avanço Físico por Pavimento / Zona
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Comparativo por zona construtiva ({zoneProgress.length} zonas).
            </p>
          </div>
          <div className="space-y-3.5">
            {zoneProgress.map((z) => (
              <div key={z.zoneCode} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    {z.zoneName}
                  </span>
                  <span className="font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                    Real {z.realizedPercent.toFixed(1)}% / Prev {z.plannedPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(100, z.realizedPercent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200/80 pt-3 dark:border-zinc-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Realizado por Natureza
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-zinc-900">
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">Material</div>
                <div className="mt-0.5 font-mono text-[11px] font-bold text-slate-900 dark:text-zinc-100">
                  {fmtBRL(kpis.realizedMaterialTotal)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-zinc-900">
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">Mão de Obra</div>
                <div className="mt-0.5 font-mono text-[11px] font-bold text-slate-900 dark:text-zinc-100">
                  {fmtBRL(kpis.realizedLaborTotal)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-zinc-900">
                <div className="text-[10px] text-slate-500 dark:text-zinc-400">Terceiros</div>
                <div className="mt-0.5 font-mono text-[11px] font-bold text-slate-900 dark:text-zinc-100">
                  {fmtBRL(kpis.realizedThirdPartyTotal)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Semáforo Financeiro & Físico das 26 Macro-Etapas */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Semáforo Financeiro & Físico das Macro-Etapas ({activeStages.length} ativas)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Orçado Baseline × Realizado (Material, Mão de Obra e Terceiros) com alerta de desvio por etapa.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2.5 pr-3">Etapa</th>
                <th className="py-2.5 px-2 text-right">Físico %</th>
                <th className="py-2.5 px-2 text-right">Orçado Baseline</th>
                {isAdmin && (
                  <>
                    <th className="py-2.5 px-2 text-right">Real. Material</th>
                    <th className="py-2.5 px-2 text-right">Real. MO</th>
                    <th className="py-2.5 px-2 text-right">Real. Terceiros</th>
                  </>
                )}
                <th className="py-2.5 px-2 text-right">Total Realizado</th>
                <th className="py-2.5 px-2 text-right">Desvio (R$ / %)</th>
                <th className="py-2.5 pl-2 text-right">Semáforo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {activeStages.map((st) => (
                <tr key={st.code} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50">
                  <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-zinc-100">
                    <span className="font-mono text-slate-500 dark:text-zinc-400">{st.code}</span>{" "}
                    {st.name}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-zinc-300">
                    {st.physicalProgressPercent.toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-zinc-300">
                    {fmtBRL(st.budgetedCommercial)}
                  </td>
                  {isAdmin && (
                    <>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-zinc-400">
                        {fmtBRL(st.realizedMaterial)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-zinc-400">
                        {fmtBRL(st.realizedLabor)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-zinc-400">
                        {fmtBRL(st.realizedThirdParty)}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-900 dark:text-zinc-100">
                    {fmtBRL(st.realizedTotal)}
                  </td>
                  <td
                    className={`py-2.5 px-2 text-right font-mono ${
                      st.varianceAmount > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {st.varianceAmount >= 0 ? "+" : ""}
                    {fmtBRL(st.varianceAmount)} ({st.consumptionPercent.toFixed(0)}%)
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    <Badge tone={trafficTone(st.status)}>{trafficLabel(st.status)}</Badge>
                  </td>
                </tr>
              ))}
              {activeStages.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 9 : 6}
                    className="py-6 text-center text-xs text-slate-500 dark:text-zinc-400"
                  >
                    Nenhuma etapa com orçamento ou medição registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Histórico de Medições, Revisões de Baseline (Aditivos) e Suprimentos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Boletins de Medição ({measurements.length})
          </h3>
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {measurements.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200/90 p-3 text-xs dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-zinc-100">{m.periodLabel}</span>
                  <Badge tone="blue">{m.physicalProgressPercent.toFixed(1)}%</Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <span>{m.referenceDate}</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                    {fmtBRL(m.totalRealizedCost)}
                  </span>
                </div>
                {m.notes && (
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-400">{m.notes}</p>
                )}
              </div>
            ))}
            {measurements.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Nenhum boletim de medição lançado até o momento.
              </p>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Histórico de Baselines & Aditivos ({baselineHistory.length})
          </h3>
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {baselineHistory.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200/90 p-3 text-xs dark:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-zinc-100">
                    Baseline {b.versionLabel}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    {b.approvedAt}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    {fmtBRL(b.totalCommercialPrice)}
                  </span>
                  {b.deltaCommercialAmount !== 0 && (
                    <Badge tone={b.deltaCommercialAmount > 0 ? "amber" : "green"}>
                      {b.deltaCommercialAmount > 0 ? "+" : ""}
                      {fmtBRL(b.deltaCommercialAmount)} ({b.deltaCommercialPercent}%)
                    </Badge>
                  )}
                </div>
                {b.reason && (
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-400">
                    Motivo: {b.reason}
                  </p>
                )}
              </div>
            ))}
            {baselineHistory.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Congele a Baseline v1.0 na aba Planejamento para habilitar comparativos.
              </p>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Suprimentos Prioritários ({upcomingProcurement.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {upcomingProcurement.map((g) => (
              <div
                key={g.id}
                className="rounded-2xl border border-slate-200/90 p-2.5 text-xs dark:border-zinc-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">{g.title}</span>
                  <Badge tone={g.status === "COMPRADO" ? "green" : "amber"}>{g.status}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                  Gatilho: {g.triggerDate} · Lead time {g.leadTimeDays}d · {g.packageName}
                </p>
              </div>
            ))}
            {upcomingProcurement.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Todos os suprimentos críticos estão entregues ou sem pendências.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Modal: + Registrar Boletim de Medição */}
      {isAdmin && showMeasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#16161D]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
                Registrar Boletim de Medição Periódica
              </h3>
              <button
                type="button"
                onClick={() => setShowMeasModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Fechar ✕
              </button>
            </div>

            <form onSubmit={handleSaveMeasurement} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Data de Referência
                  </label>
                  <input
                    type="date"
                    required
                    value={measDate}
                    onChange={(e) => setMeasDate(e.target.value)}
                    className={`${INPUT_CLASS} mt-1 w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Rótulo do Período
                  </label>
                  <input
                    type="text"
                    required
                    value={measLabel}
                    onChange={(e) => setMeasLabel(e.target.value)}
                    placeholder="Ex.: Medição #01 - Mar/2026"
                    className={`${INPUT_CLASS} mt-1 w-full`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-3.5 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                    Custos Realizados do Período (R$)
                  </span>
                  <button
                    type="button"
                    onClick={handleSuggestFromFinance}
                    className="rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 cursor-pointer dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                  >
                    Sugerir do Financeiro ({fmtBRL(kpis.financialPaymentsTotal)})
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                      Material (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={measMat}
                      onChange={(e) => setMeasMat(e.target.value)}
                      className={`${INPUT_CLASS} mt-1 w-full font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                      Mão de Obra (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={measLab}
                      onChange={(e) => setMeasLab(e.target.value)}
                      className={`${INPUT_CLASS} mt-1 w-full font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                      Terceiros (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={measThird}
                      onChange={(e) => setMeasThird(e.target.value)}
                      className={`${INPUT_CLASS} mt-1 w-full font-mono`}
                    />
                  </div>
                </div>
              </div>

              {dashboard.packages.length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-3.5 dark:border-zinc-800">
                  <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mb-2">
                    Avanço Físico por Pacote / Zona (% Concluído)
                  </p>
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {dashboard.packages.map((pkg) =>
                      pkg.segments.map((seg) => (
                        <div
                          key={seg.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-zinc-900"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-slate-900 dark:text-zinc-100">
                              #{pkg.packageNumber} {pkg.name}
                            </span>{" "}
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                              ({seg.zoneCode})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={segmentDrafts[seg.id] ?? seg.progressPercent}
                              onChange={(e) =>
                                setSegmentDrafts((prev) => ({
                                  ...prev,
                                  [seg.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                }))
                              }
                              className="h-7 w-16 rounded-lg border border-slate-300 bg-white px-2 text-right font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            />
                            <span className="text-[11px] text-slate-500">%</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Observações de Obra / Diário do Período
                </label>
                <textarea
                  rows={2}
                  value={measNotes}
                  onChange={(e) => setMeasNotes(e.target.value)}
                  placeholder="Ex.: Concretagem da laje térreo finalizada; chuva leve atrasou 1 dia..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMeasModal(false)}
                  className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingMeas}
                  className="h-9 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                >
                  {submittingMeas ? "Salvando..." : "Salvar Boletim de Medição"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Registrar Aditivo / Nova Baseline */}
      {isAdmin && showAdditiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#16161D]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950 dark:text-zinc-100">
                Registrar Aditivo & Nova Revisão de Baseline
              </h3>
              <button
                type="button"
                onClick={() => setShowAdditiveModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer dark:text-zinc-400"
              >
                Fechar ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Congela o estado atual da EAP como nova versão (ex.: v1.0 → v2.0), preservando integralmente o histórico da Baseline anterior e calculando o delta financeiro.
            </p>

            <form onSubmit={handleSaveAdditive} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Justificativa do Aditivo *
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={additiveReason}
                  onChange={(e) => setAdditiveReason(e.target.value)}
                  placeholder="Ex.: Inclusão de piscina aquecida e alteração de revestimento da fachada"
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Notas Complementares
                </label>
                <textarea
                  rows={3}
                  value={additiveNotes}
                  onChange={(e) => setAdditiveNotes(e.target.value)}
                  placeholder="Aprovado pelo cliente em ata de reunião..."
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdditiveModal(false)}
                  className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdditive || additiveReason.trim().length < 5}
                  className="h-9 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
                >
                  {submittingAdditive ? "Registrando..." : "Congelar Nova Baseline"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
