"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LobFloorDefinition } from "@/lib/eap-lob-grid";
import type {
  ServicePackageDTO,
  WorkTeamDTO,
} from "@/components/admin/eap/eap-teams-and-packages-manager";

export interface ConstraintDTO {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  floorId: string | null;
  floorName: string | null;
  packageNumber: number | null;
  teamCode: string | null;
  neededByDate: string;
  leadTimeDays: number;
  orderDeadlineDate: string | null;
  estimatedCost: number | null;
  supplierName: string | null;
  responsibleName: string | null;
  riskLevel: "CRITICA" | "ATENCAO" | "NO_PRAZO" | "LIBERADA";
}

interface ConstraintMetricsDTO {
  total: number;
  criticalCount: number;
  attentionCount: number;
  next15DaysCount: number;
  releasedCount: number;
  blockedCount: number;
  totalEstimatedCost: number;
}

interface EapConstraintsKanbanProps {
  projectId: string;
  floors: LobFloorDefinition[];
  servicePackages: ServicePackageDTO[];
  workTeams: WorkTeamDTO[];
  onConstraintsChanged?: () => void | Promise<void>;
}

const KANBAN_COLUMNS: Array<{ id: string; title: string; accentClass: string }> = [
  {
    id: "IDENTIFICADA",
    title: "Identificada",
    accentClass: "border-t-slate-500",
  },
  {
    id: "EM_COTACAO_ANALISE",
    title: "Em Cotação / Análise",
    accentClass: "border-t-amber-500",
  },
  {
    id: "PEDIDO_EMITIDO",
    title: "Pedido Emitido",
    accentClass: "border-t-blue-600",
  },
  {
    id: "LIBERADA",
    title: "Liberada (Pronta p/ Obra)",
    accentClass: "border-t-emerald-600",
  },
  {
    id: "BLOQUEADA",
    title: "Bloqueada",
    accentClass: "border-t-rose-600",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  COMPRAS_SUPRIMENTOS: "Compras / Suprimentos",
  PROJETO_DEFINICAO: "Projeto / Definição",
  MAO_DE_OBRA: "Mão de Obra",
  EQUIPAMENTOS: "Equipamentos",
  LICENCAS_APROVACOES: "Licenças / Aprovações",
  LOGISTICA_CANTEIRO: "Logística / Canteiro",
};

const RISK_BADGE: Record<
  ConstraintDTO["riskLevel"],
  { label: string; tone: "red" | "amber" | "green" | "neutral" }
> = {
  CRITICA: { label: "Crítica / Vencida", tone: "red" },
  ATENCAO: { label: "Atenção (≤7d)", tone: "amber" },
  NO_PRAZO: { label: "No Prazo", tone: "neutral" },
  LIBERADA: { label: "Liberada", tone: "green" },
};

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function EapConstraintsKanban({
  projectId,
  floors,
  servicePackages,
  workTeams,
  onConstraintsChanged,
}: EapConstraintsKanbanProps) {
  const [constraints, setConstraints] = useState<ConstraintDTO[]>([]);
  const [metrics, setMetrics] = useState<ConstraintMetricsDTO>({
    total: 0,
    criticalCount: 0,
    attentionCount: 0,
    next15DaysCount: 0,
    releasedCount: 0,
    blockedCount: 0,
    totalEstimatedCost: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [filterFloor, setFilterFloor] = useState("ALL");
  const [filterTeam, setFilterTeam] = useState("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterRisk, setFilterRisk] = useState("ALL");

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    title: "",
    category: "COMPRAS_SUPRIMENTOS",
    priority: "ALTA",
    floorId: floors[1]?.floorId || "TERREO",
    packageNumber: String(servicePackages[0]?.packageNumber || 1),
    teamCode: workTeams[0]?.teamCode || "A",
    neededByDate: new Date().toISOString().slice(0, 10),
    leadTimeDays: "7",
    estimatedCost: "",
    supplierName: "",
    responsibleName: "",
  });

  const loadConstraints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/constraints`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setConstraints(json.constraints ?? []);
        if (json.metrics) setMetrics(json.metrics);
      }
    } catch {
      setFeedback({ type: "error", text: "Erro ao carregar restrições e suprimentos." });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadConstraints();
  }, [loadConstraints]);

  const filteredConstraints = useMemo(() => {
    return constraints.filter((c) => {
      if (filterFloor !== "ALL" && c.floorId !== filterFloor) return false;
      if (filterTeam !== "ALL" && (c.teamCode || "").toUpperCase() !== filterTeam) return false;
      if (filterCategory !== "ALL" && c.category !== filterCategory) return false;
      if (filterRisk !== "ALL" && c.riskLevel !== filterRisk) return false;
      return true;
    });
  }, [constraints, filterFloor, filterTeam, filterCategory, filterRisk]);

  async function handleGenerateLookahead() {
    setBusyKey("lookahead");
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/constraints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE_LOOKAHEAD", windowDays: 45 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao gerar Lookahead 45d." });
        return;
      }
      setFeedback({
        type: "success",
        text: `Lookahead 45d: ${json.createdCount} nova(s) restrição(ões) gerada(s) (${json.skippedExistingCount} já existente(s)).`,
      });
      await loadConstraints();
      await onConstraintsChanged?.();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateConstraint(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.title.trim()) return;
    setBusyKey("create");
    setFeedback(null);
    try {
      const matchedFloor = floors.find((f) => f.floorId === newForm.floorId);
      const res = await fetch(`/api/eap/projects/${projectId}/constraints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newForm.title.trim(),
          category: newForm.category,
          priority: newForm.priority,
          floorId: newForm.floorId || null,
          floorName: matchedFloor?.floorName || null,
          packageNumber: newForm.packageNumber ? Number(newForm.packageNumber) : null,
          teamCode: newForm.teamCode || null,
          neededByDate: newForm.neededByDate,
          leadTimeDays: Number(newForm.leadTimeDays) || 7,
          estimatedCost: newForm.estimatedCost ? Number(newForm.estimatedCost) : null,
          supplierName: newForm.supplierName.trim() || null,
          responsibleName: newForm.responsibleName.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: "error", text: json.error || "Erro ao criar restrição." });
        return;
      }
      setNewForm((prev) => ({ ...prev, title: "", estimatedCost: "", supplierName: "" }));
      setShowNewForm(false);
      setFeedback({ type: "success", text: "Restrição adicionada ao Kanban." });
      await loadConstraints();
      await onConstraintsChanged?.();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMoveStatus(constraintId: string, nextStatus: string) {
    setBusyKey(`move-${constraintId}`);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/eap/projects/${projectId}/constraints/${constraintId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (res.ok) {
        await loadConstraints();
        await onConstraintsChanged?.();
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteConstraint(constraintId: string) {
    setBusyKey(`del-${constraintId}`);
    try {
      const res = await fetch(
        `/api/eap/projects/${projectId}/constraints/${constraintId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await loadConstraints();
        await onConstraintsChanged?.();
      }
    } finally {
      setBusyKey(null);
    }
  }

  function handleDropOnColumn(e: DragEvent<HTMLDivElement>, targetStatus: string) {
    e.preventDefault();
    const id = draggedId || e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    if (id) {
      void handleMoveStatus(id, targetStatus);
    }
  }

  return (
    <div className="space-y-4">
      {/* KPIs Lookahead */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total de Restrições
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-950 dark:text-zinc-100">
            {metrics.total}{" "}
            <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400">
              ({metrics.releasedCount} liberada(s))
            </span>
          </p>
        </Card>
        <Card className="rounded-2xl border border-rose-200/80 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-rose-900/50 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Críticas / Vencidas
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-rose-700 dark:text-rose-400">
            {metrics.criticalCount}
          </p>
        </Card>
        <Card className="rounded-2xl border border-amber-200/80 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-amber-900/50 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Liberação Próx. 15 Dias
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-amber-700 dark:text-amber-300">
            {metrics.next15DaysCount}
          </p>
        </Card>
        <Card className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-xs backdrop-blur-md dark:border-zinc-800 dark:bg-[#16161D]/90">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Compromisso Financeiro
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-950 dark:text-zinc-100">
            {fmtBRL(metrics.totalEstimatedCost)}
          </p>
        </Card>
      </div>

      {/* Barra de Filtros & Ações */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-xs backdrop-blur-md space-y-3 dark:border-zinc-800 dark:bg-[#16161D]/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterFloor}
              onChange={(e) => setFilterFloor(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">Todos Pavimentos</option>
              {floors.map((f) => (
                <option key={f.floorId} value={f.floorId}>
                  {f.floorName}
                </option>
              ))}
            </select>

            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">Todas Equipes</option>
              {workTeams.map((t) => (
                <option key={t.teamCode} value={t.teamCode.toUpperCase()}>
                  Equipe {t.teamCode}
                </option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">Todas Categorias</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">Todas Urgências</option>
              <option value="CRITICA">Crítica / Vencida</option>
              <option value="ATENCAO">Atenção (≤7d)</option>
              <option value="NO_PRAZO">No Prazo</option>
              <option value="LIBERADA">Liberada</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm((v) => !v)}
              className="apple-glass-btn h-8 px-3 py-0 text-xs font-semibold cursor-pointer"
            >
              + Nova Restrição
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateLookahead()}
              disabled={busyKey === "lookahead"}
              className="apple-primary-btn h-8 px-3.5 py-0 text-xs font-semibold cursor-pointer"
            >
              {busyKey === "lookahead"
                ? "Gerando..."
                : "⚡ Gerar Lookahead do Cronograma (45d)"}
            </button>
          </div>
        </div>

        {showNewForm && (
          <form
            onSubmit={handleCreateConstraint}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 grid gap-2.5 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <input
              required
              placeholder="Título (ex.: Compra de Concreto C35 + Bomba)"
              value={newForm.title}
              onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <select
              value={newForm.category}
              onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={newForm.floorId}
              onChange={(e) => setNewForm((f) => ({ ...f, floorId: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {floors.map((f) => (
                <option key={f.floorId} value={f.floorId}>
                  {f.floorName}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Pacote #"
              value={newForm.packageNumber}
              onChange={(e) => setNewForm((f) => ({ ...f, packageNumber: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              maxLength={4}
              placeholder="Equipe (ex.: A)"
              value={newForm.teamCode}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, teamCode: e.target.value.toUpperCase() }))
              }
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              type="date"
              required
              value={newForm.neededByDate}
              onChange={(e) => setNewForm((f) => ({ ...f, neededByDate: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              type="number"
              min="0"
              placeholder="Lead time (dias)"
              value={newForm.leadTimeDays}
              onChange={(e) => setNewForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Custo estimado R$"
              value={newForm.estimatedCost}
              onChange={(e) => setNewForm((f) => ({ ...f, estimatedCost: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              placeholder="Fornecedor"
              value={newForm.supplierName}
              onChange={(e) => setNewForm((f) => ({ ...f, supplierName: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              placeholder="Responsável"
              value={newForm.responsibleName}
              onChange={(e) => setNewForm((f) => ({ ...f, responsibleName: e.target.value }))}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busyKey === "create"}
                className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                {busyKey === "create" ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </form>
        )}

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

      {/* Quadro Kanban 5 Colunas */}
      {loading ? (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-zinc-400">
          Carregando quadro Kanban de Restrições &amp; Suprimentos...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = filteredConstraints.filter((c) => c.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnColumn(e, col.id)}
                className={`flex min-h-[340px] flex-col rounded-2xl border border-slate-200/90 border-t-4 bg-slate-50/80 p-2.5 shadow-xs dark:border-zinc-800 dark:bg-[#13131A] ${col.accentClass}`}
              >
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                    {col.title}
                  </span>
                  <Badge tone="neutral">{colItems.length}</Badge>
                </div>

                <div className="flex-1 space-y-2">
                  {colItems.map((item) => {
                    const riskMeta = RISK_BADGE[item.riskLevel];
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedId(item.id);
                          e.dataTransfer.setData("text/plain", item.id);
                        }}
                        className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xs transition hover:shadow-md cursor-grab active:cursor-grabbing dark:border-zinc-800 dark:bg-[#1A1A24] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-[11px] font-bold leading-snug text-slate-950 dark:text-zinc-100">
                            {item.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteConstraint(item.id)}
                            title="Remover restrição"
                            className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Badge tone={riskMeta.tone}>{riskMeta.label}</Badge>
                          <Badge tone="blue">
                            {CATEGORY_LABELS[item.category] || item.category}
                          </Badge>
                          {(item.floorName || item.packageNumber) && (
                            <Badge tone="neutral">
                              {item.floorName || item.floorId || "Obra"} ·{" "}
                              {item.teamCode || ""}
                              {item.packageNumber ?? ""}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 dark:text-zinc-400">
                          <div>
                            Compra até:{" "}
                            <strong className="font-mono text-slate-900 dark:text-zinc-200">
                              {item.orderDeadlineDate || "—"}
                            </strong>
                          </div>
                          <div>
                            Na obra:{" "}
                            <strong className="font-mono text-slate-900 dark:text-zinc-200">
                              {item.neededByDate}
                            </strong>
                          </div>
                        </div>

                        {(item.estimatedCost || item.supplierName || item.responsibleName) && (
                          <div className="border-t border-slate-100 pt-1.5 text-[10px] text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
                            {item.estimatedCost ? (
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {fmtBRL(item.estimatedCost)}
                              </span>
                            ) : null}
                            {item.supplierName ? ` · ${item.supplierName}` : ""}
                            {item.responsibleName ? ` · Resp.: ${item.responsibleName}` : ""}
                          </div>
                        )}

                        <select
                          value={item.status}
                          disabled={busyKey === `move-${item.id}`}
                          onChange={(e) => void handleMoveStatus(item.id, e.target.value)}
                          className="h-7 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          {KANBAN_COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              Mover: {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
