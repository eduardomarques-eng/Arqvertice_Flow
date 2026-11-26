"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { EapCoherenceAuditResult } from "@/server/eap/eap-coherence-auditor";

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function EapCoherenceAuditDrawer({
  projectId,
  refreshKey,
  onAfterAutoFix,
}: {
  projectId: string;
  refreshKey?: number | string;
  onAfterAutoFix?: () => void;
}) {
  const [audit, setAudit] = useState<EapCoherenceAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/audit`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setAudit(json.audit as EapCoherenceAuditResult);
      }
    } catch {
      // Silencioso no badge
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit, refreshKey]);

  const handleAutoFix = async () => {
    setFixing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "AUTO_FIX_TAXONOMY" }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setAudit(json.audit as EapCoherenceAuditResult);
        setFeedback("Taxonomia e equipes LOB alinhadas e cascata sincronizada com sucesso.");
        onAfterAutoFix?.();
      } else {
        setFeedback(json.error || "Não foi possível aplicar correção automática.");
      }
    } catch {
      setFeedback("Erro de rede ao executar correção automática.");
    } finally {
      setFixing(false);
    }
  };

  const critical = audit?.summary.critical ?? 0;
  const warning = audit?.summary.warning ?? 0;
  const badgeTone = critical > 0 ? "amber" : warning > 0 ? "neutral" : "green";
  const badgeLabel = loading
    ? "Auditando..."
    : critical > 0
      ? `Auditoria: ${critical} crítico(s)`
      : warning > 0
        ? `Auditoria: ${warning} alerta(s)`
        : "Auditoria: Coerente";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void loadAudit();
        }}
        className="inline-flex items-center gap-1.5 cursor-pointer"
        title="Abrir Auditor de Coerência Orçamentária e Benchmark Regional"
      >
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-[#13131A] dark:border-l dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">
                  Auditor de Coerência Orçamentária EAP
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Validação automática de etapas obrigatórias, proporção Material × Mão de Obra, duplicidades e benchmark SINAPI/CUB.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:text-zinc-300"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {audit && (
                <>
                  <div className="grid grid-cols-3 gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Críticos</p>
                      <p className={`text-lg font-bold ${critical > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {audit.summary.critical}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Atenção</p>
                      <p className="text-lg font-bold text-amber-600">{audit.summary.warning}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-500">R$/m² Direto</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                        {fmtBRL(audit.benchmark.projectDirectPerM2)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/30">
                    <p className="font-bold text-slate-900 dark:text-zinc-100">
                      Benchmark Regional ({audit.benchmark.cityLabel})
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-zinc-300">
                      <div>
                        Direto Obra: <strong>{fmtBRL(audit.benchmark.projectDirectPerM2)}/m²</strong>
                      </div>
                      <div>
                        SINAPI-CE: <strong>{fmtBRL(audit.benchmark.sinapiDirectPerM2)}/m²</strong> (
                        {audit.benchmark.deltaVsSinapiPercent >= 0 ? "+" : ""}
                        {audit.benchmark.deltaVsSinapiPercent}%)
                      </div>
                      <div>
                        Com BDI Obra: <strong>{fmtBRL(audit.benchmark.projectWithBdiPerM2)}/m²</strong>
                      </div>
                      <div>
                        CUB-CE: <strong>{fmtBRL(audit.benchmark.cubWithBdiPerM2)}/m²</strong> (
                        {audit.benchmark.deltaVsCubPercent >= 0 ? "+" : ""}
                        {audit.benchmark.deltaVsCubPercent}%)
                      </div>
                    </div>
                  </div>

                  {feedback && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      {feedback}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {audit.alerts.map((alert) => {
                      const borderCls =
                        alert.severity === "CRITICAL"
                          ? "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30"
                          : alert.severity === "WARNING"
                            ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30"
                            : "border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-900/40";
                      const tagCls =
                        alert.severity === "CRITICAL"
                          ? "bg-rose-600 text-white"
                          : alert.severity === "WARNING"
                            ? "bg-amber-600 text-white"
                            : "bg-slate-600 text-white";

                      return (
                        <div key={alert.id} className={`rounded-2xl border p-3.5 ${borderCls}`}>
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tagCls}`}>
                              {alert.severity}
                            </span>
                            {alert.stageCode && (
                              <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                                Etapa {alert.stageCode}
                              </span>
                            )}
                            <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                              {alert.title}
                            </p>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-700 dark:text-zinc-300">
                            {alert.description}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                            Ação sugerida: {alert.recommendation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => void loadAudit()}
                disabled={loading}
                className="h-9 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {loading ? "Auditando..." : "↻ Reauditar"}
              </button>
              <button
                type="button"
                onClick={() => void handleAutoFix()}
                disabled={fixing}
                className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
              >
                {fixing ? "Corrigindo..." : "Corrigir Automaticamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
