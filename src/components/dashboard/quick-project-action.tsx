"use client";

import { useState } from "react";
import { saveProjectAction } from "@/app/actions/domain-actions";

export function QuickProjectAction({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      await saveProjectAction({
        clientId: String(formData.get("clientId") ?? ""),
        name: String(formData.get("name") ?? ""),
        type: String(formData.get("type") ?? "") || undefined,
        status: "PLANNING",
      });
      setOpen(false);
      setMessage("Projeto criado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o projeto.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-neutral-200/70 bg-white/80 px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:text-neutral-950">
        + Novo Projeto
      </button>
      {message ? <span role="status" className="self-center text-xs font-medium text-emerald-700">{message}</span> : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/30 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quick-project-title">
          <form action={submit} className="w-full max-w-md rounded-3xl border border-neutral-200/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Ação rápida</p><h2 id="quick-project-title" className="mt-1 text-xl font-bold text-neutral-900">Novo projeto</h2></div>
              <button type="button" onClick={() => setOpen(false)} className="text-xl text-neutral-400" aria-label="Fechar">×</button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-neutral-700">Nome do projeto<input name="name" required className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" placeholder="Residência de Praia" /></label>
              <label className="block text-sm font-medium text-neutral-700">Cliente<select name="clientId" required className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500"><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
              <label className="block text-sm font-medium text-neutral-700">Tipo<input name="type" className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" placeholder="Arquitetura residencial" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600">Cancelar</button><button type="submit" disabled={pending || clients.length === 0} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Criando..." : "Criar projeto"}</button></div>
            {clients.length === 0 ? <p className="mt-3 text-xs text-amber-700">Cadastre um cliente antes de criar um projeto.</p> : null}
          </form>
        </div>
      ) : null}
    </>
  );
}
