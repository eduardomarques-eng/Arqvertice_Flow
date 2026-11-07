"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveScheduleStageAction } from "@/app/actions/domain-actions";

export function ScheduleStageCreateForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      projectId,
      name: String(form.get("name") ?? "").trim(),
      discipline: String(form.get("discipline") ?? "").trim() || null,
      designer: String(form.get("designer") ?? "").trim() || null,
      dueDate: String(form.get("dueDate") ?? "").trim() || null,
      order: Number(form.get("order") ?? 0),
      completion: 0,
    };
    setError(null);
    startTransition(async () => {
      try {
        await saveScheduleStageAction(input);
        setOpen(false);
        event.currentTarget.reset();
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível criar a etapa.");
      }
    });
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Adicionar nova etapa</button>;
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Nome da etapa" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
        <input name="discipline" placeholder="Disciplina" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input name="designer" placeholder="Responsável" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <label className="text-xs text-slate-500">Prazo<input name="dueDate" type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs text-slate-500">Ordem<input name="order" type="number" min="0" defaultValue="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Salvar etapa</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
      </div>
    </form>
  );
}
