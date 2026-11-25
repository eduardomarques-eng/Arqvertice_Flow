"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EapScheduleReportPayload } from "@/server/eap/eap-schedule-report";

function fmtDateBR(iso: string): string {
  if (!iso || iso.length < 10) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const TEAM_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DC2626"];
const FLOOR_COLORS = ["#0F172A", "#1D4ED8", "#047857", "#B45309", "#6D28D9"];

export function EapScheduleReportView({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<EapScheduleReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/schedule-report`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Não foi possível carregar o Relatório de Planejamento.");
        return;
      }
      setReport(json.report as EapScheduleReportPayload);
    } catch {
      setError("Erro de conexão ao carregar o Relatório de Planejamento.");
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
      const res = await fetch(`/api/eap/projects/${projectId}/schedule-report/pdf`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Erro ao exportar PDF de Planejamento.");
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
      link.download = `Planejamento-Cronograma-${slug || "obra"}.pdf`;
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
        Consolidando cronograma físico, histograma de equipes e Gantt por fase...
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
        {error || "Nenhum dado de planejamento LOB disponível."}
      </Card>
    );
  }

  const k = report.kpis;
  const histogramData = report.monthlyHistogram.map((m) => ({
    monthLabel: m.monthLabel,
    ...m.teamDays,
    totalDays: m.totalDays,
  }));

  return (
    <div className="space-y-6">
      {/* Cabeçalho Editorial Apple HIG */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Relatório de Planejamento &amp; Cronograma LOB</Badge>
              <Badge tone={k.teamOverloads + k.precedenceViolations === 0 ? "green" : "amber"}>
                {k.healthLabel}
              </Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
              {report.meta.projectName}
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Cliente: <strong className="text-slate-900 dark:text-zinc-200">{report.meta.clientName}</strong>{" "}
              · Praça: {report.meta.cityLabel} · Área:{" "}
              <span className="font-mono font-semibold tabular-nums">{report.meta.builtAreaM2} m²</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadReport()}
              className="h-9 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              ↻ Atualizar Planejamento
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={exportingPdf}
              className="h-9 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {exportingPdf ? "Gerando PDF..." : "📄 Exportar Relatório Planejamento PDF"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}
      </Card>

      {/* Cards KPI do Cronograma */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Início da Obra
          </p>
          <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {fmtDateBR(k.startDate)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Marco zero LOB</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Previsão de Término
          </p>
          <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {fmtDateBR(k.endDate)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Entrega técnica</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Prazo Total
          </p>
          <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {k.workingDaysTotal} d.u.
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
            {k.calendarDaysTotal} d.c. (~{k.monthsEstimated} meses) · -{k.daysSavedByParallelism}d paralel.
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Pacotes Ativos
          </p>
          <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {k.activePackagesCount} PCTs
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
            {k.totalAllocatedCells} células no calendário
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Equipes Alocadas
          </p>
          <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-violet-700 dark:text-violet-400">
            {k.teamsCount} equipes
          </p>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-400">
            {report.teams.map((t) => `Eq. ${t.teamCode}`).join(" · ")}
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Saúde / Conflitos
          </p>
          <p
            className={`mt-1.5 font-mono text-xl font-bold tabular-nums ${
              k.teamOverloads + k.precedenceViolations === 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {k.teamOverloads + k.precedenceViolations} alertas
          </p>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-400">
            {k.teamOverloads} sobrec. · {k.precedenceViolations} preced.
          </p>
        </Card>
      </div>

      {/* Gráfico Gantt por Fase & Pacote */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Cronograma Gantt por Fase &amp; Pacote (Timeline Visual Colorida)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Agrupamento por fase construtiva, janelas de cura (tracejado âmbar) e paralelismo real entre equipes ({k.daysSavedByParallelism} d.u. economizados).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="green">Cura &amp; Fast-Tracking</Badge>
            <Badge tone="neutral">{report.packages.length} pacotes sequenciados</Badge>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-zinc-800">
          <div className="min-w-[880px]">
            {/* Cabeçalho de Meses */}
            <div className="grid grid-cols-[320px_1fr_92px] items-center border-b border-slate-200 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white dark:border-zinc-800 dark:bg-zinc-950">
              <span>Pacote / Equipe</span>
              <div className="relative h-4">
                {report.monthlyHistogram.map((m, idx, arr) => {
                  const leftPct = arr.length <= 1 ? 0 : (idx / arr.length) * 100;
                  return (
                    <span
                      key={m.monthKey}
                      style={{ left: `${leftPct.toFixed(1)}%` }}
                      className="absolute top-0 text-[10px] font-semibold text-slate-300"
                    >
                      {m.monthLabel}
                    </span>
                  );
                })}
              </div>
              <span className="text-right">Duração</span>
            </div>

            {/* Grupos por Fase Construtiva */}
            {Array.from(
              report.packages.reduce((acc, pkg) => {
                const list = acc.get(pkg.phaseGroupKey) ?? [];
                list.push(pkg);
                acc.set(pkg.phaseGroupKey, list);
                return acc;
              }, new Map<string, typeof report.packages>())
            ).map(([groupKey, groupPkgs]) => {
              const first = groupPkgs[0];
              const groupDays = groupPkgs.reduce((s, p) => s + p.workingDays, 0);
              return (
                <div key={groupKey} className="divide-y divide-slate-100 dark:divide-zinc-800/70">
                  {/* Faixa de Cabeçalho da Fase */}
                  <div
                    className="flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold tracking-wide bg-slate-100/90 dark:bg-zinc-900/90"
                    style={{ borderLeft: `4px solid ${first.phaseGroupColorHex}` }}
                  >
                    <span style={{ color: first.phaseGroupColorHex }}>
                      {first.phaseGroupTitle}
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                      {groupPkgs.length} pct · {groupDays} d.u. acumulados
                    </span>
                  </div>

                  {groupPkgs.map((pkg, rowIdx) => {
                    const leftPct = pkg.startRatio * 100;
                    const widthPct = Math.max(1.8, pkg.widthRatio * 100);
                    const curePct = pkg.cureWidthRatio * 100;
                    const teamTag = `Eq. ${pkg.teamCodes.join(",")}`;
                    const predsText =
                      pkg.predecessorNumbers.length > 0
                        ? pkg.predecessorNumbers.map((n) => `PCT ${String(n).padStart(2, "0")}`).join(", ")
                        : "Nenhuma";

                    return (
                      <div
                        key={pkg.packageNumber}
                        className={`grid grid-cols-[320px_1fr_92px] items-center gap-3 px-3 py-1.5 transition hover:bg-blue-50/40 dark:hover:bg-zinc-900/70 ${
                          rowIdx % 2 === 1 ? "bg-zinc-50/60 dark:bg-zinc-900/30" : "bg-white dark:bg-transparent"
                        }`}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                                PCT {String(pkg.packageNumber).padStart(2, "0")}
                              </span>{" "}
                              · {pkg.packageName}
                            </p>
                            <p className="truncate text-[10px] text-slate-500 dark:text-zinc-400">
                              {pkg.floorsLabel}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {teamTag}
                          </span>
                        </div>

                        <div
                          className="relative h-6 w-full rounded-md bg-slate-100/90 dark:bg-zinc-800/70"
                          title={[
                            `PCT ${String(pkg.packageNumber).padStart(2, "0")} — ${pkg.packageName}`,
                            `Início: ${fmtDateBR(pkg.startDate)} · Término: ${fmtDateBR(pkg.endDate)}`,
                            `Pavimentos: ${pkg.floorsLabel}`,
                            `Equipe: ${teamTag} · Duração: ${pkg.workingDays} d.u.`,
                            `Predecessoras: ${predsText}`,
                            pkg.cureLagWorkingDays > 0
                              ? `Janela de Cura: ${pkg.cureLagWorkingDays} d.u.`
                              : null,
                          ]
                            .filter(Boolean)
                            .join("\n")}
                        >
                          {/* Linhas guia verticais por mês */}
                          {report.monthlyHistogram.map((m, mIdx, arr) => {
                            const mLeft = arr.length <= 1 ? 0 : (mIdx / arr.length) * 100;
                            return (
                              <span
                                key={m.monthKey}
                                style={{ left: `${mLeft.toFixed(2)}%` }}
                                className="pointer-events-none absolute top-0 bottom-0 w-px bg-slate-200/70 dark:bg-zinc-700/50"
                              />
                            );
                          })}

                          {/* Barra principal colorida por fase */}
                          <div
                            className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md px-1.5 shadow-xs"
                            style={{
                              left: `${leftPct.toFixed(2)}%`,
                              width: `${widthPct.toFixed(2)}%`,
                              backgroundColor: pkg.phaseGroupColorHex,
                            }}
                          >
                            {widthPct >= 9 && (
                              <span className="truncate font-mono text-[9px] font-bold text-white">
                                {teamTag} · {pkg.workingDays}d
                              </span>
                            )}
                          </div>

                          {/* Marcador sutil de Cura / Lag */}
                          {curePct > 0 && (
                            <div
                              className="absolute top-2 bottom-2 rounded-r border border-dashed border-amber-500 bg-amber-200/70 dark:border-amber-400 dark:bg-amber-900/50"
                              style={{
                                left: `${Math.min(99, leftPct + widthPct).toFixed(2)}%`,
                                width: `${Math.min(100 - (leftPct + widthPct), curePct).toFixed(2)}%`,
                              }}
                              title={`Cura técnica obrigatória: ${pkg.cureLagWorkingDays} d.u.`}
                            />
                          )}
                        </div>

                        <div className="text-right font-mono text-[11px] font-bold tabular-nums text-slate-700 dark:text-zinc-300">
                          {pkg.workingDays} d.u.
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Histograma de Carga de Equipes & Distribuição por Pavimento */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Histograma de Carga de Equipes por Mês
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Dias-equipe trabalhados mensalmente por cada equipe (Eq. A, B, C) ao longo da obra.
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {report.teams.map((t, idx) => (
                  <Bar
                    key={t.teamCode}
                    dataKey={t.teamCode}
                    name={`Eq. ${t.teamCode}`}
                    stackId="a"
                    fill={TEAM_COLORS[idx % TEAM_COLORS.length]}
                    radius={idx === report.teams.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D]">
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
            Distribuição de Dias Úteis por Pavimento
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Concentração de frentes de trabalho entre Fundação, Térreo, Pav. Superior, Coberta e Área Externa.
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.byFloor} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="floorName" width={145} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `${value} d.u.`} />
                <Bar dataKey="workingDays" name="Dias Úteis" radius={[0, 6, 6, 0]}>
                  {report.byFloor.map((_, idx) => (
                    <Cell key={idx} fill={FLOOR_COLORS[idx % FLOOR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabela Executiva do Cronograma */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
        <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
          Tabela Executiva do Cronograma (Pacotes 01 a 38)
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2.5">Fase</th>
                <th className="px-3 py-2.5">Pacote</th>
                <th className="px-3 py-2.5">Pavimento(s)</th>
                <th className="px-3 py-2.5">Equipe</th>
                <th className="px-3 py-2.5">Início</th>
                <th className="px-3 py-2.5">Término</th>
                <th className="px-3 py-2.5 text-right">Dias Úteis</th>
                <th className="px-3 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {report.packages.map((pkg) => (
                <tr key={pkg.packageNumber} className="text-slate-800 dark:text-zinc-200">
                  <td className="px-3 py-2 font-medium text-slate-600 dark:text-zinc-400">
                    {pkg.phaseName}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-950 dark:text-zinc-100">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: pkg.corHex }}
                    />
                    PCT {String(pkg.packageNumber).padStart(2, "0")} — {pkg.packageName}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                    {pkg.floorsLabel}
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold">
                    {pkg.teamCodes.join(", ")}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {fmtDateBR(pkg.startDate)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {fmtDateBR(pkg.endDate)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                    {pkg.workingDays} d.u.
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge tone="green">{pkg.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
