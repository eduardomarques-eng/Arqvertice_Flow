"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createBriefingLinkAction, revokeBriefingLinkAction } from "@/app/actions/domain-actions";

export function BriefingLinkManager({
  projectId,
  initialStatus,
  clientName,
  clientPhone,
}: {
  projectId: string;
  initialStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  initialLinkStatus: "ACTIVE" | "REVOKED";
  clientName?: string;
  clientPhone?: string | null;
}) {
  const [link, setLink] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [pending, startTransition] = useTransition();

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  async function generate() {
    startTransition(async () => {
      try {
        const res = await createBriefingLinkAction(projectId);
        if (!res || !res.ok) {
          const err = res && "error" in res ? String(res.error) : "Erro ao gerar link.";
          showToast(err, "error");
          return;
        }

        const base = typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://arqvertice-flow.vercel.app";
        const value = `${base}/briefing/${res.token}`;
        setLink(value);

        try {
          await window.navigator.clipboard.writeText(value);
          showToast("Link gerado e copiado para a área de transferência!", "success");
        } catch {
          showToast("Link gerado com sucesso. Copie o endereço abaixo.", "info");
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Erro inesperado ao gerar link.", "error");
      }
    });
  }

  const phone = clientPhone?.replace(/\D/g, "");
  const whatsapp = link && phone
    ? `https://wa.me/55${phone}?text=${encodeURIComponent(
        `Olá ${clientName ?? ""}, preparamos um quiz exclusivo para conhecer em detalhes os desejos e necessidades do seu projeto. Acesse pelo link: ${link}`
      )}`
    : null;

  const email = link
    ? `mailto:?subject=${encodeURIComponent("Briefing do seu projeto | ArqVértice")}&body=${encodeURIComponent(
        `Olá ${clientName ?? ""},\n\nPreparamos um quiz exclusivo para conhecer os desejos e necessidades do seu projeto:\n${link}\n\nEquipe ArqVértice`
      )}`
    : null;

  return (
    <section className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 p-5 shadow-sm transition-all">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">Briefing do cliente</p>
          </div>
          <h2 className="mt-1 font-semibold text-slate-900">Link Exclusivo & Protegido</h2>
          <p className="mt-1 text-sm text-slate-600">
            Status:{" "}
            <span className="font-medium text-slate-900">
              {initialStatus === "SUBMITTED"
                ? "Respondido (Concluído)"
                : initialStatus === "IN_PROGRESS"
                ? "Em preenchimento"
                : "Pendente de envio"}
            </span>
          </p>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={generate}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Gerando link seguro…
            </span>
          ) : (
            "Gerar / regenerar link"
          )}
        </button>
      </div>

      {toast && (
        <div
          className={`mt-4 flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : toast.type === "error"
              ? "bg-rose-50 text-rose-800 border border-rose-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {link && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-3 shadow-inner">
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              aria-label="Link do briefing"
              className="min-h-10 min-w-0 flex-1 select-all rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center rounded-lg bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              Abrir
            </a>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                showToast("Link copiado para a área de transferência!", "success");
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              Copiar link
            </button>

            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                <span>Enviar via WhatsApp</span>
              </a>
            ) : (
              <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
                Cadastre o WhatsApp do cliente
              </span>
            )}

            {email ? (
              <a
                href={email}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
              >
                Enviar via e-mail
              </a>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <Link
          href={`/admin/briefing/${projectId}/relatorio`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-slate-200 transition hover:bg-indigo-50/50"
        >
          <span>▣ Visualizar Dossiê do Quiz</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Revogar o link atual? O cliente deixará de acessá-lo imediatamente.")) return;
            startTransition(async () => {
              try {
                const res = await revokeBriefingLinkAction(projectId);
                if (res && !res.ok) {
                  showToast(res.error ?? "Erro ao revogar link.", "error");
                  return;
                }
                setLink("");
                showToast("Link revogado com sucesso.", "info");
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Erro ao revogar.", "error");
              }
            });
          }}
          className="text-xs font-semibold text-rose-600 transition hover:text-rose-800"
        >
          Revogar link
        </button>
      </div>
    </section>
  );
}
