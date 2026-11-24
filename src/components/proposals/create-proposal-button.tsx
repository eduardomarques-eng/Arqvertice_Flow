"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProposalAction } from "@/app/actions/domain-actions";

interface ProjectOption {
  id: string;
  name: string;
  clientName?: string | null;
}

export function CreateProposalButton({
  projectId,
  projects,
  label = "+ Nova Proposta",
  compact = false,
}: {
  projectId?: string;
  projects?: ProjectOption[];
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || projects?.[0]?.id || "");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function triggerCreate(targetProjectId: string) {
    if (!targetProjectId) {
      setError("Selecione um projeto para gerar a proposta.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const proposal = await createProposalAction(targetProjectId);
        router.push(`/admin/propostas/${proposal.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível criar a proposta.");
      }
    });
  }

  if (projectId) {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => triggerCreate(projectId)}
          className={
            compact
              ? "inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              : "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          }
        >
          {pending ? "Abrindo…" : label}
        </button>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return null;
  }

  if (!showPicker) {
    return (
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <select
        value={selectedProjectId}
        onChange={(e) => setSelectedProjectId(e.target.value)}
        className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
        aria-label="Selecionar projeto"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.clientName ? ` — ${p.clientName}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => triggerCreate(selectedProjectId)}
        className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? "Gerando…" : "Criar e Editar"}
      </button>
      <button
        type="button"
        onClick={() => setShowPicker(false)}
        className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600"
      >
        Cancelar
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}
