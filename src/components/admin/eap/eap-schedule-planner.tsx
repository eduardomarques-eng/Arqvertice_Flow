"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { EapLobSpreadsheet } from "@/components/admin/eap/eap-lob-spreadsheet";
import { EapTeamsAndPackagesManager } from "@/components/admin/eap/eap-teams-and-packages-manager";
import { EapConstraintsKanban } from "@/components/admin/eap/eap-constraints-kanban";
import type { LobPackageBlockSummary } from "@/server/eap/constraints-lookahead";
import type {
  EapStageFloorLoad,
  LobFloorAllocationItem,
  LobFloorDefinition,
} from "@/lib/eap-lob-grid";
import type { ServicePackageDTO, WorkTeamDTO } from "@/components/admin/eap/eap-teams-and-packages-manager";
import type {
  MonthlyCashflowPoint,
  ScheduleAnalyticsResult,
  ScheduleAuditResult,
} from "@/server/eap/scheduler";

interface ScheduleSegmentDTO {
  id: string;
  zoneCode: string;
  segmentOrder: number;
  startDate: string;
  endDate: string;
  workingDays: number;
  parallelLane: number;
  progressPercent: number;
  notes: string | null;
}

interface ProcurementGateDTO {
  id: string;
  packageId: string;
  packageNumber: number;
  packageName: string;
  title: string;
  leadTimeDays: number;
  triggerDate: string;
  status: string;
}

interface SchedulePackageDTO {
  id: string;
  packageNumber: number;
  name: string;
  waveName: string;
  linkedStageCodes: string[];
  predecessorNumbers: number[];
  durationWorkingDays: number;
  teamsCount: number;
  orderIndex: number;
  segments: ScheduleSegmentDTO[];
  procurementGates: ProcurementGateDTO[];
}

interface ScheduleApiPayload {
  eapStatus: string;
  cityLabel: string;
  builtAreaM2?: number;
  plannedStartDate: string | null;
  zones: Array<{ id: string; code: string; name: string; orderIndex: number }>;
  holidays: Array<{ id: string; date: string; name: string; type: string }>;
  packages: SchedulePackageDTO[];
  servicePackages?: ServicePackageDTO[];
  workTeams?: WorkTeamDTO[];
  lobFloors?: LobFloorDefinition[];
  lobAllocations?: LobFloorAllocationItem[];
  eapStageFloorLoads?: EapStageFloorLoad[];
  constraintBlocks?: Record<string, LobPackageBlockSummary>;
  constraintsMetrics?: { total: number; criticalCount: number };
  analytics: ScheduleAnalyticsResult;
  audit: ScheduleAuditResult;
  baselines: Array<{
    id: string;
    versionLabel: string;
    totalDirectCost: number;
    totalCommercialPrice: number;
    costPerM2: number;
    approvedAt: string;
  }>;
}

type PlannerSubView = "lob" | "constraints" | "table" | "charts" | "procurement";

const WAVE_COLORS = [
  "bg-blue-600 text-white",
  "bg-indigo-600 text-white",
  "bg-teal-600 text-white",
  "bg-amber-600 text-white",
  "bg-emerald-600 text-white",
  "bg-purple-600 text-white",
];

const INPUT_CLASS =
  "h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getWaveColorClass(waveName: string): string {
  const m = waveName.match(/Fase\s+(\d)/i);
  const idx = m ? Math.max(0, Number(m[1]) - 1) : 0;
  return WAVE_COLORS[idx % WAVE_COLORS.length];
}

export function EapSchedulePlanner({
  projectId,
  onBaselineApproved,
}: {
  projectId: string;
  onBaselineApproved?: () => void;
}) {
  const [data, setData] = useState<ScheduleApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<PlannerSubView>("lob");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  const [startDateInput, setStartDateInput] = useState("2026-04-01");
  const [waveFilter, setWaveFilter] = useState("ALL");
  const [zoneFilter, setZoneFilter] = useState("ALL");

  // Modal de edição rápida de segmento (clique no bloco LOB)
  const [editingSegment, setEditingSegment] = useState<{
    packageId: string;
    packageLabel: string;
    segment: ScheduleSegmentDTO;
  } | null>(null);

  // Modal Novo Gatilho de Compra
  const [showGateModal, setShowGateModal] = useState(false);
  const [newGate, setNewGate] = useState({
    packageId: "",
    title: "",
    leadTimeDays: "30",
    triggerDate: "2026-03-15",
  });

  const loadSchedule = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/eap/projects/${projectId}/schedule`, { cache: "no-store" });
        const json = await res.json();
        if (json.ok) {
          setData(json as ScheduleApiPayload);
          if (json.plannedStartDate) {
            setStartDateInput(json.plannedStartDate);
          }
          if (json.packages?.[0]?.id) {
            setNewGate((prev) => ({ ...prev, packageId: prev.packageId || json.packages[0].id }));
          }
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const allGates = useMemo(() => {
    if (!data) return [];
    return data.packages
      .flatMap((p) => p.procurementGates)
      .sort((a, b) => a.triggerDate.localeCompare(b.triggerDate));
  }, [data]);

  const uniqueWaves = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.packages.map((p) => p.waveName))];
  }, [data]);

  const filteredPackages = useMemo(() => {
    if (!data) return [];
    return data.packages.filter((p) => {
      if (waveFilter !== "ALL" && p.waveName !== waveFilter) return false;
      if (zoneFilter !== "ALL" && !p.segments.some((s) => s.zoneCode === zoneFilter)) return false;
      return true;
    });
  }, [data, waveFilter, zoneFilter]);

  async function handleGenerateSchedule() {
    setBusy("generate");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/schedule/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: startDateInput }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao gerar cronograma." });
        return;
      }
      setFeedback({
        type: "success",
        text: `Cronograma LOB gerado: ${json.segmentsCount} trecho(s) e ${json.procurementGatesCount} gatilho(s) de suprimentos.`,
      });
      await loadSchedule();
    } finally {
      setBusy(null);
    }
  }

  async function handleApproveBaseline() {
    setBusy("baseline");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/schedule/approve-baseline`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setShowAuditPanel(true);
        setFeedback({ type: "error", text: json.error || "Não foi possível aprovar Baseline." });
        return;
      }
      setFeedback({
        type: "success",
        text: `Linha de Base ${json.snapshot.versionLabel} congelada (${fmtBRL(json.snapshot.totalCommercialPrice)})!`,
      });
      await loadSchedule();
      onBaselineApproved?.();
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveSegmentModal(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSegment) return;
    setBusy("seg-save");
    try {
      const res = await fetch(
        `/api/eap/projects/${projectId}/schedule/packages/${editingSegment.packageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segmentAction: {
              type: "UPSERT",
              segmentId: editingSegment.segment.id,
              zoneCode: editingSegment.segment.zoneCode,
              startDate: editingSegment.segment.startDate,
              endDate: editingSegment.segment.endDate,
              workingDays: Number(editingSegment.segment.workingDays) || 1,
              parallelLane: Number(editingSegment.segment.parallelLane) || 1,
              notes: editingSegment.segment.notes,
            },
          }),
        }
      );
      if (res.ok) {
        setEditingSegment(null);
        setFeedback({ type: "success", text: "Trecho LOB atualizado." });
        await loadSchedule();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSplitSecondSegment(pkg: SchedulePackageDTO) {
    const baseSeg = pkg.segments[pkg.segments.length - 1];
    const zoneCode = (baseSeg?.zoneCode || "FUND_TERREO") as
      | "FUND_TERREO"
      | "PAV_SUPERIOR"
      | "COBERTURA"
      | "EXTERNO";
    const startDate = baseSeg?.endDate || startDateInput;
    setBusy(pkg.id);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/schedule/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentAction: {
            type: "UPSERT",
            zoneCode,
            segmentOrder: pkg.segments.length + 1,
            startDate,
            endDate: startDate,
            workingDays: Math.max(2, Math.ceil(pkg.durationWorkingDays / 2)),
            parallelLane: (baseSeg?.parallelLane || 1) + 1,
            notes: "2º Trecho (desdobramento LOB)",
          },
        }),
      });
      if (res.ok) {
        setFeedback({ type: "success", text: `2º trecho criado em PCT ${String(pkg.packageNumber).padStart(2, "0")}.` });
        await loadSchedule();
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdatePackageInline(pkg: SchedulePackageDTO, teamsCount: number, durationWorkingDays: number) {
    setBusy(pkg.id);
    try {
      await fetch(`/api/eap/projects/${projectId}/schedule/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamsCount, durationWorkingDays }),
      });
      await loadSchedule();
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdateGateStatus(gateId: string, status: string) {
    setBusy(gateId);
    try {
      await fetch(`/api/eap/projects/${projectId}/schedule/procurement/${gateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadSchedule();
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateGate(e: React.FormEvent) {
    e.preventDefault();
    if (!newGate.packageId || !newGate.title.trim()) return;
    setBusy("new-gate");
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/schedule/procurement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: newGate.packageId,
          title: newGate.title.trim(),
          leadTimeDays: Number(newGate.leadTimeDays) || 15,
          triggerDate: newGate.triggerDate,
        }),
      });
      if (res.ok) {
        setShowGateModal(false);
        setNewGate((prev) => ({ ...prev, title: "" }));
        setFeedback({ type: "success", text: "Novo gatilho de suprimentos adicionado." });
        await loadSchedule();
      }
    } finally {
      setBusy(null);
    }
  }

  if (loading || !data) {
    return (
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
        Carregando Planejamento LOB & Cronograma...
      </Card>
    );
  }

  const an = data.analytics;
  const pendingGates = allGates.filter((g) => g.status === "PENDENTE").length;
  const timelineStartTs = an.startDate ? new Date(`${an.startDate}T00:00:00.000Z`).getTime() : 0;
  const timelineEndTs = an.endDate ? new Date(`${an.endDate}T00:00:00.000Z`).getTime() : 1;
  const totalSpanMs = Math.max(86_400_000, timelineEndTs - timelineStartTs);

  function computeBarPercent(start: string, end: string): { left: number; width: number } {
    const s = new Date(`${start}T00:00:00.000Z`).getTime();
    const e = new Date(`${end}T00:00:00.000Z`).getTime();
    const left = Math.max(0, Math.min(98, ((s - timelineStartTs) / totalSpanMs) * 100));
    const width = Math.max(2, Math.min(100 - left, ((e - s + 86_400_000) / totalSpanMs) * 100));
    return { left, width };
  }

  return (
    <div className="space-y-5">
      {/* KPIs de Prazo & Controle */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Início Previsto
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {an.startDate || "Não gerado"}
          </p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Previsão Entrega
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {an.endDate || "—"}
          </p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Duração Total
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {an.totalMonths} meses · {an.totalWorkingDays} d.u.
          </p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Feriados ({data.cityLabel})
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {an.holidaysAppliedCount} aplicados
          </p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Pico de Frentes
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-950 dark:text-zinc-100">
            {an.peakFronts} frentes ({an.peakTeams} eq.)
          </p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-zinc-800 dark:bg-[#16161D]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Suprimentos Pendentes
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {pendingGates} / {allGates.length}
          </p>
        </Card>
      </div>

      {/* Barra de Ações Principais */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-4 dark:border-zinc-800 dark:bg-[#16161D] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Início:</label>
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={handleGenerateSchedule}
              disabled={busy === "generate"}
              className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              {busy === "generate" ? "Gerando..." : "⚡ Gerar / Recalcular da EAP"}
            </button>
            <button
              type="button"
              onClick={() => setShowAuditPanel((v) => !v)}
              className="h-9 rounded-xl border border-slate-300 px-3.5 text-xs font-semibold text-slate-800 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
            >
              Auditar Sequência ({data.audit.criticalBlockers.length} bloq. / {data.audit.warnings.length} av.)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EapTeamsAndPackagesManager
              projectId={projectId}
              buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-300/80 bg-indigo-50/90 px-3.5 text-xs font-semibold text-indigo-900 shadow-xs transition hover:bg-indigo-100 cursor-pointer dark:border-indigo-500/40 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-900/70"
            />
            {data.baselines[0] && (
              <Badge tone="green">Baseline {data.baselines[0].versionLabel} Ativa</Badge>
            )}
            <button
              type="button"
              onClick={handleApproveBaseline}
              disabled={busy === "baseline"}
              className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              {busy === "baseline"
                ? "Congelando..."
                : `🔒 Aprovar Baseline v${data.baselines.length + 1}.0`}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {showAuditPanel && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="font-bold text-slate-900 dark:text-zinc-100">
              Auditoria Lógica do Cronograma ({data.audit.approved ? "Aprovada" : "Com Bloqueios Críticos"})
            </div>
            {data.audit.criticalBlockers.map((b) => (
              <p key={b} className="text-rose-700 dark:text-rose-400">
                ⛔ {b}
              </p>
            ))}
            {data.audit.warnings.map((w) => (
              <p key={w} className="text-amber-700 dark:text-amber-400">
                ⚠ {w}
              </p>
            ))}
            {data.audit.criticalBlockers.length === 0 && data.audit.warnings.length === 0 && (
              <p className="text-emerald-700 dark:text-emerald-400">
                ✓ Sequência construtiva, datas e suprimentos consistentes.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Navegação Sub-visões do Planejamento */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "lob", label: "Linha de Balanço (LOB — Zonas)" },
            {
              id: "constraints",
              label: `Restrições & Suprimentos (${data.constraintsMetrics?.criticalCount ? `${data.constraintsMetrics.criticalCount} crít.` : "Lookahead 45d"})`,
            },
            { id: "table", label: "Tabela de Pacotes & Trechos (38 PCTs)" },
            { id: "charts", label: "Gantt, Curva S & Desembolso Mensal" },
            { id: "procurement", label: `Calendário de Suprimentos (${allGates.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubView(tab.id)}
            className={`h-8 rounded-xl px-3.5 text-xs font-semibold cursor-pointer ${
              subView === tab.id
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-VISÃO 1: LINHA DE BALANÇO INTERATIVA (LOB) */}
      {subView === "lob" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Linha de Balanço (LOB) — Planilha Interativa por Pacotes &amp; Equipes
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Edição direta por número do pacote com coloração automática, 4 escalas temporais, deslocamento inteligente em cascata e validação de efetivo/precedência.
            </p>
          </div>

          <EapLobSpreadsheet
            projectId={projectId}
            builtAreaM2={data.builtAreaM2}
            plannedStartDate={data.plannedStartDate}
            analyticsStartDate={an.startDate}
            analyticsEndDate={an.endDate}
            zones={data.zones}
            holidays={data.holidays}
            packages={data.packages}
            servicePackages={data.servicePackages}
            workTeams={data.workTeams}
            initialFloors={data.lobFloors}
            initialAllocations={data.lobAllocations}
            stageLoads={data.eapStageFloorLoads}
            constraintBlocks={data.constraintBlocks}
            onScheduleMutated={() => loadSchedule(true)}
            onOpenSegmentModal={(pkg, seg) => {
              const matchedPkg = data.packages.find((p) => p.id === pkg.id);
              const matchedSeg = matchedPkg?.segments.find((s) => s.id === seg.id) ?? {
                id: seg.id || "",
                zoneCode: seg.zoneCode,
                segmentOrder: seg.segmentOrder,
                startDate: seg.startDate,
                endDate: seg.endDate,
                workingDays: seg.workingDays,
                parallelLane: seg.parallelLane,
                progressPercent: seg.progressPercent ?? 0,
                notes: seg.notes ?? null,
              };
              setEditingSegment({
                packageId: pkg.id,
                packageLabel: `PCT ${String(pkg.packageNumber).padStart(2, "0")} — ${pkg.name}`,
                segment: { ...matchedSeg },
              });
            }}
          />
        </Card>
      )}

      {/* SUB-VISÃO: KANBAN DE RESTRIÇÕES & SUPRIMENTOS (LOOKAHEAD 45D) */}
      {subView === "constraints" && (
        <EapConstraintsKanban
          projectId={projectId}
          floors={data.lobFloors ?? []}
          servicePackages={data.servicePackages ?? []}
          workTeams={data.workTeams ?? []}
          onConstraintsChanged={() => loadSchedule(true)}
        />
      )}

      {/* SUB-VISÃO 2: TABELA EDITÁVEL DE PACOTES & TRECHOS */}
      {subView === "table" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={waveFilter}
              onChange={(e) => setWaveFilter(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="ALL">Todas as Fases ({uniqueWaves.length})</option>
              {uniqueWaves.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="ALL">Todas as Zonas</option>
              {data.zones.map((z) => (
                <option key={z.code} value={z.code}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Pacote</th>
                  <th className="px-3 py-2">Etapas / Predec.</th>
                  <th className="px-3 py-2">Equipes</th>
                  <th className="px-3 py-2">Dias Úteis</th>
                  <th className="px-3 py-2">Trechos Alocados</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredPackages.map((pkg) => (
                  <tr key={pkg.id} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-900 dark:text-zinc-100">
                        PCT {String(pkg.packageNumber).padStart(2, "0")} — {pkg.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400">{pkg.waveName}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      Et: {pkg.linkedStageCodes.join(",")}
                      {pkg.predecessorNumbers.length > 0 && ` · Pr: ${pkg.predecessorNumbers.join(",")}`}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        defaultValue={pkg.teamsCount}
                        onBlur={(e) =>
                          handleUpdatePackageInline(
                            pkg,
                            Math.max(1, Number(e.target.value)),
                            pkg.durationWorkingDays
                          )
                        }
                        className="h-7 w-14 rounded-lg border border-slate-300 bg-white px-1.5 text-right font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        defaultValue={pkg.durationWorkingDays}
                        onBlur={(e) =>
                          handleUpdatePackageInline(
                            pkg,
                            pkg.teamsCount,
                            Math.max(1, Number(e.target.value))
                          )
                        }
                        className="h-7 w-16 rounded-lg border border-slate-300 bg-white px-1.5 text-right font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {pkg.segments.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setEditingSegment({
                                packageId: pkg.id,
                                packageLabel: `PCT ${String(pkg.packageNumber).padStart(2, "0")} — ${pkg.name}`,
                                segment: { ...s },
                              })
                            }
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {s.zoneCode}: {s.startDate}→{s.endDate} ({s.workingDays}d)
                          </button>
                        ))}
                        {pkg.segments.length === 0 && (
                          <span className="text-[10px] text-slate-400">Sem trecho</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busy === pkg.id}
                        onClick={() => handleSplitSecondSegment(pkg)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
                      >
                        + Dividir em 2º Trecho
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* SUB-VISÃO 3: GANTT EXECUTIVO, CURVA S & DESEMBOLSO MENSAL */}
      {subView === "charts" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Curva S Físico-Financeira (% Acumulado & Mensal)
            </h3>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={an.monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cumulativePhysicalPercent"
                    name="Físico Acum. (%)"
                    fill="#2563eb"
                    fillOpacity={0.18}
                    stroke="#2563eb"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="physicalPercentPeriod"
                    name="Avanço Mensal (%)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D]">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Fluxo de Desembolso Mensal (Material × Mão de Obra × Terceiros)
            </h3>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={an.monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val) => fmtBRL(Number(val) || 0)}
                  />
                  <Legend />
                  <Bar dataKey="materialCost" stackId="a" name="Material" fill="#2563eb" />
                  <Bar dataKey="laborCost" stackId="a" name="Mão de Obra" fill="#10b981" />
                  <Bar dataKey="thirdPartyCost" stackId="a" name="Terceiros" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] lg:col-span-2">
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Tabela Consolidada de Desembolso Mensal ({fmtBRL(an.totalCommercialPrice)})
            </h3>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Mês</th>
                    <th className="px-3 py-2 text-right">Material</th>
                    <th className="px-3 py-2 text-right">Mão de Obra</th>
                    <th className="px-3 py-2 text-right">Terceiros</th>
                    <th className="px-3 py-2 text-right">Comercial Mês</th>
                    <th className="px-3 py-2 text-right">Acumulado</th>
                    <th className="px-3 py-2 text-right">Curva S</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums dark:divide-zinc-800">
                  {an.monthlySeries.map((m: MonthlyCashflowPoint) => (
                    <tr key={m.monthKey} className="text-slate-800 dark:text-zinc-200">
                      <td className="px-3 py-2 font-sans font-semibold">{m.label}</td>
                      <td className="px-3 py-2 text-right">{fmtBRL(m.materialCost)}</td>
                      <td className="px-3 py-2 text-right">{fmtBRL(m.laborCost)}</td>
                      <td className="px-3 py-2 text-right">{fmtBRL(m.thirdPartyCost)}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtBRL(m.commercialCost)}</td>
                      <td className="px-3 py-2 text-right">{fmtBRL(m.cumulativeCommercialCost)}</td>
                      <td className="px-3 py-2 text-right text-blue-700 dark:text-blue-400">
                        {m.cumulativePhysicalPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* SUB-VISÃO 4: CALENDÁRIO DE SUPRIMENTOS */}
      {subView === "procurement" && (
        <Card className="rounded-3xl border border-slate-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-[#16161D] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                Calendário de Suprimentos & Contratações (Procurement Gates)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Ordenado por data-limite de disparo de compra conforme antecedência (Lead Time).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGateModal(true)}
              className="h-9 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              + Novo Gatilho de Compra
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Data-Limite</th>
                  <th className="px-3 py-2">Lead Time</th>
                  <th className="px-3 py-2">Pacote</th>
                  <th className="px-3 py-2">Compra / Contratação</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {allGates.map((g) => (
                  <tr key={g.id} className="text-slate-800 dark:text-zinc-200">
                    <td className="px-3 py-2 font-mono font-bold">{g.triggerDate}</td>
                    <td className="px-3 py-2">
                      <Badge tone="amber">-{g.leadTimeDays}d</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      PCT {String(g.packageNumber).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2 font-medium">{g.title}</td>
                    <td className="px-3 py-2">
                      <select
                        value={g.status}
                        disabled={busy === g.id}
                        onChange={(e) => handleUpdateGateStatus(g.id, e.target.value)}
                        className={INPUT_CLASS}
                      >
                        <option value="PENDENTE">PENDENTE</option>
                        <option value="EM_COTACAO">EM COTAÇÃO</option>
                        <option value="COMPRADO">COMPRADO</option>
                        <option value="ENTREGUE">ENTREGUE</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {allGates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Clique em &quot;Gerar / Recalcular da EAP&quot; para popular os gatilhos de suprimentos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL EDIÇÃO DE TRECHO LOB */}
      {editingSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveSegmentModal}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 dark:border-zinc-800 dark:bg-[#16161D]"
          >
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Editar Trecho — {editingSegment.packageLabel}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Início</label>
                <input
                  type="date"
                  required
                  value={editingSegment.segment.startDate}
                  onChange={(e) =>
                    setEditingSegment({
                      ...editingSegment,
                      segment: { ...editingSegment.segment, startDate: e.target.value },
                    })
                  }
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Término</label>
                <input
                  type="date"
                  required
                  value={editingSegment.segment.endDate}
                  onChange={(e) =>
                    setEditingSegment({
                      ...editingSegment,
                      segment: { ...editingSegment.segment, endDate: e.target.value },
                    })
                  }
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Dias Úteis</label>
                <input
                  type="number"
                  min={1}
                  value={editingSegment.segment.workingDays}
                  onChange={(e) =>
                    setEditingSegment({
                      ...editingSegment,
                      segment: { ...editingSegment.segment, workingDays: Number(e.target.value) },
                    })
                  }
                  className={`${INPUT_CLASS} mt-1 w-full font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Raia Paralela</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={editingSegment.segment.parallelLane}
                  onChange={(e) =>
                    setEditingSegment({
                      ...editingSegment,
                      segment: { ...editingSegment.segment, parallelLane: Number(e.target.value) },
                    })
                  }
                  className={`${INPUT_CLASS} mt-1 w-full font-mono`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Observações</label>
              <input
                type="text"
                value={editingSegment.segment.notes || ""}
                onChange={(e) =>
                  setEditingSegment({
                    ...editingSegment,
                    segment: { ...editingSegment.segment, notes: e.target.value },
                  })
                }
                className={`${INPUT_CLASS} mt-1 w-full`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSegment(null)}
                className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy === "seg-save"}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                Salvar Trecho
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NOVO GATILHO DE COMPRA */}
      {showGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateGate}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 dark:border-zinc-800 dark:bg-[#16161D]"
          >
            <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
              Novo Gatilho de Compra / Contratação
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Pacote LOB</label>
              <select
                value={newGate.packageId}
                onChange={(e) => setNewGate({ ...newGate, packageId: e.target.value })}
                className={`${INPUT_CLASS} mt-1 w-full`}
              >
                {data.packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    PCT {String(p.packageNumber).padStart(2, "0")} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Descrição</label>
              <input
                type="text"
                required
                value={newGate.title}
                onChange={(e) => setNewGate({ ...newGate, title: e.target.value })}
                placeholder="Ex.: Compra de Portas de Madeira"
                className={`${INPUT_CLASS} mt-1 w-full`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Antecedência (dias)
                </label>
                <input
                  type="number"
                  min={0}
                  value={newGate.leadTimeDays}
                  onChange={(e) => setNewGate({ ...newGate, leadTimeDays: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Data-Limite</label>
                <input
                  type="date"
                  required
                  value={newGate.triggerDate}
                  onChange={(e) => setNewGate({ ...newGate, triggerDate: e.target.value })}
                  className={`${INPUT_CLASS} mt-1 w-full`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGateModal(false)}
                className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy === "new-gate"}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                Adicionar Gatilho
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
