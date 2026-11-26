"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  EapProcurementItemDTO,
  ProcurementPlanSummaryDTO,
  ProcurementStatus,
} from "@/server/eap/procurement-plan";

interface EapProcurementViewProps {
  projectId: string;
  onSyncedFinance?: () => void;
}

const STATUS_META: Record<
  ProcurementStatus,
  { label: string; tone: "neutral" | "amber" | "blue" | "green" }
> = {
  A_COTAR: { label: "A Cotar", tone: "neutral" },
  EM_COTACAO: { label: "Em Cotação", tone: "amber" },
  PEDIDO_EMITIDO: { label: "Pedido Emitido", tone: "blue" },
  ENTREGUE: { label: "Entregue", tone: "green" },
};

function formatBrl(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDateBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function EapProcurementView({
  projectId,
  onSyncedFinance,
}: EapProcurementViewProps) {
  const [items, setItems] = useState<EapProcurementItemDTO[]>([]);
  const [summary, setSummary] = useState<ProcurementPlanSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProcurementStatus>("ALL");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"compras" | "calendario" | "curva_s">("compras");
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { supplierName?: string; closedAmount?: string; leadTimeDays?: string }>
  >({});

  const monthlyRows = useMemo(() => {
    const byMonth = new Map<string, { amount: number; pkgs: Set<string> }>();
    for (const item of items) {
      const iso = (item.orderDeadlineDate || item.needDate || "").slice(0, 7);
      const monthKey = /^\d{4}-\d{2}$/.test(iso) ? iso : "2026-01";
      const curr = byMonth.get(monthKey) ?? { amount: 0, pkgs: new Set<string>() };
      curr.amount += item.closedAmount ?? item.estimatedAmount ?? 0;
      if (item.packageName) curr.pkgs.add(item.packageName);
      byMonth.set(monthKey, curr);
    }
    const keys = Array.from(byMonth.keys()).sort();
    const total = keys.reduce((s, k) => s + (byMonth.get(k)?.amount ?? 0), 0);
    let cum = 0;
    return keys.map((k) => {
      const entry = byMonth.get(k)!;
      cum += entry.amount;
      const [yr, mo] = k.split("-");
      return {
        monthKey: k,
        monthLabel: `${mo}/${yr.slice(2)}`,
        mainPackages: Array.from(entry.pkgs).slice(0, 2).join(", ") || "Suprimentos Gerais",
        monthlyAmount: entry.amount,
        cumulativeAmount: cum,
        cumulativePct: total > 0 ? Math.round((cum / total) * 1000) / 10 : 0,
      };
    });
  }, [items]);

  const critical15dCount = useMemo(() => {
    const now = Date.now();
    const limit = now + 15 * 86_400_000;
    return items.filter((i) => {
      if (i.status === "ENTREGUE" || i.status === "PEDIDO_EMITIDO") return false;
      const t = new Date(i.orderDeadlineDate).getTime();
      return Number.isFinite(t) && t <= limit;
    }).length;
  }, [items]);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/procurement`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage({
          type: "err",
          text: json.error || "Não foi possível carregar o plano de aquisições.",
        });
        return;
      }
      setItems(json.items || []);
      setSummary(json.summary || null);
    } catch {
      setMessage({ type: "err", text: "Erro de conexão ao carregar aquisições." });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  async function handleGenerate() {
    setBusy("generate");
    setMessage(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/procurement`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage({ type: "err", text: json.error || "Erro ao gerar plano." });
        return;
      }
      setItems(json.items || []);
      setSummary(json.summary || null);
      setMessage({
        type: "ok",
        text: `Plano de Aquisições atualizado com ${(json.items || []).length} item(ns) cruzando EAP × LOB.`,
      });
    } catch {
      setMessage({ type: "err", text: "Erro de conexão ao gerar aquisições." });
    } finally {
      setBusy(null);
    }
  }

  async function handleSyncFinance() {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/procurement/sync-finance`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage({ type: "err", text: json.error || "Erro ao sincronizar financeiro." });
        return;
      }
      setItems(json.items || []);
      setSummary(json.summary || null);
      setMessage({
        type: "ok",
        text: `${json.syncedCount ?? 0} pedido(s) sincronizado(s) com o Gestão Financeira.`,
      });
      onSyncedFinance?.();
    } catch {
      setMessage({ type: "err", text: "Erro de conexão ao sincronizar financeiro." });
    } finally {
      setBusy(null);
    }
  }

  async function handlePatchItem(
    itemId: string,
    payload: {
      status?: ProcurementStatus;
      supplierName?: string | null;
      closedAmount?: number | null;
      leadTimeDays?: number;
      syncToFinance?: boolean;
    }
  ) {
    setBusy(itemId);
    setMessage(null);
    try {
      const res = await fetch(`/api/eap/projects/${projectId}/procurement/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessage({ type: "err", text: json.error || "Erro ao atualizar compra." });
        return;
      }
      setItems(json.items || []);
      setSummary(json.summary || null);
      if (payload.status === "PEDIDO_EMITIDO" || payload.syncToFinance) {
        setMessage({
          type: "ok",
          text: "Pedido emitido e comprometimento lançado no Gestão Financeira.",
        });
        onSyncedFinance?.();
      }
    } catch {
      setMessage({ type: "err", text: "Erro de conexão ao salvar compra." });
    } finally {
      setBusy(null);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.itemName.toLowerCase().includes(q) ||
        item.packageName.toLowerCase().includes(q) ||
        (item.supplierName || "").toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, search]);

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Barra de Ações & KPIs */}
      <Card className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-md dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="ArqVértice Studio"
              className="h-10 w-10 shrink-0 rounded-xl border border-zinc-200/80 bg-white object-contain p-1 dark:border-zinc-700"
            />
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
                Plano de Aquisições &amp; Compras da Obra
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Cruzamento automático de insumos da Planilha EAP com as datas de início dos pacotes no Planejamento LOB.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy !== null}
              className="h-9 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer dark:bg-amber-500 dark:text-zinc-950"
            >
              {busy === "generate" ? "Gerando..." : "⚡ Gerar / Atualizar Plano"}
            </button>
            <button
              type="button"
              onClick={handleSyncFinance}
              disabled={busy !== null}
              className="h-9 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {busy === "sync" ? "Sincronizando..." : "Sincronizar com Financeiro"}
            </button>
            <button
              type="button"
              onClick={() => setShowPdfPreview(true)}
              className="inline-flex h-9 items-center rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Pré-visualizar &amp; Exportar PDF
            </button>
          </div>
        </div>

        {/* Quadro Resumo Explicativo para o Cliente */}
        <div className="mt-4 rounded-2xl border border-sky-200/80 bg-sky-50/60 p-3.5 text-xs text-slate-700 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-zinc-300">
          <strong className="text-sky-900 dark:text-sky-300">Como funciona o Plano de Aquisições:</strong>{" "}
          O painel cruza os insumos da Planilha EAP com o cronograma da obra para indicar{" "}
          <strong>quanto está orçado</strong>, <strong>quanto já foi comprometido em pedidos</strong> e as{" "}
          <strong>datas-limite de compra</strong> para evitar atrasos no canteiro.
        </div>

        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[11px] font-medium text-zinc-500">Orçamento de Suprimentos</p>
              <p className="mt-1 font-mono text-sm font-bold text-zinc-950 dark:text-zinc-100">
                {formatBrl(summary.totalEstimated)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[11px] font-medium text-zinc-500">Comprometido (Pedidos Emitidos)</p>
              <p className="mt-1 font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {formatBrl(summary.totalCommittedFinance || summary.totalClosed)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[11px] font-medium text-zinc-500">Em Cotação / A Cotar</p>
              <p className="mt-1 font-mono text-sm font-bold text-amber-700 dark:text-amber-400">
                {summary.quotingCount} / {summary.toQuoteCount}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[11px] font-medium text-zinc-500">Saldo a Contratar</p>
              <p className="mt-1 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                {formatBrl(
                  Math.max(
                    0,
                    summary.totalEstimated - (summary.totalCommittedFinance || summary.totalClosed)
                  )
                )}
              </p>
            </div>
          </div>
        )}

        {/* Sub-visões limpas dentro de 4. Aquisições */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200/80 pt-3 dark:border-zinc-800">
          {(
            [
              { id: "compras", label: "Plano de Compras" },
              { id: "calendario", label: "Calendário de Suprimentos" },
              { id: "curva_s", label: "Curva S & Desembolso Mensal" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`h-8 rounded-xl px-3.5 text-xs font-semibold cursor-pointer ${
                activeTab === t.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Filtros & Tabela (Plano de Compras) */}
      {activeTab === "compras" && (
      <Card className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "ALL", label: `Todos (${items.length})` },
                { id: "A_COTAR", label: `A Cotar (${summary?.toQuoteCount ?? 0})` },
                { id: "EM_COTACAO", label: `Em Cotação (${summary?.quotingCount ?? 0})` },
                { id: "PEDIDO_EMITIDO", label: `Pedido Emitido (${summary?.orderedCount ?? 0})` },
                { id: "ENTREGUE", label: `Entregue (${summary?.deliveredCount ?? 0})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`h-8 rounded-xl px-3 text-xs font-semibold cursor-pointer ${
                  statusFilter === f.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar insumo, pacote ou fornecedor..."
            className="h-8 w-full max-w-xs rounded-xl border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-zinc-500">Carregando plano de aquisições...</p>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nenhum item de aquisição encontrado. Clique em <strong>Gerar / Atualizar Plano</strong> para importar os insumos da EAP com base no cronograma LOB.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2.5 pr-3">Insumo / Serviço</th>
                  <th className="py-2.5 px-2">Pacote LOB</th>
                  <th className="py-2.5 px-2">Necessidade</th>
                  <th className="py-2.5 px-2">Lead Time</th>
                  <th className="py-2.5 px-2">Limite Pedido</th>
                  <th className="py-2.5 px-2 text-right">Previsto</th>
                  <th className="py-2.5 px-2">Fornecedor</th>
                  <th className="py-2.5 px-2 text-right">Fechado (R$)</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 pl-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredItems.map((item) => {
                  const draft = draftEdits[item.id] || {};
                  const supplierVal =
                    draft.supplierName !== undefined ? draft.supplierName : item.supplierName || "";
                  const closedVal =
                    draft.closedAmount !== undefined
                      ? draft.closedAmount
                      : item.closedAmount !== null
                        ? String(item.closedAmount)
                        : "";
                  const leadVal =
                    draft.leadTimeDays !== undefined
                      ? draft.leadTimeDays
                      : String(item.leadTimeDays);
                  const meta = STATUS_META[item.status] || STATUS_META.A_COTAR;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.itemName}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {item.quantity} {item.unit} · {item.category}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                        {item.packageNumber ? `P${item.packageNumber} · ` : ""}
                        {item.packageName}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[11px]">
                        {formatDateBr(item.needDate)}
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          min={0}
                          max={365}
                          value={leadVal}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], leadTimeDays: e.target.value },
                            }))
                          }
                          onBlur={() => {
                            const n = Number(leadVal);
                            if (Number.isFinite(n) && n !== item.leadTimeDays) {
                              handlePatchItem(item.id, { leadTimeDays: Math.max(0, Math.round(n)) });
                            }
                          }}
                          className="h-7 w-14 rounded-lg border border-zinc-200 px-1.5 text-center font-mono text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <span className="ml-1 text-[10px] text-zinc-400">Dias Úteis</span>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[11px] font-semibold">
                        {formatDateBr(item.orderDeadlineDate)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono">
                        {formatBrl(item.estimatedAmount)}
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          value={supplierVal}
                          placeholder="Fornecedor..."
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], supplierName: e.target.value },
                            }))
                          }
                          onBlur={() => {
                            if (supplierVal !== (item.supplierName || "")) {
                              handlePatchItem(item.id, { supplierName: supplierVal || null });
                            }
                          }}
                          className="h-7 w-32 rounded-lg border border-zinc-200 px-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={closedVal}
                          placeholder="0,00"
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], closedAmount: e.target.value },
                            }))
                          }
                          onBlur={() => {
                            const n = closedVal.trim() === "" ? null : Number(closedVal);
                            if (n !== item.closedAmount && (n === null || Number.isFinite(n))) {
                              handlePatchItem(item.id, { closedAmount: n });
                            }
                          }}
                          className="h-7 w-24 rounded-lg border border-zinc-200 px-2 text-right font-mono text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col gap-1">
                          <select
                            value={item.status}
                            disabled={busy === item.id}
                            onChange={(e) =>
                              handlePatchItem(item.id, {
                                status: e.target.value as ProcurementStatus,
                              })
                            }
                            className="h-7 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold dark:border-zinc-700 dark:bg-zinc-950"
                          >
                            <option value="A_COTAR">A Cotar</option>
                            <option value="EM_COTACAO">Em Cotação</option>
                            <option value="PEDIDO_EMITIDO">Pedido Emitido</option>
                            <option value="ENTREGUE">Entregue</option>
                          </select>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        {item.status === "A_COTAR" || item.status === "EM_COTACAO" ? (
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() =>
                              handlePatchItem(item.id, {
                                status: "PEDIDO_EMITIDO",
                                syncToFinance: true,
                              })
                            }
                            className="h-7 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            Emitir Pedido
                          </button>
                        ) : item.financialEntryId ? (
                          <Badge tone="green">Financeiro OK</Badge>
                        ) : (
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() =>
                              handlePatchItem(item.id, { syncToFinance: true })
                            }
                            className="h-7 rounded-lg border border-emerald-300 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            Lançar Financeiro
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}
      {/* Sub-visão: Calendário de Suprimentos */}
      {activeTab === "calendario" && (
        <Card className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-md dark:border-zinc-800 dark:bg-zinc-900/95 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
              Calendário de Suprimentos (Datas-Limite de Pedido &amp; Entrega)
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Cronograma de disparo de compras ordenado pela data-limite conforme o lead time de cada pacote.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Data Limite Pedido</th>
                  <th className="px-3 py-2">Necessidade Obra</th>
                  <th className="px-3 py-2">Insumo / Serviço</th>
                  <th className="px-3 py-2">Pacote</th>
                  <th className="px-3 py-2 text-right">Valor Previsto</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((item) => (
                  <tr key={item.id} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-3 py-2 font-mono font-bold">{formatDateBr(item.orderDeadlineDate)}</td>
                    <td className="px-3 py-2 font-mono">{formatDateBr(item.needDate)}</td>
                    <td className="px-3 py-2 font-medium">{item.itemName}</td>
                    <td className="px-3 py-2 text-[11px] text-zinc-500">{item.packageName}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatBrl(item.closedAmount ?? item.estimatedAmount)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_META[item.status]?.tone || "neutral"}>
                        {STATUS_META[item.status]?.label || item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sub-visão: Curva S & Desembolso Mensal */}
      {activeTab === "curva_s" && (
        <Card className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-md dark:border-zinc-800 dark:bg-zinc-900/95 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
              Curva S Financeira &amp; Fluxo de Desembolso Mensal
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Projeção mensal de desembolso de suprimentos e percentual acumulado ao longo da obra.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Mês/Ano</th>
                  <th className="px-3 py-2">Principais Pacotes/Compras do Mês</th>
                  <th className="px-3 py-2 text-right">Desembolso Mensal (R$)</th>
                  <th className="px-3 py-2 text-right">Acumulado (R$)</th>
                  <th className="px-3 py-2 text-right">% Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {monthlyRows.map((m) => (
                  <tr key={m.monthKey} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-3 py-2 font-mono font-bold">{m.monthLabel}</td>
                    <td className="px-3 py-2">{m.mainPackages}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatBrl(m.monthlyAmount)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatBrl(m.cumulativeAmount)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-blue-700 dark:text-blue-400">
                      {m.cumulativePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Pré-visualização antes de Exportar PDF */}
      {showPdfPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setShowPdfPreview(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4 dark:border-zinc-800 dark:bg-[#13131A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
                  Pré-visualização — Aquisições &amp; Calendário de Suprimentos (PDF)
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Inclui Curva S Financeira Acumulada, Fluxo de Desembolso Mensal e Calendário de Suprimentos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/eap/projects/${projectId}/procurement/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-amber-500 dark:text-zinc-950"
                >
                  Confirmar &amp; Baixar PDF
                </a>
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(false)}
                  className="h-9 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 cursor-pointer dark:border-zinc-700 dark:text-zinc-200"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Mês/Ano</th>
                    <th className="px-3 py-2">Principais Pacotes</th>
                    <th className="px-3 py-2 text-right">Desembolso Mensal</th>
                    <th className="px-3 py-2 text-right">Acumulado</th>
                    <th className="px-3 py-2 text-right">% Acum.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {monthlyRows.map((m) => (
                    <tr key={m.monthKey}>
                      <td className="px-3 py-1.5 font-mono font-bold">{m.monthLabel}</td>
                      <td className="px-3 py-1.5">{m.mainPackages}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatBrl(m.monthlyAmount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatBrl(m.cumulativeAmount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">{m.cumulativePct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
