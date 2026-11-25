"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProposalAction } from "@/app/actions/domain-actions";
import { SCOPE_TEMPLATES, type ScopeTemplateKey } from "@/lib/scope-templates";

interface ProjectOption {
  id: string;
  name: string;
  clientName?: string | null;
  hasBriefing?: boolean;
  areaM2?: number;
  suggestedTemplate?: ScopeTemplateKey;
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
  const [useBriefing, setUseBriefing] = useState<boolean>(true);
  const [templateKey, setTemplateKey] = useState<ScopeTemplateKey>(
    projects?.[0]?.suggestedTemplate ?? "COMPLETO"
  );
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleProjectChange(nextId: string) {
    setSelectedProjectId(nextId);
    const found = projects?.find((p) => p.id === nextId);
    if (found?.suggestedTemplate) {
      setTemplateKey(found.suggestedTemplate);
    }
  }

  function triggerCreate(targetProjectId: string, withOptions = false) {
    if (!targetProjectId) {
      setError("Selecione um projeto para gerar a proposta.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const proposal = await createProposalAction(
          targetProjectId,
          withOptions ? { useBriefing, templateKey, forceNew: true } : undefined
        );
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
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 cursor-pointer dark:bg-zinc-100 dark:text-zinc-950"
      >
        {label}
      </button>
    );
  }

  const activeProj = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Projeto / Cliente
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            aria-label="Selecionar projeto"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.clientName ? ` — ${p.clientName}` : ""}
                {p.hasBriefing ? " [Briefing OK]" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Template de Escopo
          </label>
          <select
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value as ScopeTemplateKey)}
            className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            aria-label="Selecionar template de escopo"
          >
            {(Object.keys(SCOPE_TEMPLATES) as ScopeTemplateKey[]).map((key) => (
              <option key={key} value={key}>
                {SCOPE_TEMPLATES[key].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={useBriefing}
          onChange={(e) => setUseBriefing(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        Puxar dados e escopo do Briefing
        {activeProj?.hasBriefing ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Briefing disponível ({activeProj.areaM2 ?? 180} m²)
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">(usa medidas do projeto)</span>
        )}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => triggerCreate(selectedProjectId, true)}
          className="min-h-9 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-zinc-100 dark:text-zinc-950"
        >
          {pending ? "Gerando…" : "Criar e Editar Proposta"}
        </button>
        <button
          type="button"
          onClick={() => setShowPicker(false)}
          className="min-h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
        >
          Cancelar
        </button>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>
    </div>
  );
}
