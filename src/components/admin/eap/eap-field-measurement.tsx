"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EapMeasurementChartsPanel } from "@/components/admin/eap/eap-measurement-charts-panel";
import { EapSiteDiary } from "@/components/admin/eap/eap-site-diary";
import { buildFieldMeasurementChartData } from "@/lib/eap-measurement-charts";
import {
  compressImageFileForField,
  readVideoDurationSeconds,
} from "@/lib/media-compress";
import type {
  FieldMeasurementBulletinSummary,
  FieldMeasurementFloorSummary,
  FieldMeasurementServiceRow,
  FieldMeasurementSnapshot,
  MeasurementEvidenceDTO,
} from "@/server/eap/field-measurement";

interface EapFieldMeasurementProps {
  projectId: string;
  onSaved?: () => void;
}

type StatusFilter = "ALL" | "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO" | "IMPEDIDO";

const WEATHER_OPTIONS = [
  { id: "SOL", label: "☀ Sol" },
  { id: "NUBLADO", label: "⛅ Nublado" },
  { id: "CHUVA_PARCIAL", label: "🌦 Chuva Parcial" },
  { id: "CHUVA_INTENSA", label: "🌧 Chuva Intensa" },
] as const;

const STATUS_BADGE: Record<string, { label: string; tone: "neutral" | "amber" | "green" | "red" }> = {
  PENDENTE: { label: "Pendente", tone: "neutral" },
  EM_ANDAMENTO: { label: "Em Andamento", tone: "amber" },
  CONCLUIDO: { label: "Concluído", tone: "green" },
  IMPEDIDO: { label: "Impedido", tone: "red" },
};

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function EapFieldMeasurement({ projectId, onSaved }: EapFieldMeasurementProps) {
  const [snapshot, setSnapshot] = useState<FieldMeasurementSnapshot | null>(null);
  const [rows, setRows] = useState<FieldMeasurementServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [activeSection, setActiveSection] = useState<"medicao" | "diario">("medicao");
  const [searchQuery, setSearchQuery] = useState("");

  const [referenceDate, setReferenceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [inspectorName, setInspectorName] = useState("");
  const [weatherCondition, setWeatherCondition] = useState<string>("SOL");
  const [generalNotes, setGeneralNotes] = useState("");

  const [evidences, setEvidences] = useState<MeasurementEvidenceDTO[]>([]);
  const [uploadingRowKey, setUploadingRowKey] = useState<string | null>(null);
  const [showChartsPanel, setShowChartsPanel] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewBulletinTarget, setPreviewBulletinTarget] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [lightboxEvidence, setLightboxEvidence] =
    useState<MeasurementEvidenceDTO | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/measurements`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setSnapshot(json);
        setRows(json.items ?? []);
        setEvidences(json.evidences ?? []);
        const draft = (json.bulletins as FieldMeasurementBulletinSummary[] | undefined)?.find(
          (b) => b.status === "RASCUNHO"
        );
        if (draft) {
          setReferenceDate(draft.referenceDate);
          setInspectorName(draft.inspectorName ?? "");
          setWeatherCondition(draft.weatherCondition ?? "SOL");
          setGeneralNotes(draft.generalNotes ?? "");
        }
      } else {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível carregar as medições de canteiro.",
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Erro de conexão ao carregar medições." });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  function updateRowPlannedQty(rowKey: string, nextPlannedQty: number) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) return row;
        const safePlanned = Math.max(0.01, round2(nextPlannedQty));
        const accumulatedQty = round2(row.previousExecutedQty + row.currentExecutedQty);
        const pendingQty = round2(Math.max(0, safePlanned - accumulatedQty));
        const accumulatedPct = Math.min(100, round2((accumulatedQty / safePlanned) * 100));
        const plannedAmount = round2(safePlanned * row.unitPrice);
        const accumulatedAmount = round2(Math.min(safePlanned, accumulatedQty) * row.unitPrice);
        const pendingAmount = round2(pendingQty * row.unitPrice);
        const derivedStatus =
          row.status === "IMPEDIDO"
            ? "IMPEDIDO"
            : accumulatedPct >= 100
              ? "CONCLUIDO"
              : accumulatedQty > 0
                ? "EM_ANDAMENTO"
                : "PENDENTE";
        return {
          ...row,
          plannedQty: safePlanned,
          pendingQty,
          accumulatedPct,
          plannedAmount,
          accumulatedAmount,
          pendingAmount,
          status: derivedStatus,
        };
      })
    );
  }

  function updateRowCurrentQty(rowKey: string, nextCurrentQty: number, nextStatus?: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) return row;
        const safeCurrent = Math.max(0, round2(nextCurrentQty));
        const accumulatedQty = round2(row.previousExecutedQty + safeCurrent);
        const pendingQty = round2(Math.max(0, row.plannedQty - accumulatedQty));
        const accumulatedPct =
          row.plannedQty > 0
            ? Math.min(100, round2((accumulatedQty / row.plannedQty) * 100))
            : 0;
        const measuredAmount = round2(safeCurrent * row.unitPrice);
        const accumulatedAmount = round2(Math.min(row.plannedQty, accumulatedQty) * row.unitPrice);
        const pendingAmount = round2(pendingQty * row.unitPrice);
        const derivedStatus =
          nextStatus === "IMPEDIDO"
            ? "IMPEDIDO"
            : accumulatedPct >= 100 && row.plannedQty > 0
              ? "CONCLUIDO"
              : accumulatedQty > 0
                ? "EM_ANDAMENTO"
                : "PENDENTE";

        return {
          ...row,
          currentExecutedQty: safeCurrent,
          accumulatedQty,
          pendingQty,
          accumulatedPct,
          measuredAmount,
          accumulatedAmount,
          pendingAmount,
          status: derivedStatus,
        };
      })
    );
  }

  function applyQuickPercent(row: FieldMeasurementServiceRow, targetPct: number) {
    const targetAccumulated = round2((row.plannedQty * targetPct) / 100);
    const neededCurrent = Math.max(0, round2(targetAccumulated - row.previousExecutedQty));
    updateRowCurrentQty(row.rowKey, neededCurrent);
  }

  const liveSummary = useMemo(() => {
    const plannedLobPct = snapshot?.summary.plannedLobPct ?? 0;
    let totalPlannedValue = 0;
    let totalAccumulatedValue = 0;
    let totalMeasuredValue = 0;
    let totalPendingValue = 0;
    let completedItemsCount = 0;

    for (const r of rows) {
      totalPlannedValue += r.plannedAmount;
      totalAccumulatedValue += r.accumulatedAmount;
      totalMeasuredValue += r.measuredAmount;
      totalPendingValue += r.pendingAmount;
      if (r.status === "CONCLUIDO") completedItemsCount += 1;
    }

    totalPlannedValue = round2(totalPlannedValue);
    totalAccumulatedValue = round2(totalAccumulatedValue);
    totalMeasuredValue = round2(totalMeasuredValue);
    totalPendingValue = round2(totalPendingValue);

    const physicalProgressPct =
      totalPlannedValue > 0
        ? Math.min(100, round2((totalAccumulatedValue / totalPlannedValue) * 100))
        : 0;
    const deviationPct = round2(physicalProgressPct - plannedLobPct);

    return {
      totalPlannedValue,
      totalAccumulatedValue,
      totalMeasuredValue,
      totalPendingValue,
      physicalProgressPct,
      plannedLobPct,
      deviationPct,
      completedItemsCount,
      totalItemsCount: rows.length,
    };
  }, [rows, snapshot?.summary.plannedLobPct]);

  const liveFloorSummaries = useMemo((): FieldMeasurementFloorSummary[] => {
    const floors = snapshot?.floors ?? [];
    const map = new Map<string, FieldMeasurementFloorSummary>();
    for (const f of floors) {
      map.set(f.floorId, {
        floorId: f.floorId,
        floorName: f.floorName,
        floorOrder: f.floorOrder,
        itemsCount: 0,
        completedCount: 0,
        plannedAmount: 0,
        accumulatedAmount: 0,
        pendingAmount: 0,
        progressPct: 0,
      });
    }
    for (const r of rows) {
      const agg = map.get(r.floorId) ?? {
        floorId: r.floorId,
        floorName: r.floorName,
        floorOrder: r.floorOrder,
        itemsCount: 0,
        completedCount: 0,
        plannedAmount: 0,
        accumulatedAmount: 0,
        pendingAmount: 0,
        progressPct: 0,
      };
      agg.itemsCount += 1;
      if (r.status === "CONCLUIDO") agg.completedCount += 1;
      agg.plannedAmount = round2(agg.plannedAmount + r.plannedAmount);
      agg.accumulatedAmount = round2(agg.accumulatedAmount + r.accumulatedAmount);
      agg.pendingAmount = round2(agg.pendingAmount + r.pendingAmount);
      map.set(r.floorId, agg);
    }
    return Array.from(map.values())
      .sort((a, b) => a.floorOrder - b.floorOrder)
      .map((f) => ({
        ...f,
        progressPct:
          f.plannedAmount > 0
            ? Math.min(100, round2((f.accumulatedAmount / f.plannedAmount) * 100))
            : 0,
      }));
  }, [rows, snapshot?.floors]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedFloor !== "ALL" && r.floorId !== selectedFloor) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (q && !`${r.serviceLabel} ${r.floorName} ${r.teamCode || ""}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, selectedFloor, statusFilter, searchQuery]);

  async function handleUploadEvidence(
    row: FieldMeasurementServiceRow,
    fileList: FileList | null
  ) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingRowKey(row.rowKey);
    setFeedback(null);

    try {
      const activeDraft = snapshot?.bulletins.find((b) => b.status === "RASCUNHO");
      for (const rawFile of files) {
        const isVideo = rawFile.type.startsWith("video/");
        let preparedFile = rawFile;
        let durationSec: number | null = null;

        if (rawFile.type.startsWith("image/")) {
          preparedFile = await compressImageFileForField(rawFile, 1280, 0.78);
        } else if (isVideo) {
          if (rawFile.size > 25 * 1024 * 1024) {
            setFeedback({
              type: "error",
              text: `O vídeo "${rawFile.name}" excede 25 MB. Grave um trecho mais curto.`,
            });
            continue;
          }
          durationSec = await readVideoDurationSeconds(rawFile);
        }

        const fd = new FormData();
        fd.append("file", preparedFile);
        fd.append("rowKey", row.rowKey);
        fd.append("floorId", row.floorId);
        fd.append("floorName", row.floorName);
        fd.append("serviceLabel", row.serviceLabel);
        if (row.eapItemId) fd.append("eapItemId", row.eapItemId);
        if (activeDraft?.id) fd.append("bulletinId", activeDraft.id);
        if (durationSec !== null) fd.append("durationSec", String(durationSec));

        const res = await fetch(
          `/api/eap/projects/${projectId}/measurements/evidence`,
          { method: "POST", body: fd }
        );
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setFeedback({
            type: "error",
            text: json.error || "Não foi possível anexar a evidência.",
          });
          continue;
        }
        setEvidences((prev) => [json.evidence as MeasurementEvidenceDTO, ...prev]);
        setFeedback({
          type: "success",
          text: `${isVideo ? "Vídeo" : "Foto"} anexado em "${row.serviceLabel}".`,
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Erro de conexão ao enviar mídia." });
    } finally {
      setUploadingRowKey(null);
    }
  }

  async function handleDeleteEvidence(evidenceId: string) {
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/eap/projects/${projectId}/measurements/evidence/${evidenceId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setEvidences((prev) => prev.filter((e) => e.id !== evidenceId));
        if (lightboxEvidence?.id === evidenceId) setLightboxEvidence(null);
      }
    } catch {
      setFeedback({ type: "error", text: "Erro ao remover evidência." });
    }
  }

  const evidencesByRowKey = useMemo(() => {
    const map = new Map<string, MeasurementEvidenceDTO[]>();
    for (const ev of evidences) {
      const list = map.get(ev.rowKey) ?? [];
      list.push(ev);
      map.set(ev.rowKey, list);
    }
    return map;
  }, [evidences]);

  const liveChartData = useMemo(
    () =>
      buildFieldMeasurementChartData({
        summary: {
          totalPlannedValue: liveSummary.totalPlannedValue,
          totalAccumulatedValue: liveSummary.totalAccumulatedValue,
          totalMeasuredValue: liveSummary.totalMeasuredValue,
          totalPendingValue: liveSummary.totalPendingValue,
          plannedLobPct: liveSummary.plannedLobPct,
        },
        floorSummaries: liveFloorSummaries,
        items: rows,
        plannedLobPctByFloor: snapshot?.chartData?.floorComparison.reduce<
          Record<string, number>
        >((acc, fc) => {
          acc[fc.floorId] = fc.plannedPct;
          return acc;
        }, {}),
      }),
    [liveSummary, liveFloorSummaries, rows, snapshot?.chartData?.floorComparison]
  );

  async function handleSaveBulletin(targetStatus: "RASCUNHO" | "APROVADO") {
    if (rows.length === 0) {
      setFeedback({
        type: "error",
        text: "Preencha quantidades na Planilha EAP antes de registrar medições em campo.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const activeDraft = snapshot?.bulletins.find((b) => b.status === "RASCUNHO");
      const res = await fetch(`/api/eap/projects/${projectId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulletinId: activeDraft?.id,
          referenceDate,
          status: targetStatus,
          inspectorName: inspectorName.trim() || null,
          weatherCondition,
          generalNotes: generalNotes.trim() || null,
          entries: rows.map((r) => ({
            floorId: r.floorId,
            floorName: r.floorName,
            packageNumber: r.packageNumber,
            teamCode: r.teamCode,
            eapItemId: r.eapItemId,
            serviceLabel: r.serviceLabel,
            unit: r.unit,
            plannedQty: r.plannedQty,
            previousExecutedQty: r.previousExecutedQty,
            currentExecutedQty: r.currentExecutedQty,
            unitPrice: r.unitPrice,
            status: r.status,
            fieldNote: r.fieldNote,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao salvar boletim de medição." });
        return;
      }
      setFeedback({
        type: "success",
        text:
          targetStatus === "APROVADO"
            ? `Boletim ${json.bulletin.bulletinCode} aprovado e fechado com sucesso!`
            : `Rascunho do Boletim ${json.bulletin.bulletinCode} salvo.`,
      });
      await loadSnapshot();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !snapshot) {
    return (
      <Card className="rounded-3xl border border-slate-200/90 bg-white/90 p-8 text-center text-xs text-slate-500 backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90 dark:text-zinc-400">
        Carregando Medição no Canteiro (ArqVértice OS)...
      </Card>
    );
  }

  const nextCode = snapshot?.nextBulletinCode ?? "BM-01";
  const latestBulletinId = snapshot?.bulletins[0]?.id ?? "latest";

  return (
    <div className="space-y-4">
      {/* Navegação interna de 5. Medição (Medição × Diário de Obra) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSection("medicao")}
            className={`h-8 rounded-xl px-3.5 text-xs font-semibold cursor-pointer ${
              activeSection === "medicao"
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            Medição &amp; Boletim
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("diario")}
            className={`h-8 rounded-xl px-3.5 text-xs font-semibold cursor-pointer ${
              activeSection === "diario"
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            Diário de Obra
          </button>
        </div>
      </div>

      {activeSection === "diario" ? (
        <EapSiteDiary projectId={projectId} />
      ) : (
        <>
          {/* Resumo Executivo Didático para o Cliente */}
          <Card className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                  Resumo Executivo da Obra para o Cliente
                </h3>
                <p className="mt-1 text-xs text-slate-700 dark:text-zinc-300">
                  Até o momento foram concluídos{" "}
                  <strong>{liveSummary.physicalProgressPct.toFixed(1)}%</strong> dos serviços previstos (
                  <strong>{fmtBRL(liveSummary.totalAccumulatedValue)}</strong> executados), restando{" "}
                  <strong>{fmtBRL(liveSummary.totalPendingValue)}</strong> para conclusão total.{" "}
                  Situação do prazo:{" "}
                  <strong>
                    {liveSummary.deviationPct > 1
                      ? "Adiantado"
                      : liveSummary.deviationPct >= -2
                        ? "No Prazo"
                        : "Atenção (Recuperar)"}
                  </strong>{" "}
                  ({liveSummary.deviationPct >= 0 ? "+" : ""}
                  {liveSummary.deviationPct.toFixed(1)} p.p. vs Linha de Balanço).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("diario")}
                className="h-8 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-300"
              >
                Abrir Diário de Obra
              </button>
            </div>
          </Card>

      {/* Painel Resumo "Feito × Pendente" */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Avanço Físico Realizado
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {liveSummary.physicalProgressPct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400">
            {liveSummary.completedItemsCount}/{liveSummary.totalItemsCount} serviços 100%
          </p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Previsto LOB
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-zinc-100">
            {liveSummary.plannedLobPct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400">Meta na matriz LOB</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Desvio Físico
          </p>
          <p
            className={`mt-1 font-mono text-xl font-bold ${
              liveSummary.deviationPct >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {liveSummary.deviationPct >= 0 ? "+" : ""}
            {liveSummary.deviationPct.toFixed(1)} p.p.
          </p>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400">Realizado × LOB</p>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total Medido (Período)
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-blue-700 dark:text-blue-400">
            {fmtBRL(liveSummary.totalMeasuredValue)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400">
            Acumulado: {fmtBRL(liveSummary.totalAccumulatedValue)}
          </p>
        </Card>

        <Card className="col-span-2 lg:col-span-1 rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Saldo Pendente
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-amber-700 dark:text-amber-300">
            {fmtBRL(liveSummary.totalPendingValue)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400">A executar na obra</p>
        </Card>
      </div>

      {/* Cabeçalho do Boletim + Exportação */}
      <Card className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-xs space-y-3 dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <img
              src="/logo.png"
              alt="ArqVértice Studio"
              className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  ArqVértice OS — Medição no Canteiro ({nextCode})
                </h3>
              <Badge tone="blue">Mobile-First</Badge>
              {snapshot?.isParametricFallback && (
                <Badge tone="amber">Estrutura Paramétrica Editável</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-700 dark:text-zinc-300">
              Registre rapidamente o avanço feito em campo e gere boletins automáticos em PDF.
            </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSaveBulletin("RASCUNHO")}
              disabled={saving}
              className="apple-glass-btn h-9 px-3.5 py-0 text-xs font-semibold cursor-pointer"
            >
              {saving ? "Salvando..." : `💾 Salvar Rascunho (${nextCode})`}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviewBulletinTarget({ id: latestBulletinId, code: nextCode });
                setShowPreviewModal(true);
              }}
              className="h-9 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 cursor-pointer dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-200"
            >
              👁 Pré-visualizar Boletim
            </button>
            <button
              type="button"
              onClick={() => void handleSaveBulletin("APROVADO")}
              disabled={saving}
              className="h-9 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-[0_2px_10px_-2px_rgba(5,150,105,0.28)] transition-all duration-150 active:scale-[0.985] hover:bg-emerald-700 cursor-pointer"
            >
              {saving ? "Fechando..." : `✓ Fechar Boletim (${nextCode})`}
            </button>
            <a
              href={`/api/eap/projects/${projectId}/measurements/${latestBulletinId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="apple-primary-btn h-9 px-3.5 py-0 text-xs font-semibold"
            >
              📄 Exportar Boletim PDF
            </a>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-4">
          <input
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <input
            placeholder="Inspetor / Responsável"
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <select
            value={weatherCondition}
            onChange={(e) => setWeatherCondition(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {WEATHER_OPTIONS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Observações de campo..."
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
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
      </Card>

      {/* Painel Gráfico de Evolução (Colapsável) */}
      <Card className="rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Painel Gráfico de Evolução
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Avanço por pavimento, composição financeira e distribuição dos serviços ({evidences.length} evidência(s) capturada(s)).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowChartsPanel((v) => !v)}
            className="h-8 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {showChartsPanel ? "Recolher Gráficos ▴" : "Exibir Gráficos ▾"}
          </button>
        </div>
        {showChartsPanel && (
          <div className="mt-4">
            <EapMeasurementChartsPanel chartData={liveChartData} compact />
          </div>
        )}
      </Card>

      {/* Seletor Rápido por Pavimento + Filtros Touch-Friendly */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedFloor("ALL")}
            className={`h-9 shrink-0 rounded-xl px-3.5 text-xs font-semibold cursor-pointer ${
              selectedFloor === "ALL"
                ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                : "border border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            Todos ({rows.length})
          </button>
          {liveFloorSummaries.map((fl) => (
            <button
              key={fl.floorId}
              type="button"
              onClick={() => setSelectedFloor(fl.floorId)}
              className={`h-9 shrink-0 rounded-xl px-3 text-xs font-semibold cursor-pointer ${
                selectedFloor === fl.floorId
                  ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                  : "border border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {fl.floorName} ({fl.progressPct.toFixed(0)}%)
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="ALL">Todos Status</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDO">Concluídos</option>
            <option value="IMPEDIDO">Impedidos</option>
          </select>
          <input
            placeholder="Buscar serviço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Lista Mobile-First de Serviços (Feito × Pendente) */}
      {filteredRows.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-[#16161D] dark:text-zinc-400">
          Nenhum serviço com quantidade prevista neste filtro. Preencha quantidades na Etapa 2 (Planilha EAP) para medir em campo.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredRows.map((row) => {
            const stBadge = STATUS_BADGE[row.status] ?? STATUS_BADGE.PENDENTE;
            const rowEvidences = evidencesByRowKey.get(row.rowKey) ?? [];
            const photoCount = rowEvidences.filter((e) => e.mediaType === "IMAGE").length;
            const videoCount = rowEvidences.filter((e) => e.mediaType === "VIDEO").length;
            const isUploading = uploadingRowKey === row.rowKey;

            return (
              <Card
                key={row.rowKey}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xs space-y-3.5 dark:border-zinc-800 dark:bg-[#171720]"
              >
                {/* ZONA 1 — TOPO: Código/Nome + Badges + % e Valor Medido */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-snug text-slate-950 dark:text-zinc-100">
                      {row.serviceLabel}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{row.floorName}</Badge>
                      {row.packageNumber && (
                        <Badge tone="blue">
                          {row.teamCode ? `Equipe ${row.teamCode} · ` : ""}Pacote {row.packageNumber}
                        </Badge>
                      )}
                      <Badge tone={stBadge.tone}>{stBadge.label}</Badge>
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono">
                    <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                      {row.accumulatedPct.toFixed(0)}%
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                      {fmtBRL(row.measuredAmount)}
                    </div>
                  </div>
                </div>

                {/* ZONA 2 — MEIO: Barra de Progresso + Grid Uniforme de 4 Colunas */}
                <div className="space-y-2.5">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-100 dark:bg-zinc-800">
                    <div
                      style={{ width: `${Math.min(100, row.accumulatedPct)}%` }}
                      className="h-full rounded-full bg-emerald-600 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11px] sm:grid-cols-4">
                    <div>
                      <span className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                        Previsto ({row.unit})
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={row.plannedQty}
                        onChange={(e) =>
                          updateRowPlannedQty(row.rowKey, Number(e.target.value) || 0.01)
                        }
                        aria-label={`Quantidade prevista ${row.serviceLabel}`}
                        className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-2.5 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                        Anterior
                      </span>
                      <div className="mt-1 flex h-10 items-center rounded-xl border border-slate-200/80 bg-slate-50/70 px-2.5 font-mono text-xs font-bold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                        {row.previousExecutedQty.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-blue-700 dark:text-amber-300">
                        Atual (Campo)
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.currentExecutedQty}
                        onChange={(e) =>
                          updateRowCurrentQty(row.rowKey, Math.max(0, Number(e.target.value) || 0))
                        }
                        aria-label={`Quantidade atual em campo ${row.serviceLabel}`}
                        className="mt-1 h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-2.5 font-mono text-sm font-bold text-slate-950 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                        Saldo Pendente
                      </span>
                      <div className="mt-1 flex h-10 items-center rounded-xl border border-amber-200/80 bg-amber-50/60 px-2.5 font-mono text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                        {row.pendingQty.toFixed(2)} {row.unit}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ZONA 3 — RODAPÉ: Atalhos Rápidos + Evidências (Foto, Vídeo, Galeria) & Miniaturas */}
                <div className="space-y-2.5 border-t border-slate-100 pt-2.5 dark:border-zinc-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyQuickPercent(row, 25)}
                        className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        +25%
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPercent(row, 50)}
                        className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        +50%
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPercent(row, 100)}
                        className="h-8 rounded-lg bg-emerald-600/15 px-2.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-600/25 cursor-pointer dark:text-emerald-300"
                      >
                        ✓ 100% Concluído
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-200">
                        <span>📷 Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => {
                            void handleUploadEvidence(row, e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <label className="inline-flex h-8 items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 text-[11px] font-semibold text-purple-800 hover:bg-purple-100 cursor-pointer dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-200">
                        <span>🎥 Vídeo</span>
                        <input
                          type="file"
                          accept="video/*"
                          capture="environment"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => {
                            void handleUploadEvidence(row, e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <label className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        <span>📎 Galeria</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => {
                            void handleUploadEvidence(row, e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {isUploading && (
                    <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                      Comprimindo e enviando evidência para o boletim...
                    </p>
                  )}

                  {rowEvidences.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                        {photoCount} foto(s) · {videoCount} vídeo(s) anexado(s)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {rowEvidences.map((ev) => (
                          <div
                            key={ev.id}
                            className="group relative h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <button
                              type="button"
                              onClick={() => setLightboxEvidence(ev)}
                              className="h-full w-full cursor-pointer"
                              title={`Abrir ${ev.mediaType === "VIDEO" ? "vídeo" : "foto"}: ${ev.fileName}`}
                            >
                              {ev.mediaType === "IMAGE" ? (
                                <img
                                  src={ev.url}
                                  alt={ev.fileName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900 text-white">
                                  <span className="text-sm">▶</span>
                                  <span className="text-[9px] font-mono">
                                    {ev.durationSec ? `${Math.round(ev.durationSec)}s` : "VÍDEO"}
                                  </span>
                                </div>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteEvidence(ev.id)}
                              title="Remover evidência"
                              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white opacity-90 hover:bg-rose-700 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Histórico de Boletins */}
      {snapshot && snapshot.bulletins.length > 0 && (
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2 dark:border-zinc-800 dark:bg-[#16161D]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            Histórico de Boletins de Medição
          </h4>
          <div className="divide-y divide-slate-200/80 dark:divide-zinc-800">
            {snapshot.bulletins.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <strong className="font-mono text-slate-950 dark:text-zinc-100">
                    {b.bulletinCode}
                  </strong>
                  <Badge tone={b.status === "APROVADO" ? "green" : "amber"}>{b.status}</Badge>
                  <span className="text-slate-600 dark:text-zinc-400">
                    {b.referenceDate} · {b.physicalProgressPct.toFixed(1)}% ·{" "}
                    {fmtBRL(b.totalMeasuredValue)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewBulletinTarget({ id: b.id, code: b.bulletinCode });
                      setShowPreviewModal(true);
                    }}
                    className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer dark:text-blue-400"
                  >
                    👁 Pré-visualizar ({b.bulletinCode})
                  </button>
                  <a
                    href={`/api/eap/projects/${projectId}/measurements/${b.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-indigo-700 hover:underline dark:text-indigo-400"
                  >
                    📄 Abrir PDF ({b.bulletinCode})
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MODAL LIGHTBOX / PLAYER PARA FOTO E VÍDEO */}
      {lightboxEvidence &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setLightboxEvidence(null)}
          >
            <div
              className="relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{lightboxEvidence.serviceLabel}</p>
                  <p className="text-[11px] text-zinc-400">
                    {lightboxEvidence.floorName} · {lightboxEvidence.fileName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxEvidence(null)}
                  className="h-8 rounded-xl bg-white/10 px-3 text-xs font-semibold hover:bg-white/20 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
              <div className="flex flex-1 items-center justify-center overflow-auto bg-black p-4">
                {lightboxEvidence.mediaType === "IMAGE" ? (
                  <img
                    src={lightboxEvidence.url}
                    alt={lightboxEvidence.fileName}
                    className="max-h-[72dvh] max-w-full rounded-xl object-contain"
                  />
                ) : (
                  <video
                    src={lightboxEvidence.url}
                    controls
                    playsInline
                    autoPlay
                    className="max-h-[72dvh] max-w-full rounded-xl"
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DO BOLETIM ANTES DE EXPORTAR EM PDF */}
      {showPreviewModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pré-visualização do Boletim de Medição"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          >
            <div className="flex h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              {/* Cabeçalho Fixo do Modal */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                    Pré-visualização Fiel do Boletim ({previewBulletinTarget?.code ?? nextCode})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Confira os gráficos, serviços medidos e registro fotográfico antes de baixar o PDF final.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="h-8 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
                >
                  × Fechar
                </button>
              </div>

              {/* Corpo Rolável Simulando Folha A4 */}
              <div className="flex-1 overflow-y-auto bg-slate-100/80 p-4 sm:p-6 dark:bg-zinc-900/60">
                <div className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  {/* Cabeçalho Institucional com Logo Oficial */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800">
                    <div className="flex items-center gap-3.5">
                      <img
                        src="/logo.png"
                        alt="ArqVértice Studio"
                        className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 dark:border-zinc-700"
                      />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                          ArqVértice OS · Boletim de Medição de Obra
                        </p>
                        <h4 className="text-base font-extrabold text-slate-950 dark:text-zinc-50">
                          {snapshot?.projectName || "Obra em Acompanhamento"} — {previewBulletinTarget?.code ?? nextCode}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-zinc-400">
                          Vistoria: {referenceDate} · Inspetor: {inspectorName || "Equipe Técnica"} · Clima:{" "}
                          {WEATHER_OPTIONS.find((w) => w.id === weatherCondition)?.label || weatherCondition}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* KPIs do Boletim */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-xl border border-slate-200 bg-emerald-50/60 p-3 dark:border-zinc-800 dark:bg-emerald-950/20">
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                        Avanço Físico Realizado
                      </p>
                      <p className="mt-1 font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                        {liveSummary.physicalProgressPct.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                        Previsto Linha de Balanço
                      </p>
                      <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-zinc-100">
                        {liveSummary.plannedLobPct.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                        Desvio Físico
                      </p>
                      <p className="mt-1 font-mono text-base font-bold text-blue-700 dark:text-blue-400">
                        {liveSummary.deviationPct >= 0 ? "+" : ""}
                        {liveSummary.deviationPct.toFixed(1)} p.p.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-blue-50/50 p-3 dark:border-zinc-800 dark:bg-blue-950/20">
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                        Total Medido no Período
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold text-blue-800 dark:text-blue-300">
                        {fmtBRL(liveSummary.totalMeasuredValue)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-amber-50/50 p-3 dark:border-zinc-800 dark:bg-amber-950/20">
                      <p className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                        Saldo Pendente
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold text-amber-800 dark:text-amber-300">
                        {fmtBRL(liveSummary.totalPendingValue)}
                      </p>
                    </div>
                  </div>

                  {/* Gráficos Executivos */}
                  <EapMeasurementChartsPanel chartData={liveChartData} compact />

                  {/* Tabela de Serviços Medidos */}
                  <div>
                    <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      Serviços Medidos no Período ({rows.length})
                    </h5>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                      <table className="w-full min-w-[740px] border-collapse text-left text-[11px]">
                        <thead className="bg-slate-900 text-white">
                          <tr>
                            <th className="px-2.5 py-2">Etapa / Serviço</th>
                            <th className="px-2 py-2">Pavimento</th>
                            <th className="px-2 py-2 text-center">Unidade</th>
                            <th className="px-2 py-2 text-right">Previsto</th>
                            <th className="px-2 py-2 text-right">Anterior</th>
                            <th className="px-2 py-2 text-right">Atual</th>
                            <th className="px-2 py-2 text-right">Acumulado %</th>
                            <th className="px-2 py-2 text-right">Saldo Pendente</th>
                            <th className="px-2.5 py-2 text-right">Valor Medido R$</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {rows.map((r) => (
                            <tr key={r.rowKey}>
                              <td className="px-2.5 py-1.5 font-medium text-slate-900 dark:text-zinc-100">
                                {r.serviceLabel}
                              </td>
                              <td className="px-2 py-1.5 text-slate-600 dark:text-zinc-400">
                                {r.floorName}
                              </td>
                              <td className="px-2 py-1.5 text-center">{r.unit}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{r.plannedQty.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{r.previousExecutedQty.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right font-mono font-bold text-blue-700 dark:text-blue-400">
                                {r.currentExecutedQty.toFixed(2)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">{r.accumulatedPct.toFixed(1)}%</td>
                              <td className="px-2 py-1.5 text-right font-mono">{r.pendingQty.toFixed(2)}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-semibold">
                                {fmtBRL(r.measuredAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Anexo Fotográfico de Campo */}
                  <div>
                    <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      Anexo Fotográfico de Campo ({evidences.filter((e) => e.mediaType === "IMAGE").length} foto(s) ·{" "}
                      {evidences.filter((e) => e.mediaType === "VIDEO").length} vídeo(s))
                    </h5>
                    {evidences.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-zinc-800">
                        Nenhuma foto ou vídeo anexado até o momento.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {evidences.map((ev) => (
                          <div
                            key={ev.id}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            {ev.mediaType === "IMAGE" ? (
                              <img
                                src={ev.url}
                                alt={ev.serviceLabel}
                                className="h-36 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-36 w-full flex-col items-center justify-center bg-zinc-900 text-white">
                                <span className="text-xl">🎥</span>
                                <span className="mt-1 text-xs font-semibold">
                                  Vídeo anexado no portal
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {ev.durationSec ? `${Math.round(ev.durationSec)}s` : ev.fileName}
                                </span>
                              </div>
                            )}
                            <div className="p-2.5">
                              <p className="truncate text-[11px] font-bold text-slate-900 dark:text-zinc-100">
                                {ev.serviceLabel}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                                {ev.floorName} · {ev.capturedAt.slice(0, 10)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo com Ações */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="h-9 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  Voltar e Editar
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      await handleSaveBulletin("APROVADO");
                      setShowPreviewModal(false);
                    }}
                    className="h-9 rounded-xl border border-emerald-600 bg-emerald-50 px-4 text-xs font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    ✓ Fechar Boletim
                  </button>
                  <a
                    href={`/api/eap/projects/${projectId}/measurements/${previewBulletinTarget?.id ?? latestBulletinId}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-zinc-950"
                  >
                    📄 Confirmar e Baixar PDF
                  </a>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
        </>
      )}
    </div>
  );
}
