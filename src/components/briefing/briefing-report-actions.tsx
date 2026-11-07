"use client";

import { useState } from "react";

export function BriefingReportActions({ briefingId, clientName }: { briefingId: string; clientName: string }) {
  const [message, setMessage] = useState("");

  async function copyLink() {
    const link = `${window.location.origin}/admin/briefing/${briefingId}/relatorio`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copiado.");
    } catch {
      setMessage("Não foi possível copiar o link.");
    }
  }

  return <div className="print:hidden"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => window.print()} className="rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white">Imprimir / Salvar PDF</button><a href={`/admin/briefing/${briefingId}/editor`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Editar Perguntas (Canvas)</a><button type="button" onClick={copyLink} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Copiar Link do Cliente</button>{message ? <span className="text-xs text-emerald-700">{message}</span> : null}</div><span className="sr-only">{clientName}</span></div>;
}
