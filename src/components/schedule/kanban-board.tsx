"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editScheduleStageAction, deleteScheduleStageAction } from "@/app/actions/domain-actions";
import type { KanbanBoard, KanbanCard, KanbanColumnId } from "@/server/services/schedule-service";

const DISCIPLINE_STYLE: Record<string, { badge: string; border: string; progress: string }> = {
  Arquitetura: { badge: "border-indigo-200 bg-indigo-50 text-indigo-700", border: "border-l-indigo-600", progress: "bg-indigo-600" },
  Estrutura: { badge: "border-amber-200 bg-amber-50 text-amber-700", border: "border-l-amber-500", progress: "bg-amber-500" },
  Estrutural: { badge: "border-amber-200 bg-amber-50 text-amber-700", border: "border-l-amber-500", progress: "bg-amber-500" },
  "3D": { badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", border: "border-l-fuchsia-500", progress: "bg-fuchsia-600" },
  "Projeto 3D": { badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", border: "border-l-fuchsia-500", progress: "bg-fuchsia-600" },
  Complementares: { badge: "border-sky-200 bg-sky-50 text-sky-700", border: "border-l-sky-500", progress: "bg-sky-500" },
  Obra: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", border: "border-l-emerald-500", progress: "bg-emerald-600" },
  Obras: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", border: "border-l-emerald-500", progress: "bg-emerald-600" },
  "Execução de Obra": { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", border: "border-l-emerald-500", progress: "bg-emerald-600" },
};

const COLUMN_STYLE: Record<KanbanColumnId, { label: string; tone: string }> = {
  NOT_STARTED: { label: "A iniciar", tone: "border-slate-200 bg-slate-50" },
  IN_PROGRESS: { label: "Em andamento", tone: "border-blue-200 bg-blue-50/60" },
  COMPLETED: { label: "Concluído", tone: "border-emerald-200 bg-emerald-50/60" },
};

function initials(name: string | null) {
  return name?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function deadline(card: KanbanCard) {
  if (!card.dueDate) return { text: "Sem prazo", tone: "text-slate-500 bg-slate-50" };
  const date = new Date(card.dueDate);
  const text = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const tone = card.alert.overdue ? "text-rose-600 bg-rose-50" : card.alert.dueSoon ? "text-amber-600 bg-amber-50" : "text-slate-500 bg-slate-50";
  const detail = card.alert.overdue ? `${Math.abs(card.alert.daysRemaining ?? 0)} dia(s) em atraso` : card.alert.dueSoon ? (card.alert.daysRemaining === 0 ? "Vence hoje" : `Vence em ${card.alert.daysRemaining} dia(s)`) : text;
  return { text: detail, tone };
}

function statusForColumn(column: KanbanColumnId) {
  return column === "COMPLETED" ? "COMPLETED" : column === "IN_PROGRESS" ? "IN_PROGRESS" : "NOT_STARTED";
}

function columnForCompletion(completion: number): KanbanColumnId {
  if (completion >= 99) return "COMPLETED";
  if (completion <= 5) return "NOT_STARTED";
  return "IN_PROGRESS";
}

export function KanbanBoardView({ projectId, board }: { projectId: string; board: KanbanBoard }) {
  const router = useRouter();
  const [columns, setColumns] = useState(board.columns);
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [selected, setSelected] = useState<KanbanCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Mudança de avanço físico que move o card de coluna instantaneamente.
   *
   * A coluna é uma projeção estrita do percentual: 0–5% «A iniciar», 6–98% «Em
   * andamento», 99–100% «Concluído». A escrita é otimista no ecrã e persistida
   * via PATCH /api/projects/[id]/stages/[stageId].
   */
  async function handleCompletionChange(card: KanbanCard, nextCompletion: number) {
    const completion = Math.max(0, Math.min(100, Math.round(nextCompletion)));
    if (completion === card.completion) return;
    const target = columnForCompletion(completion);
    const status = statusForColumn(target);

    setColumns((current) => {
      const without = current.map((col) => ({ ...col, cards: [...col.cards] }));
      const source = without.find((col) => col.cards.some((c) => c.id === card.id));
      if (source) {
        source.cards.splice(source.cards.findIndex((c) => c.id === card.id), 1);
      }
      const label = status === "COMPLETED" ? "Concluída" : status === "IN_PROGRESS" ? "Em andamento" : "Não iniciada";
      const destination = without.find((col) => col.id === target);
      if (destination) {
        destination.cards.push({ ...card, completion, statusLabel: label });
      }
      return without;
    });
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/stages/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, completion, order: card.order }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível atualizar o avanço.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o avanço.");
      router.refresh();
    }
  }

  const visible = useMemo(() => columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) =>
      (!query || card.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
      (!assignee || card.designer === assignee) &&
      (!discipline || card.discipline === discipline),
    ),
  })), [columns, query, assignee, discipline]);

  async function onDragEnd(result: DropResult) {
    if (!result.destination || (result.destination.droppableId === result.source.droppableId && result.destination.index === result.source.index)) return;
    const sourceId = result.source.droppableId as KanbanColumnId;
    const targetId = result.destination.droppableId as KanbanColumnId;
    const previous = columns;
    const moved = visible.find((column) => column.id === sourceId)?.cards[result.source.index];
    if (!moved) return;
    const next = previous.map((column) => ({ ...column, cards: [...column.cards] }));
    const sourceCards = next.find((column) => column.id === sourceId)?.cards;
    if (!sourceCards) return;
    sourceCards.splice(sourceCards.findIndex((card) => card.id === moved.id), 1);
    const completion = targetId === "COMPLETED" ? 100 : targetId === "NOT_STARTED" ? 0 : moved.completion === 100 ? 85 : moved.completion === 0 ? 10 : moved.completion;
    const updated = { ...moved, completion, statusLabel: targetId === "COMPLETED" ? "Concluída" : targetId === "IN_PROGRESS" ? "Em andamento" : "Não iniciada" };
    const targetCards = next.find((column) => column.id === targetId)?.cards;
    if (!targetCards) return;
    const visibleTargetCards = visible.find((column) => column.id === targetId)?.cards ?? [];
    const beforeId = visibleTargetCards[result.destination.index]?.id;
    const insertionIndex = beforeId ? targetCards.findIndex((card) => card.id === beforeId) : targetCards.length;
    targetCards.splice(Math.max(0, insertionIndex), 0, updated);
    setColumns(next);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/stages/${moved.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: statusForColumn(targetId), completion, order: result.destination.index }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível mover a etapa.");
      router.refresh();
    } catch (reason) {
      setColumns(previous);
      setError(reason instanceof Error ? reason.message : "Não foi possível mover a etapa.");
    }
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar etapa..." className="min-w-52 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="">Todos os responsáveis</option>
          {board.assignees.map((name) => <option key={name}>{name}</option>)}
        </select>
        <select value={discipline} onChange={(event) => setDiscipline(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="">Todas as disciplinas</option>
          {["Arquitetura", "Estrutura", "Projeto 3D", "Complementares", "Obra", "Execução de Obra"].map((name) => <option key={name}>{name}</option>)}
        </select>
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="mt-5 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
          {visible.map((column) => (
            <Droppable droppableId={column.id} key={column.id}>
              {(provided, snapshot) => (
                <section
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`w-[88vw] sm:w-[340px] shrink-0 snap-center lg:w-auto lg:shrink min-h-48 rounded-2xl border p-3.5 transition-colors ${COLUMN_STYLE[column.id].tone} ${snapshot.isDraggingOver ? "ring-2 ring-blue-300" : ""}`}
                >
                  <header className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800">{COLUMN_STYLE[column.id].label}</h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{column.cards.length}</span>
                  </header>
                  <div className="space-y-2.5">
                    {column.cards.map((card, index) => {
                      const due = deadline(card);
                      const colors = DISCIPLINE_STYLE[card.discipline ?? ""] ?? { badge: "border-slate-200 bg-slate-50 text-slate-600", border: "border-l-slate-400", progress: "bg-slate-500" };
                      return (
                        <Draggable draggableId={card.id} index={index} key={card.id}>
                          {(dragProvided, dragSnapshot) => (
                            <article ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} onClick={() => setSelected(card)} className={`cursor-grab rounded-2xl border border-neutral-100 border-l-4 bg-white/95 p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] active:cursor-grabbing ${colors.border} ${dragSnapshot.isDragging ? "scale-[1.02] rotate-1 border-indigo-400 shadow-[0_20px_35px_rgba(0,0,0,0.15)]" : ""}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${colors.badge}`}>{card.discipline ?? "Sem disciplina"}</span>
                                {card.priority === "ALTA" ? <span className="text-[10px] font-bold text-rose-600">ALTA</span> : <span className="text-[10px] font-semibold text-slate-400">NORMAL</span>}
                              </div>
                              <h3 className="mt-2 text-sm font-semibold leading-5 text-slate-800">{card.name}</h3>
                              {card.description ? <p className="mt-1 text-xs leading-4 text-slate-500">{card.description}</p> : null}
                              <div className="mt-3 flex items-center gap-2 text-xs">
                                <span title={card.designer ?? "Responsável não atribuído"} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{initials(card.designer)}</span>
                                <span className="min-w-0 flex-1 truncate text-slate-500">{card.designer ?? "Por atribuir"}</span>
                                <span className={`rounded-md border px-1.5 py-1 font-semibold ${due.tone}`}>◷ {due.text}</span>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${colors.progress}`} style={{ width: `${card.completion}%` }} /></div>
                                <span className="text-[10px] font-bold text-slate-500">{card.completion}%</span>
                              </div>
                              {card.completion >= 99 ? (
                                <div className="mt-2 flex items-center gap-2"><span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 animate-pulse">100% · Concluído</span><span className="text-[10px] text-emerald-600">card em «Concluído»</span></div>
                              ) : null}
                              <div className="mt-2.5">
                                <input type="range" min="0" max="100" value={card.completion} onChange={(event) => handleCompletionChange(card, Number(event.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
                                <div className="flex justify-between text-[10px] text-slate-400">
                                  <span>0%</span>
                                  <span>Avanço físico</span>
                                  <span>100%</span>
                                </div>
                              </div>
                              {/* Botões rápidos contextuais para Mobile (< lg) */}
                              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 lg:hidden">
                                <span className="text-[10px] font-medium text-slate-400">Mover:</span>
                                <div className="flex gap-1.5">
                                  {column.id !== "NOT_STARTED" && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleCompletionChange(card, 0); }}
                                      className="min-h-[34px] px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded-lg active:scale-95 transition"
                                    >
                                      A iniciar
                                    </button>
                                  )}
                                  {column.id !== "IN_PROGRESS" && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleCompletionChange(card, 50); }}
                                      className="min-h-[34px] px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 rounded-lg active:scale-95 transition"
                                    >
                                      Em andamento
                                    </button>
                                  )}
                                  {column.id !== "COMPLETED" && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleCompletionChange(card, 100); }}
                                      className="min-h-[34px] px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-lg active:scale-95 transition"
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
          ))}
        </div>
      </DragDropContext>
      {selected ? <StageDrawer projectId={projectId} card={selected} onClose={() => setSelected(null)} onSaved={(patch) => {
        setColumns((current) => {
          const updated = { ...selected, ...patch };
          const target = columnForCompletion(updated.completion);
          const without = current.map((column) => ({ ...column, cards: column.cards.filter((item) => item.id !== selected.id) }));
          const destination = without.find((column) => column.id === target);
          if (destination) destination.cards.push(updated);
          return without;
        });
      }} /> : null}
    </>
  );
}

function StageDrawer({ projectId, card, onClose, onSaved }: { projectId: string; card: KanbanCard; onClose: () => void; onSaved: (patch: Partial<KanbanCard>) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState(card.completion);
  const [checklist, setChecklist] = useState({ dwg: false, approval: false });

  function save(form: FormData) {
    const input = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || null,
      discipline: String(form.get("discipline") ?? "").trim() || null,
      designer: String(form.get("designer") ?? "").trim() || null,
      startDate: String(form.get("startDate") ?? "").trim() || null,
      dueDate: String(form.get("dueDate") ?? "").trim() || null,
      notes: [String(form.get("notes") ?? "").trim(), checklist.dwg ? "[x] Enviar prancha em DWG" : "[ ] Enviar prancha em DWG", checklist.approval ? "[x] Aprovação do cliente" : "[ ] Aprovação do cliente"].filter(Boolean).join("\n"),
      completion,
    };
    startTransition(async () => {
      try {
        await editScheduleStageAction(card.id, input);
        onSaved({ name: input.name, description: input.description, discipline: input.discipline, designer: input.designer, startDate: input.startDate ? new Date(input.startDate) : null, dueDate: input.dueDate ? new Date(input.dueDate) : null, notes: input.notes, completion });
        onClose();
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
      }
    });
  }

  function remove() {
    if (!window.confirm("Excluir esta etapa do cronograma?")) return;
    startTransition(async () => {
      await deleteScheduleStageAction(card.id);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Edição rápida</p><h2 className="mt-1 text-lg font-bold text-slate-900">{card.name}</h2></div><button type="button" onClick={onClose} className="text-2xl text-slate-400" aria-label="Fechar">×</button></div>
        <form action={save} className="mt-6 space-y-4">
          <label className="block text-xs font-semibold text-slate-600">Nome<input name="name" defaultValue={card.name} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold text-slate-600">Descrição técnica<textarea name="description" defaultValue={card.description ?? ""} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold text-slate-600">Disciplina<input name="discipline" defaultValue={card.discipline ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block text-xs font-semibold text-slate-600">Responsável<input name="designer" defaultValue={card.designer ?? ""} list="stage-assignees" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <datalist id="stage-assignees"><option>Eduardo Marques</option><option>Luan Almeida</option><option>Erick Santiago</option></datalist>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Início<input name="startDate" type="date" defaultValue={card.startDate ? new Date(card.startDate).toISOString().slice(0, 10) : ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Prazo<input name="dueDate" type="date" defaultValue={card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label></div>
          <label className="block text-xs font-semibold text-slate-600">Avanço · {completion}%<input type="range" min="0" max="100" value={completion} onChange={(event) => setCompletion(Number(event.target.value))} className="mt-3 w-full accent-blue-600" /></label>
          <fieldset className="space-y-2"><legend className="text-xs font-semibold text-slate-600">Pendências rápidas</legend><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={checklist.dwg} onChange={(event) => setChecklist((current) => ({ ...current, dwg: event.target.checked }))} /> Enviar prancha em DWG</label><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={checklist.approval} onChange={(event) => setChecklist((current) => ({ ...current, approval: event.target.checked }))} /> Aprovação do cliente</label></fieldset>
          <label className="block text-xs font-semibold text-slate-600">Notas técnicas<textarea name="notes" defaultValue={card.notes ?? ""} rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <button type="submit" disabled={pending} className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "Salvando..." : "Salvar alterações"}</button>
        </form>
        <button type="button" disabled={pending} onClick={remove} className="mt-8 text-sm font-semibold text-rose-600 hover:text-rose-700">Excluir etapa</button>
      </aside>
    </div>
  );
}
