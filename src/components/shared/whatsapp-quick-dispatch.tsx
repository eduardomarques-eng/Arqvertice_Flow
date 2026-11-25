"use client";

import { useState } from "react";

export type WhatsAppRecipientRole = "CLIENTE" | "ENGENHEIRO" | "ARQUITETO";

interface RecipientPreset {
  role: WhatsAppRecipientRole;
  label: string;
  defaultName: string;
  defaultPhone: string;
}

interface WhatsAppQuickDispatchProps {
  entityType: "PROPOSTA" | "CONTRATO";
  documentTitle: string;
  projectName: string;
  projectId?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string | null;
  engineerName?: string;
  engineerPhone?: string | null;
  architectName?: string;
  architectPhone?: string | null;
  summaryText: string;
  documentUrl?: string | null;
}

function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function WhatsAppQuickDispatch({
  entityType,
  documentTitle,
  projectName,
  projectId,
  clientId,
  clientName = "Cliente",
  clientPhone = "",
  engineerName = "Emanoel Luan (Parceiro Estrutural)",
  engineerPhone = "",
  architectName = "Coordenação / Arquiteto Responsável",
  architectPhone = "",
  summaryText,
  documentUrl,
}: WhatsAppQuickDispatchProps) {
  const presets: RecipientPreset[] = [
    {
      role: "CLIENTE",
      label: "Enviar para o Cliente",
      defaultName: clientName,
      defaultPhone: clientPhone || "",
    },
    {
      role: "ENGENHEIRO",
      label: "Enviar para o Engenheiro",
      defaultName: engineerName,
      defaultPhone: engineerPhone || "",
    },
    {
      role: "ARQUITETO",
      label: "Enviar para o Arquiteto",
      defaultName: architectName,
      defaultPhone: architectPhone || "",
    },
  ];

  const [activeRole, setActiveRole] = useState<WhatsAppRecipientRole>("CLIENTE");
  const [phones, setPhones] = useState<Record<WhatsAppRecipientRole, string>>({
    CLIENTE: clientPhone || "",
    ENGENHEIRO: engineerPhone || "",
    ARQUITETO: architectPhone || "",
  });
  const [names, setNames] = useState<Record<WhatsAppRecipientRole, string>>({
    CLIENTE: clientName,
    ENGENHEIRO: engineerName,
    ARQUITETO: architectName,
  });

  const buildDefaultMessage = (role: WhatsAppRecipientRole) => {
    const greeting =
      role === "CLIENTE"
        ? `Olá, ${names.CLIENTE || "Cliente"}!`
        : role === "ENGENHEIRO"
          ? `Olá, Eng. ${names.ENGENHEIRO || "Emanoel Luan"}!`
          : `Olá, ${names.ARQUITETO || "Coordenação"}!`;
    const typeLabel = entityType === "PROPOSTA" ? "Proposta Comercial" : "Minuta Contratual";
    const resolvedLink =
      documentUrl ||
      (typeof window !== "undefined" ? window.location.href : "");
    return [
      `${greeting}`,
      `Segue o resumo da *${typeLabel}* — *${documentTitle}* (${projectName}):`,
      "",
      summaryText,
      resolvedLink ? `\nAcesse o documento/PDF: ${resolvedLink}` : "",
      "\n_ArqVértice Studio · ArqVértice OS_",
    ]
      .filter((line) => line !== undefined)
      .join("\n");
  };

  const [messageText, setMessageText] = useState<string>(() =>
    buildDefaultMessage("CLIENTE")
  );
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);
  const [history, setHistory] = useState<
    Array<{ role: WhatsAppRecipientRole; name: string; phone: string; mode: string; at: string }>
  >([]);

  function handleSelectRole(role: WhatsAppRecipientRole) {
    setActiveRole(role);
    setMessageText(buildDefaultMessage(role));
    setFeedback(null);
  }

  async function handleDispatch() {
    const rawPhone = phones[activeRole].trim();
    const digits = normalizePhoneDigits(rawPhone);
    if (!digits || digits.length < 10) {
      setFeedback({
        tone: "error",
        text: "Informe um número de WhatsApp válido com DDD antes de disparar.",
      });
      return;
    }

    setSending(true);
    setFeedback(null);
    let sentViaApi = false;

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          toPhone: digits,
          contactName: names[activeRole],
          projectId: projectId || null,
          clientId: activeRole === "CLIENTE" ? clientId || null : null,
          text: messageText,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.message?.status === "SENT") {
          sentViaApi = true;
          setFeedback({
            tone: "ok",
            text: `Mensagem enviada pela API interna do WhatsApp para ${names[activeRole]} (${rawPhone}).`,
          });
        }
      }
    } catch {
      // fallback to wa.me below
    }

    if (!sentViaApi) {
      const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      setFeedback({
        tone: "warn",
        text: `Gateway WhatsApp offline/em fila — link oficial wa.me aberto para ${names[activeRole]} (${rawPhone}).`,
      });
    }

    setHistory((prev) => [
      {
        role: activeRole,
        name: names[activeRole],
        phone: rawPhone,
        mode: sentViaApi ? "API Interna" : "wa.me",
        at: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev.slice(0, 4),
    ]);
    setSending(false);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Disparo Rápido via WhatsApp
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Envie o resumo executivo e link do documento diretamente pela API interna ou via{" "}
            <code className="font-mono text-[11px]">wa.me</code>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const isActive = activeRole === preset.role;
          return (
            <button
              key={preset.role}
              type="button"
              onClick={() => handleSelectRole(preset.role)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Destinatário ({activeRole})
          </label>
          <input
            type="text"
            value={names[activeRole]}
            onChange={(e) =>
              setNames((prev) => ({ ...prev, [activeRole]: e.target.value }))
            }
            className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            WhatsApp com DDD
          </label>
          <input
            type="tel"
            value={phones[activeRole]}
            onChange={(e) =>
              setPhones((prev) => ({ ...prev, [activeRole]: e.target.value }))
            }
            placeholder="(85) 99999-9999"
            className="mt-1 h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-mono text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
          Mensagem Formatada
        </label>
        <textarea
          rows={4}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void handleDispatch()}
          disabled={sending}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
        >
          {sending
            ? "Disparando..."
            : `Disparar para ${activeRole === "CLIENTE" ? "Cliente" : activeRole === "ENGENHEIRO" ? "Engenheiro" : "Arquiteto"}`}
        </button>

        {history.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400">
            <span>Últimos disparos:</span>
            {history.map((h, idx) => (
              <span
                key={`${h.role}-${h.at}-${idx}`}
                className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {h.role} ({h.mode} · {h.at})
              </span>
            ))}
          </div>
        )}
      </div>

      {feedback && (
        <p
          role="status"
          className={`text-xs font-medium ${
            feedback.tone === "ok"
              ? "text-emerald-700 dark:text-emerald-400"
              : feedback.tone === "warn"
                ? "text-amber-700 dark:text-amber-300"
                : "text-rose-700 dark:text-rose-400"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
