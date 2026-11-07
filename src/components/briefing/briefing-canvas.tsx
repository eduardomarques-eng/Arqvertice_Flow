"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { useState, useTransition } from "react";
import { saveBriefingQuestionsAction } from "@/app/actions/domain-actions";
import type { BriefingOption, BriefingQuestion } from "@/lib/briefing-schema";
import { ANSWER_KIND } from "@/lib/briefing-schema";

export function BriefingCanvas({ projectId, initialTitle, initialQuestions }: { projectId: string; initialTitle: string; initialQuestions: BriefingQuestion[] }) {
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState(initialQuestions);
  const [expanded, setExpanded] = useState<string | null>(initialQuestions[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function save() {
    startTransition(async () => {
      await saveBriefingQuestionsAction(projectId, { title, questions });
      setMessage("Alterações salvas.");
    });
  }
  function addQuestion() {
    const id = `custom_${Date.now()}`;
    setQuestions((current) => [...current, { id, category: "Personalizadas", type: ANSWER_KIND.MULTI_SELECT, text: "Nova pergunta", required: false, options: [] }]);
    setExpanded(id);
  }
  function update(id: string, patch: Partial<BriefingQuestion>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
  }
  function remove(id: string) {
    setQuestions((current) => current.filter((question) => question.id !== id));
  }
  function reorder(result: DropResult) {
    if (!result.destination) return;
    setQuestions((current) => {
      const next = [...current];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination!.index, 0, moved);
      return next;
    });
  }
  return (
    <div>
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="flex-1 text-xs font-semibold text-slate-500">Título do briefing<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
        <div className="flex items-center gap-3"><span className="text-xs text-slate-500">{questions.filter((question) => question.active !== false).length} ativas</span><button type="button" onClick={save} disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">{pending ? "Salvando..." : "Salvar alterações"}</button></div>
      </div>
      <DragDropContext onDragEnd={reorder}>
        <Droppable droppableId="briefing-questions">
          {(provided) => <div ref={provided.innerRef} {...provided.droppableProps} className="mt-5 space-y-3">{questions.map((question, index) => <Draggable key={question.id} draggableId={question.id} index={index}>{(dragProvided, snapshot) => <article ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={`rounded-2xl border bg-white p-4 shadow-sm ${question.active === false ? "opacity-60" : ""} ${snapshot.isDragging ? "ring-2 ring-indigo-300" : ""}`}><div className="flex items-start gap-3"><button type="button" {...dragProvided.dragHandleProps} className="cursor-grab px-1 text-slate-400" aria-label="Reordenar pergunta">⋮⋮</button><button type="button" onClick={() => setExpanded(expanded === question.id ? null : question.id)} className="min-w-0 flex-1 text-left"><span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">{question.category ?? "Programa de necessidades"} · {question.type}</span><h2 className="mt-1 font-semibold text-slate-900">{question.text}</h2></button><label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={question.active !== false} onChange={(event) => update(question.id, { active: event.target.checked })} /> Ativa</label><button type="button" onClick={() => remove(question.id)} className="text-xs font-semibold text-rose-600">Excluir</button></div>{expanded === question.id ? <QuestionEditor question={question} onChange={(patch) => update(question.id, patch)} /> : null}</article>}</Draggable>)}{provided.placeholder}</div>}
        </Droppable>
      </DragDropContext>
      <button type="button" onClick={addQuestion} className="mt-5 rounded-xl border border-dashed border-indigo-300 px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50">+ Nova pergunta</button>
      {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
    </div>
  );
}

function QuestionEditor({ question, onChange }: { question: BriefingQuestion; onChange: (patch: Partial<BriefingQuestion>) => void }) {
  const options = question.options ?? question.visualOptions ?? [];
  function updateOption(index: number, patch: Partial<BriefingOption>) {
    onChange({ options: options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) });
  }
  return <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-500">Categoria<input value={question.category ?? ""} onChange={(event) => onChange({ category: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-500">Tipo<select value={question.type} onChange={(event) => onChange({ type: event.target.value as BriefingQuestion["type"] })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value={ANSWER_KIND.SINGLE_SELECT}>Seleção única</option><option value={ANSWER_KIND.MULTI_SELECT}>Múltipla escolha</option><option value={ANSWER_KIND.IMAGE_CHOICE}>Cards com imagens</option></select></label></div><label className="text-xs font-semibold text-slate-500">Pergunta<textarea value={question.text} onChange={(event) => onChange({ text: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-500">Descrição técnica<textarea value={question.hint ?? ""} onChange={(event) => onChange({ hint: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><div className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">Opções</span><button type="button" onClick={() => onChange({ options: [...options, { value: `option_${Date.now()}`, label: "Nova opção" }] })} className="text-xs font-bold text-indigo-600">+ opção</button></div>{options.map((option, index) => <div key={`${option.value}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]"><input value={option.label} onChange={(event) => updateOption(index, { label: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" placeholder="Rótulo" /><input value={option.description ?? ""} onChange={(event) => updateOption(index, { description: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" placeholder="Descrição" /><input value={option.imageUrl ?? ""} onChange={(event) => updateOption(index, { imageUrl: event.target.value || null })} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" placeholder="URL da imagem" /><button type="button" onClick={() => onChange({ options: options.filter((_, optionIndex) => optionIndex !== index) })} className="text-xs text-rose-600">Remover</button></div>)}</div></div>;
}
