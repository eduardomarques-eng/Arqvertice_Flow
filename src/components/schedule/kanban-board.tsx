"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { editScheduleStageAction, deleteScheduleStageAction } from "@/app/actions/domain-actions";
import { toggleStageVisibilityAction } from "@/server/actions/schedule";
import { toggleChecklistItem } from "@/server/actions/checklist";
import type { KanbanBoard, KanbanCard, KanbanColumnId } from "@/server/services/schedule-service";
import type { StageFormData } from "./stage-form-modal";
import { MASTER_DISCIPLINES } from "@/lib/master-data";

const StageFormModal = dynamic(
  () => import("./stage-form-modal").then((mod) => mod.StageFormModal),
  { ssr: false }
);

const DISCIPLINE_STYLE: Record<string, { badge: string; border: string; progress: string }> = {
  Arquitetura: { badge: "border-indigo-200 bg-indigo-50 text-indigo-700", border: "border-l-indigo-600", progress: "bg-indigo-600" },
  Estrutura: { badge: "border-amber-200 bg-amber-50 text-amber-700", border: "border-l-amber-500", progress: "bg-amber-500" },
  Estrutural: { badge: "border-amber-200 bg-amber-50 text-amber-700", border: "border-l-amber-500", progress: "bg-amber-500" },
  "Engenharia Estrutural": { badge: "border-amber-200 bg-amber-50 text-amber-700", border: "border-l-amber-500", progress: "bg-amber-500" },
  "3D": { badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", border: "border-l-fuchsia-500", progress: "bg-fuchsia-600" },
  "Projeto 3D": { badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", border: "border-l-fuchsia-500", progress: "bg-fuchsia-600" },
  "Modelagem 3D e Imagens Finais": { badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", border: "border-l-fuchsia-500", progress: "bg-fuchsia-600" },
  Complementares: { badge: "border-sky-200 bg-sky-50 text-sky-700", border: "border-l-sky-500", progress: "bg-sky-500" },
  "Instalações Hidrossanitárias": { badge: "border-sky-200 bg-sky-50 text-sky-700", border: "border-l-sky-500", progress: "bg-sky-500" },
  "Instalações Elétricas": { badge: "border-yellow-200 bg-yellow-50 text-yellow-800", border: "border-l-yellow-500", progress: "bg-yellow-500" },
  "Combate a Incêndio": { badge: "border-rose-200 bg-rose-50 text-rose-700", border: "border-l-rose-500", progress: "bg-rose-500" },
  Obra: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", border: "border-l-emerald-500", progress: "bg-emerald-600" },
  Obras: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", border: "border-l-emerald-500", progress: "bg-emerald-600" },
  "Execução de Obra": { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", border: "border-l-emerald-500", progress: "bg-emerald-600" },
};

const COLUMN_STYLE: Record<
  KanbanColumnId,
  { label: string; tone: string; dotColor: string; headerBadge: string; sublabel: string }
> = {
  NOT_STARTED: {
    label: "Não Iniciado",
    sublabel: "Fase de planejamento e requisitos",
    tone: "border-slate-200 bg-slate-50/70",
    dotColor: "bg-slate-400",
    headerBadge: "bg-slate-200 text-slate-700",
  },
  IN_PROGRESS: {
    label: "Em Andamento",
    sublabel: "Desenvolvimento ativo de pranchas",
    tone: "border-blue-200 bg-blue-50/40",
    dotColor: "bg-blue-600",
    headerBadge: "bg-blue-100 text-blue-800",
  },
  REVIEW: {
    label: "Revisão Técnica / Compatibilização",
    sublabel: "Auditoria e checagem de interferências",
    tone: "border-amber-200 bg-amber-50/40",
    dotColor: "bg-amber-600",
    headerBadge: "bg-amber-100 text-amber-800",
  },
  COMPLETED: {
    label: "Concluído",
    sublabel: "Pronto para entrega ao cliente",
    tone: "border-emerald-200 bg-emerald-50/40",
    dotColor: "bg-emerald-600",
    headerBadge: "bg-emerald-100 text-emerald-800",
  },
};

function initials(name: string | null) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AV"
  );
}

function getAvatarColor(name: string | null) {
  if (!name) return "bg-slate-800 text-white";
  const lower = name.toLowerCase();
  if (lower.includes("eduardo")) return "bg-blue-600 text-white";
  if (lower.includes("luan")) return "bg-amber-600 text-white";
  if (lower.includes("erick")) return "bg-emerald-600 text-white";
  return "bg-slate-800 text-white";
}

function deadline(card: KanbanCard) {
  if (!card?.dueDate) return { text: "Sem prazo", tone: "text-slate-500 bg-slate-50" };
  const date = new Date(card.dueDate);
  const text = Number.isNaN(date.getTime())
    ? "Sem prazo"
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const isOverdue = Boolean(card.alert?.overdue);
  const isDueSoon = Boolean(card.alert?.dueSoon);
  const daysRemaining = card.alert?.daysRemaining ?? 0;
  const tone = isOverdue
    ? "text-rose-600 bg-rose-50 border-rose-200"
    : isDueSoon
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-slate-500 bg-slate-50 border-slate-200";
  const detail = isOverdue
    ? `${Math.abs(daysRemaining)}d atraso`
    : isDueSoon
    ? daysRemaining === 0
      ? "Hoje"
      : `Em ${daysRemaining}d`
    : text;
  return { text: detail, tone };
}

function statusForColumn(column: KanbanColumnId): "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" {
  if (column === "COMPLETED") return "COMPLETED";
  if (column === "REVIEW") return "REVIEW";
  if (column === "IN_PROGRESS") return "IN_PROGRESS";
  return "NOT_STARTED";
}

function columnForCompletion(completion: number, currentStatus?: string): KanbanColumnId {
  if (completion >= 99) return "COMPLETED";
  if (currentStatus === "REVIEW" || (completion >= 75 && completion < 99)) return "REVIEW";
  if (completion <= 5) return "NOT_STARTED";
  return "IN_PROGRESS";
}

export function KanbanBoardView({
  projectId,
  board,
  onBoardTotalsChange,
}: {
  projectId: string;
  board: KanbanBoard;
  onBoardTotalsChange?: (completion: number) => void;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(board?.columns ?? []);
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [filterAlertOnly, setFilterAlertOnly] = useState(false);
  const [showHiddenCards, setShowHiddenCards] = useState(false);
  const [selected, setSelected] = useState<KanbanCard | null>(null);
  const [editingStage, setEditingStage] = useState<StageFormData | null>(null);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Todas as etapas na memória para cálculo contínuo
  const allCards = useMemo(() => (columns ?? []).flatMap((c) => c?.cards ?? []), [columns]);
  const hiddenCardsCount = useMemo(
    () => allCards.filter((c) => c.isVisibleInKanban === false).length,
    [allCards],
  );

  // Cálculo contínuo do progresso consolidado global (incluindo cards ocultados)
  const overallCompletion = useMemo(() => {
    return Math.round(allCards.reduce((acc, c) => acc + c.completion, 0) / (allCards.length || 1));
  }, [allCards]);

  useEffect(() => {
    if (onBoardTotalsChange) {
      onBoardTotalsChange(overallCompletion);
    }
  }, [overallCompletion, onBoardTotalsChange]);

  /**
   * Alternância instantânea de visibilidade (Optimistic UI)
   */
  async function handleToggleVisibility(card: KanbanCard) {
    const nextVal = !(card.isVisibleInKanban !== false);
    setColumns((current) =>
      current.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? { ...c, isVisibleInKanban: nextVal } : c)),
      })),
    );
    try {
      await toggleStageVisibilityAction(card.id, nextVal, projectId);
    } catch (reason) {
      setColumns((current) =>
        current.map((col) => ({
          ...col,
          cards: col.cards.map((c) => (c.id === card.id ? { ...c, isVisibleInKanban: !nextVal } : c)),
        })),
      );
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar a visibilidade.");
    }
  }

  /**
   * Mudança de avanço físico que move o card de coluna instantaneamente (Optimistic).
   */
  async function handleCompletionChange(card: KanbanCard, nextCompletion: number) {
    const completion = Math.max(0, Math.min(100, Math.round(nextCompletion)));
    if (completion === card.completion) return;
    const target = columnForCompletion(completion, card.status);
    const status = statusForColumn(target);

    // 1. Atualização Otimista Imediata
    setColumns((current) => {
      const without = current.map((col) => ({ ...col, cards: [...col.cards] }));
      const source = without.find((col) => col.cards.some((c) => c.id === card.id));
      if (source) {
        source.cards.splice(source.cards.findIndex((c) => c.id === card.id), 1);
      }
      const label =
        status === "COMPLETED"
          ? "Concluída"
          : status === "REVIEW"
          ? "Em revisão"
          : status === "IN_PROGRESS"
          ? "Em andamento"
          : "Não iniciada";
      const destination = without.find((col) => col.id === target);
      if (destination) {
        destination.cards.push({ ...card, completion, status, statusLabel: label });
      }
      return without;
    });
    setError(null);

    // 2. Disparo assíncrono em background
    try {
      const response = await fetch(`/api/projects/${projectId}/stages/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, completion, order: card.order }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Falha ao salvar avanço.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o avanço.");
      router.refresh();
    }
  }

  /**
   * Toggle Otimista de item de Checklist inline no Card
   */
  async function handleChecklistToggle(cardId: string, checklistId: string, currentCompleted: boolean) {
    const nextCompleted = !currentCompleted;

    // Atualização otimista local imediata no card
    setColumns((current) =>
      current.map((col) => ({
        ...col,
        cards: col.cards.map((c) => {
          if (c.id !== cardId) return c;
          const updatedChecklists = (c.checklists || []).map((chk) =>
            chk.id === checklistId ? { ...chk, isCompleted: nextCompleted } : chk,
          );
          return { ...c, checklists: updatedChecklists };
        }),
      })),
    );

    // Chamada em background
    try {
      await toggleChecklistItem(checklistId, projectId, nextCompleted);
    } catch {
      // Reverte em caso de erro
      router.refresh();
    }
  }

  const visible = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        cards: column.cards.filter(
          (card) =>
            (showHiddenCards || card.isVisibleInKanban !== false) &&
            (!query || card.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
            (!assignee || card.designer === assignee) &&
            (!discipline || card.discipline === discipline) &&
            (!filterAlertOnly || card.alert.overdue || card.alert.dueSoon),
        ),
      })),
    [columns, showHiddenCards, query, assignee, discipline, filterAlertOnly],
  );

  async function onDragEnd(result: DropResult) {
    if (
      !result.destination ||
      (result.destination.droppableId === result.source.droppableId &&
        result.destination.index === result.source.index)
    )
      return;

    const sourceId = result.source.droppableId as KanbanColumnId;
    const targetId = result.destination.droppableId as KanbanColumnId;
    const targetStatus = statusForColumn(targetId);

    const previous = columns;
    const moved = visible.find((column) => column.id === sourceId)?.cards[result.source.index];
    if (!moved) return;

    let completion = moved.completion;
    if (targetId === "COMPLETED") completion = 100;
    else if (targetId === "REVIEW") completion = moved.completion < 75 || moved.completion >= 99 ? 85 : moved.completion;
    else if (targetId === "NOT_STARTED") completion = 0;
    else if (targetId === "IN_PROGRESS") completion = moved.completion === 0 || moved.completion >= 99 ? 50 : moved.completion;

    const statusLabel =
      targetStatus === "COMPLETED"
        ? "Concluída"
        : targetStatus === "REVIEW"
        ? "Em revisão"
        : targetStatus === "IN_PROGRESS"
        ? "Em andamento"
        : "Não iniciada";

    const updated = {
      ...moved,
      status: targetStatus,
      completion,
      statusLabel,
    };

    // 1. Atualização Otimista Imediata (0ms)
    const next = previous.map((column) => ({ ...column, cards: [...column.cards] }));
    const sourceCards = next.find((column) => column.id === sourceId)?.cards;
    if (!sourceCards) return;
    sourceCards.splice(sourceCards.findIndex((card) => card.id === moved.id), 1);

    const targetCards = next.find((column) => column.id === targetId)?.cards;
    if (!targetCards) return;

    const visibleTargetCards = visible.find((column) => column.id === targetId)?.cards ?? [];
    const beforeId = visibleTargetCards[result.destination.index]?.id;
    const insertionIndex = beforeId ? targetCards.findIndex((card) => card.id === beforeId) : targetCards.length;
    targetCards.splice(Math.max(0, insertionIndex), 0, updated);

    setColumns(next);
    setError(null);

    // 2. Disparo assíncrono em background sem bloqueio
    try {
      const response = await fetch(`/api/projects/${projectId}/stages/${moved.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: targetStatus, completion, order: result.destination.index }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível mover a etapa.");
    } catch (reason) {
      setColumns(previous);
      setError(reason instanceof Error ? reason.message : "Não foi possível mover a etapa.");
    }
  }

  const QUICK_DISCIPLINES = [
    { label: "Todas as Disciplinas", value: "" },
    ...MASTER_DISCIPLINES.map((d) => ({
      label: d.name,
      value: d.name === "Engenharia Estrutural" ? "Estrutura" : d.name === "Modelagem 3D e Imagens Finais" ? "Projeto 3D" : d.name,
    })),
  ];

  return (
    <>
      {/* Barra de Filtros Rápidos Estilo Trello / Bitrix24 */}
      <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar etapa ou atividade técnica..."
              className="min-w-52 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
            <select
              aria-label="Filtrar por responsável"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">Todos os responsáveis</option>
              {board.assignees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingStage(null);
              setIsCreatingStage(true);
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-[0.98] transition-transform duration-75 select-none shrink-0"
          >
            <span>+</span> Nova Atividade
          </button>
        </div>

        {/* Pílulas de Filtro Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
            Filtros:
          </span>
          {QUICK_DISCIPLINES.map((d) => {
            const isActive = discipline === d.value;
            return (
              <button
                key={d.label}
                type="button"
                onClick={() => setDiscipline(d.value)}
                className={`min-h-[44px] rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap active:scale-[0.98] transition-transform duration-75 select-none ${
                  isActive
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFilterAlertOnly(!filterAlertOnly)}
            className={`min-h-[44px] rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap active:scale-[0.98] transition-transform duration-75 select-none flex items-center gap-1 ${
              filterAlertOnly
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            }`}
          >
            <span>⚠️ Atenção / Prazos</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHiddenCards(!showHiddenCards)}
            className={`min-h-[44px] rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap active:scale-[0.98] transition-transform duration-75 select-none flex items-center gap-1.5 ${
              showHiddenCards
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            <span>{showHiddenCards ? "👁️ Mostrando Ocultos" : `👁️‍🗨️ Ocultos (${hiddenCardsCount})`}</span>
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}

      {/* QUADRO KANBAN FLUIDO EM 4 COLUNAS (TRELLO / BITRIX24) */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="mt-5 flex gap-4 overflow-x-auto pb-4 scrollbar-none safe-pb snap-x snap-mandatory xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0">
          {visible.map((column) => {
            const colMeta = COLUMN_STYLE[column.id];
            return (
              <Droppable droppableId={column.id} key={column.id}>
                {(provided, snapshot) => (
                  <section
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`w-[85vw] sm:w-[320px] shrink-0 snap-center xl:w-auto xl:shrink min-h-[480px] rounded-2xl border p-3.5 transition-colors ${
                      colMeta.tone
                    } ${snapshot.isDraggingOver ? "ring-2 ring-blue-400 bg-blue-50/70" : ""}`}
                  >
                    {/* Header da Coluna */}
                    <header className="mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${colMeta.dotColor}`} />
                          <h2 className="text-xs font-bold text-slate-900 tracking-tight">
                            {colMeta.label}
                          </h2>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-bold ${colMeta.headerBadge}`}>
                          {column.cards.length}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400 font-medium pl-4.5">
                        {colMeta.sublabel}
                      </p>
                    </header>

                    {/* Lista de Cards da Coluna */}
                    <div className="space-y-3">
                      {column.cards.map((card, index) => {
                        const due = deadline(card);
                        const colors =
                          DISCIPLINE_STYLE[card.discipline ?? ""] ?? {
                            badge: "border-slate-200 bg-slate-50 text-slate-600",
                            border: "border-l-slate-400",
                            progress: "bg-slate-500",
                          };

                        const completedChecklists = (card.checklists || []).filter((c) => c.isCompleted).length;
                        const totalChecklists = (card.checklists || []).length;

                        return (
                          <Draggable draggableId={card.id} index={index} key={card.id}>
                            {(dragProvided, dragSnapshot) => (
                              <article
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => setSelected(card)}
                                className={`group cursor-grab rounded-2xl border border-slate-200/90 border-l-4 bg-white p-3.5 shadow-2xs backdrop-blur-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs active:cursor-grabbing ${
                                  colors.border
                                } ${
                                  dragSnapshot.isDragging
                                    ? "scale-[1.02] rotate-1 border-blue-500 shadow-md ring-2 ring-blue-400/30"
                                    : ""
                                }`}
                              >
                                {/* Header do Card: Edificação & Fase Normativa & Visibilidade */}
                                <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-2 mb-2">
                                  <span className="truncate text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                    🏢 {card.projectName || board.project.name || "Residência de Praia - Pedro"}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-slate-500 shrink-0">
                                      {card.phase || "Projeto Executivo"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleVisibility(card);
                                      }}
                                      title={card.isVisibleInKanban === false ? "Exibir no Kanban" : "Ocultar do Kanban"}
                                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition flex items-center gap-1 active:scale-95 ${
                                        card.isVisibleInKanban === false
                                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                      }`}
                                    >
                                      {card.isVisibleInKanban === false ? "👁️‍🗨️ Oculto" : "👁️"}
                                    </button>
                                  </div>
                                </div>

                                {/* Disciplina & Prioridade */}
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${colors.badge}`}
                                  >
                                    {card.discipline ?? "Geral"}
                                  </span>
                                  {card.alert.overdue ? (
                                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 animate-pulse">
                                      ⚠️ ATRASO
                                    </span>
                                  ) : card.alert.dueSoon ? (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                      ⏳ VENCE LOGO
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-slate-400">
                                      {due.text}
                                    </span>
                                  )}
                                </div>

                                {/* Título da Atividade */}
                                <h3 className="mt-2 text-xs font-bold leading-snug text-slate-900 group-hover:text-blue-600 transition">
                                  {card.name}
                                </h3>

                                {card.description && (
                                  <p className="mt-1 text-[11px] leading-4 text-slate-500 line-clamp-2">
                                    {card.description}
                                  </p>
                                )}

                                {/* Checklists Inline Interativos (Optimistic) */}
                                {card.checklists && card.checklists.length > 0 && (
                                  <div className="mt-2.5 rounded-xl bg-slate-50/80 p-2 border border-slate-100 space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                                      <span className="flex items-center gap-1">
                                        ☑️ Checklists
                                      </span>
                                      <span className="font-mono text-slate-500">
                                        {completedChecklists}/{totalChecklists}
                                      </span>
                                    </div>

                                    {/* 2 primeiros itens de checklist clicáveis com área tátil confortável */}
                                    <div className="space-y-1">
                                      {card.checklists.slice(0, 2).map((item) => (
                                        <label
                                          key={item.id}
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex min-h-[44px] items-center gap-2.5 px-2 text-xs text-slate-700 cursor-pointer rounded-lg hover:bg-slate-100/80 active:scale-[0.98] transition-transform duration-75 select-none"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={item.isCompleted}
                                            onChange={() =>
                                              handleChecklistToggle(card.id, item.id, item.isCompleted)
                                            }
                                            className="h-4 w-4 rounded text-blue-600 focus:ring-0 shrink-0"
                                          />
                                          <span
                                            className={`truncate ${
                                              item.isCompleted
                                                ? "line-through text-slate-400 font-normal"
                                                : "font-medium"
                                            }`}
                                          >
                                            {item.task}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Badges de Rodapé: Pranchas Vinculadas & Responsável com Avatar */}
                                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                                  {/* Badge de Pranchas */}
                                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                    📐 {card.deliverablesCount || 0} pranchas
                                  </span>

                                  {/* Responsável com Avatar */}
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      title={card.designer ?? "Eduardo Marques"}
                                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-2xs ${getAvatarColor(
                                        card.designer,
                                      )}`}
                                    >
                                      {initials(card.designer)}
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-600 max-w-[90px] truncate">
                                      {card.designer ? card.designer.split(" ")[0] : "Eduardo"}
                                    </span>
                                  </div>
                                </div>

                                {/* Barra de Progresso & Slider Interativo */}
                                <div className="mt-2.5 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                    <span>Avanço</span>
                                    <span className="font-mono text-slate-700">{card.completion}%</span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={`h-full rounded-full transition-all duration-200 ${colors.progress}`}
                                      style={{ width: `${card.completion}%` }}
                                    />
                                  </div>

                                  <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={card.completion}
                                      onChange={(event) =>
                                        handleCompletionChange(card, Number(event.target.value))
                                      }
                                      className="w-full accent-blue-600 cursor-pointer h-1"
                                    />
                                  </div>
                                </div>

                                {/* Ações Rápidas de Movimentação Mobile (< xl) */}
                                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 xl:hidden">
                                  <span className="text-[9px] font-bold uppercase text-slate-400">
                                    Mover:
                                  </span>
                                  <div className="flex gap-1">
                                    {column.id !== "NOT_STARTED" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCompletionChange(card, 0);
                                        }}
                                        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 active:scale-95"
                                      >
                                        Não Iniciado
                                      </button>
                                    )}
                                    {column.id !== "IN_PROGRESS" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCompletionChange(card, 50);
                                        }}
                                        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 active:scale-95"
                                      >
                                        Em Andamento
                                      </button>
                                    )}
                                    {column.id !== "REVIEW" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCompletionChange(card, 85);
                                        }}
                                        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 active:scale-95"
                                      >
                                        Revisão Técnica
                                      </button>
                                    )}
                                    {column.id !== "COMPLETED" && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCompletionChange(card, 100);
                                        }}
                                        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 active:scale-95"
                                      >
                                        Concluído
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </article>
                            )}
                          </Draggable>
                        );
                      })}
                    </div>
                    {provided.placeholder}
                  </section>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Modal / Drawer de Detalhes da Etapa */}
      {selected ? (
        <StageDrawer
          projectId={projectId}
          card={selected}
          onClose={() => setSelected(null)}
          onDuplicate={(stageCard) => {
            setSelected(null);
            setEditingStage({
              name: `${stageCard.name} (Cópia)`,
              discipline: stageCard.discipline,
              designer: stageCard.designer,
              dueDate: stageCard.dueDate,
              completion: 0,
            });
            setIsCreatingStage(true);
          }}
          onSaved={(patch) => {
            setColumns((current) =>
              current.map((col) => ({
                ...col,
                cards: col.cards.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)),
              })),
            );
          }}
        />
      ) : null}

      <StageFormModal
        projectId={projectId}
        initialStage={editingStage}
        isOpen={isCreatingStage}
        onClose={() => {
          setIsCreatingStage(false);
          setEditingStage(null);
        }}
      />
    </>
  );
}

function StageDrawer({
  projectId,
  card,
  onClose,
  onDuplicate,
  onSaved,
}: {
  projectId: string;
  card: KanbanCard;
  onClose: () => void;
  onDuplicate: (card: KanbanCard) => void;
  onSaved: (patch: Partial<KanbanCard>) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState(card.completion);
  const [isVisibleInKanban, setIsVisibleInKanban] = useState(card.isVisibleInKanban ?? true);
  const [checklist, setChecklist] = useState({ dwg: false, approval: false });

  function save(form: FormData) {
    const input = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || null,
      discipline: String(form.get("discipline") ?? "").trim() || null,
      designer: String(form.get("designer") ?? "").trim() || null,
      startDate: String(form.get("startDate") ?? "").trim() || null,
      dueDate: String(form.get("dueDate") ?? "").trim() || null,
      isVisibleInKanban,
      notes: [
        String(form.get("notes") ?? "").trim(),
        checklist.dwg ? "[x] Enviar prancha em DWG" : "[ ] Enviar prancha em DWG",
        checklist.approval ? "[x] Aprovação do cliente" : "[ ] Aprovação do cliente",
      ]
        .filter(Boolean)
        .join("\n"),
      completion,
    };
    startTransition(async () => {
      try {
        await editScheduleStageAction(card.id, input, projectId);
        onSaved({
          name: input.name,
          description: input.description,
          discipline: input.discipline,
          designer: input.designer,
          startDate: input.startDate ? new Date(input.startDate) : null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes,
          completion,
          isVisibleInKanban,
        });
        onClose();
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
      }
    });
  }

  function remove() {
    if (!window.confirm("Excluir esta atividade do cronograma?")) return;
    startTransition(async () => {
      await deleteScheduleStageAction(card.id);
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Detalhes da Atividade
            </span>
            <h2 className="mt-1 text-base font-bold text-slate-900">{card.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Resumo da Edificação & Fase */}
        <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-1">
          <p className="text-xs text-slate-600 font-semibold">
            🏢 Edificação: <span className="text-slate-900">{card.projectName || "Residência de Praia - Pedro"}</span>
          </p>
          <p className="text-xs text-slate-600 font-semibold">
            📐 Fase Normativa: <span className="text-slate-900">{card.phase || "Projeto Executivo"}</span>
          </p>
          <p className="text-xs text-slate-600 font-semibold">
            🏛️ Disciplina: <span className="text-slate-900">{card.discipline || "Geral"}</span>
          </p>
          <p className="text-xs text-slate-600 font-semibold">
            📄 Pranchas vinculadas: <span className="text-slate-900">{card.deliverablesCount || 0} pranchas</span>
          </p>
        </div>

        <form action={save} className="mt-5 space-y-4">
          <label className="block text-xs font-semibold text-slate-700">
            Título
            <input
              name="name"
              defaultValue={card.name}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Descrição Técnica
            <textarea
              name="description"
              defaultValue={card.description ?? ""}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-700">
              Disciplina
              <input
                name="discipline"
                defaultValue={card.discipline ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Responsável
              <input
                name="designer"
                defaultValue={card.designer ?? ""}
                list="stage-assignees"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
              />
            </label>
          </div>

          <datalist id="stage-assignees">
            <option>Eduardo Marques</option>
            <option>Emanoel Luan</option>
            <option>Erick</option>
          </datalist>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-700">
              Início
              <input
                name="startDate"
                type="date"
                defaultValue={card.startDate ? new Date(card.startDate).toISOString().slice(0, 10) : ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Prazo Final
              <input
                name="dueDate"
                type="date"
                defaultValue={card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Avanço Físico · {completion}%
            <input
              type="range"
              min="0"
              max="100"
              value={completion}
              onChange={(event) => setCompletion(Number(event.target.value))}
              className="mt-2 w-full accent-blue-600"
            />
          </label>

          {/* Toggle de Visibilidade no Kanban */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Exibir no Kanban
              </span>
              <span className="text-[10px] text-slate-500 block">
                {isVisibleInKanban ? "Card visível no quadro" : "Card oculto do quadro visual"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsVisibleInKanban(!isVisibleInKanban)}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                isVisibleInKanban
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              <span>{isVisibleInKanban ? "👁️ Visível" : "👁️‍🗨️ Oculto"}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition active:scale-95"
            >
              Excluir
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const start = card.dueDate ? new Date(card.dueDate) : new Date();
                  const y = start.getUTCFullYear();
                  const m = String(start.getUTCMonth() + 1).padStart(2, "0");
                  const d = String(start.getUTCDate()).padStart(2, "0");
                  const dateStr = `${y}${m}${d}`;
                  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                    card.name
                  )}&dates=${dateStr}/${dateStr}&details=${encodeURIComponent(
                    `Edificação: ${card.projectName || "Projeto"}\nDisciplina: ${card.discipline || "Geral"}\nResponsável: ${card.designer || "Eduardo Marques"}\nAvanço: ${completion}%`
                  )}`;
                  window.open(url, "_blank");
                }}
                className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition active:scale-95"
                title="Adicionar ao Google Agenda"
              >
                📅 Google Agenda
              </button>

              <button
                type="button"
                onClick={() => onDuplicate(card)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95"
              >
                Duplicar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition active:scale-95"
              >
                {pending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        </form>
      </aside>
    </div>
  );
}
