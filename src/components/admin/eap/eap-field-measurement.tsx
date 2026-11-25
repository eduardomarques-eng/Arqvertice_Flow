"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  FieldMeasurementBulletinSummary,
  FieldMeasurementFloorSummary,
  FieldMeasurementServiceRow,
  FieldMeasurementSnapshot,
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
  const [searchQuery, setSearchQuery] = useState("");

  const [referenceDate, setReferenceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [inspectorName, setInspectorName] = useState("");
  const [weatherCondition, setWeatherCondition] = useState<string>("SOL");
  const [generalNotes, setGeneralNotes] = useState("");

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
            return (
              <Card
                key={row.rowKey}
                className="rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-xs space-y-3 dark:border-zinc-800 dark:bg-[#171720]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-950 dark:text-zinc-100">
                      {row.serviceLabel}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{row.floorName}</Badge>
                      {row.packageNumber && (
                        <Badge tone="blue">
                          {row.teamCode || "Eq."}
                          {row.packageNumber}
                        </Badge>
                      )}
                      <Badge tone={stBadge.tone}>{stBadge.label}</Badge>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {row.accumulatedPct.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                      {fmtBRL(row.measuredAmount)}
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso Feito vs Pendente */}
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-100 dark:bg-zinc-800">
                  <div
                    style={{ width: `${Math.min(100, row.accumulatedPct)}%` }}
                    className="h-full rounded-full bg-emerald-600 transition-all"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="block text-[10px] text-zinc-600 dark:text-zinc-300">
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
                      className="mt-0.5 h-7 w-full rounded-lg border border-zinc-300 bg-white px-1.5 font-mono text-[11px] font-semibold tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 dark:text-zinc-400">
                      Anterior
                    </span>
                    <strong className="font-mono text-slate-700 dark:text-zinc-300">
                      {row.previousExecutedQty.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 dark:text-zinc-400">
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
                      className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs font-bold text-slate-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 dark:text-zinc-400">
                      Pendente
                    </span>
                    <strong className="font-mono text-amber-700 dark:text-amber-300">
                      {row.pendingQty.toFixed(2)} {row.unit}
                    </strong>
                  </div>
                </div>

                {/* Atalhos Rápidos Touch */}
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
                <a
                  href={`/api/eap/projects/${projectId}/measurements/${b.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-indigo-700 hover:underline dark:text-indigo-400"
                >
                  📄 Abrir PDF ({b.bulletinCode})
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
