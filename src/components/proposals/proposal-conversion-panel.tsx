"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertProposalAction, importEapIntoProposalAction } from "@/app/actions/domain-actions";

export function ProposalConversionPanel({
  proposalId,
  status,
  contractStatus,
  convertedAt,
  hasEap,
  canEdit,
}: {
  proposalId: string;
  status: string;
  contractStatus: string | null;
  convertedAt: string | null;
  hasEap: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  const readyToConvert = status === "APPROVED" && contractStatus === "SIGNED" && !convertedAt;

  function handleImportEap() {
    setFeedback("");
    setIsError(false);
    startTransition(async () => {
      try {
        await importEapIntoProposalAction(proposalId);
        setFeedback("Escopo e valores da EAP importados para uma nova versão da proposta.");
        router.refresh();
      } catch (err) {
        setIsError(true);
        setFeedback(err instanceof Error ? err.message : "Falha ao importar EAP.");
      }
    });
  }

  function handleConvert() {
    setFeedback("");
    setIsError(false);
    startTransition(async () => {
      try {
        const outcome = await convertProposalAction(proposalId);
        setFeedback(
          outcome.alreadyConverted
            ? "Proposta já havia sido convertida."
            : `Conversão concluída! Projeto movido para ${outcome.projectStatusAfter} com ${outcome.installmentsCreated} parcela(s) em Financeiro.`,
        );
        router.refresh();
      } catch (err) {
        setIsError(true);
        setFeedback(err instanceof Error ? err.message : "Falha ao converter proposta.");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <a
        href={`/api/proposals/${proposalId}/pdf`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        Baixar PDF Editorial
      </a>

      {hasEap && canEdit ? (
        <button
          type="button"
          disabled={pending}
          onClick={handleImportEap}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
        >
          {pending ? "Importando…" : "Importar Escopo & Valor da EAP"}
        </button>
      ) : null}

      {readyToConvert ? (
        <button
          type="button"
          disabled={pending}
          onClick={handleConvert}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "Convertendo…" : "Converter Proposta Aprovada → Financeiro & Obra"}
        </button>
      ) : convertedAt ? (
        <span className="inline-flex min-h-10 items-center rounded-xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-800">
          Convertida em {new Date(convertedAt).toLocaleDateString("pt-BR")}
        </span>
      ) : null}

      {feedback ? (
        <p className={`w-full text-xs font-medium ${isError ? "text-rose-600" : "text-emerald-700"}`}>{feedback}</p>
      ) : null}
    </div>
  );
}
