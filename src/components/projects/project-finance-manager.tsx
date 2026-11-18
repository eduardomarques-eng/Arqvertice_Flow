"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  formatDateBR,
  toInputDateFormat,
  parseDateSafe,
  formatCurrencyBRL,
} from "@/lib/formatters";
import {
  STANDARDIZED_DISCIPLINES,
  STANDARDIZED_FINANCIAL_STATUSES,
} from "@/lib/master-data";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { RealtimeSyncBadge, type RealtimeSyncStatus } from "@/hooks/use-realtime-mutation";

export type Installment = {
  id: string;
  description: string;
  amount: number;
  dueDate: string | Date;
  paidDate: string | Date | null;
  status: string;
  linkedStageId: string | null;
  order: number;
};

export type Stage = { id: string; name: string };

export const PREDEFINED_DISCIPLINES = STANDARDIZED_DISCIPLINES;
export const COMPANY_PIX_CNPJ = "66.773.164/0001-60";

export function isInstallmentPaid(status: string): boolean {
  return status === "PAID" || status === "Liquidado";
}

export function isInstallmentOverdue(item: Pick<Installment, "status" | "dueDate">): boolean {
  if (isInstallmentPaid(item.status)) return false;
  if (item.status === "OVERDUE" || item.status === "Atrasado") return true;
  const dueObj = parseDateSafe(item.dueDate);
  if (!dueObj) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return dueObj.getTime() < todayStart.getTime();
}

export function ProjectFinanceManager({
  projectId,
  initialInstallments,
  stages,
  readOnly = false,
  projectBudget,
  onInstallmentsChange,
}: {
  projectId: string;
  initialInstallments: Installment[];
  stages: Stage[];
  readOnly?: boolean;
  projectBudget?: number | null;
  onInstallmentsChange?: (next: Installment[]) => void;
}) {
  const [items, setItems] = useState<Installment[]>(initialInstallments);
  const [editing, setEditing] = useState<Installment | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<RealtimeSyncStatus>("idle");
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);

  // Estado do Gerador Automático de Parcelas
  const [genTotalAmount, setGenTotalAmount] = useState<string>(
    projectBudget && projectBudget > 0 ? String(projectBudget) : "15000"
  );
  const [genCount, setGenCount] = useState<number>(3);
  const [genEntryPercent, setGenEntryPercent] = useState<number>(30);
  const [genIntervalDays, setGenIntervalDays] = useState<number>(30);
  const [genFirstDueDate, setGenFirstDueDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [genLabelPrefix, setGenLabelPrefix] = useState<string>("Honorários Arquitetura");

  const updateItems = useCallback(
    (updater: (curr: Installment[]) => Installment[]) => {
      setItems((curr) => {
        const next = updater(curr);
        onInstallmentsChange?.(next);
        return next;
      });
    },
    [onInstallmentsChange]
  );

  const metrics = useMemo(() => {
    const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const paid = items
      .filter((item) => isInstallmentPaid(item.status))
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const overdue = items
      .filter((item) => isInstallmentOverdue(item))
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const toReceive = Math.max(0, total - paid);
    const next = items
      .filter((item) => !isInstallmentPaid(item.status))
      .toSorted((a, b) => {
        const timeA = parseDateSafe(a.dueDate)?.getTime() ?? 0;
        const timeB = parseDateSafe(b.dueDate)?.getTime() ?? 0;
        return timeA - timeB;
      })[0];

    return { total, paid, overdue, toReceive, next };
  }, [items]);

  function openModal(item: Installment) {
    if (readOnly) return;
    setEditing(item);
    setDescriptionInput(item.description);
    setError(null);
  }

  function handleSelectDiscipline(disciplineName: string) {
    if (!disciplineName) return;
    const orderNum = editing?.order ?? items.length + 1;
    setDescriptionInput(`${orderNum}ª Parcela - ${disciplineName}`);
  }

  async function handleCopyPix(item: Installment) {
    const text = `Cobrança ArqVértice · ${item.description} · Valor: ${formatCurrencyBRL(
      item.amount
    )} · Vencimento: ${formatDateBR(item.dueDate)} · Chave Pix CNPJ: ${COMPANY_PIX_CNPJ}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPixId(item.id);
      setTimeout(() => setCopiedPixId((curr) => (curr === item.id ? null : curr)), 2200);
    } catch {
      // ignore clipboard fallback
    }
  }

  async function save(form: FormData) {
    const status = String(form.get("status") ?? "PENDING");
    const payload = {
      description: (descriptionInput || String(form.get("description") ?? "")).trim(),
      amount: Number(form.get("amount")),
      dueDate: String(form.get("dueDate")),
      status,
      linkedStageId: String(form.get("linkedStageId") ?? "") || null,
      order: Number(form.get("order") ?? items.length + 1),
      paidDate: isInstallmentPaid(status)
        ? editing?.paidDate ?? new Date().toISOString()
        : null,
    };

    const isUpdate = Boolean(editing?.id);
    const tempId = editing?.id || `temp-${Date.now()}`;
    const optimisticRecord: Installment = {
      id: tempId,
      description: payload.description,
      amount: payload.amount,
      dueDate: payload.dueDate,
      paidDate: payload.paidDate,
      status: payload.status,
      linkedStageId: payload.linkedStageId,
      order: payload.order,
    };

    const prevSnapshot = items;
    // Resposta Otimista 0ms
    updateItems((current) =>
      isUpdate
        ? current.map((item) => (item.id === editing!.id ? optimisticRecord : item))
        : [...current, optimisticRecord].toSorted((a, b) => a.order - b.order)
    );
    setEditing(null);
    setError(null);
    setSyncStatus("syncing");

    const url = isUpdate
      ? `/api/projects/${projectId}/installments/${editing!.id}`
      : `/api/projects/${projectId}/installments`;

    try {
      const response = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error ?? "Não foi possível salvar a parcela.");
      }

      const saved = await response.json();
      updateItems((current) =>
        current
          .map((item) => (item.id === tempId ? saved : item))
          .toSorted((a, b) => a.order - b.order)
      );
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2200);
    } catch (err) {
      updateItems(() => prevSnapshot);
      setSyncStatus("error");
      setError(err instanceof Error ? err.message : "Erro ao salvar parcela.");
    }
  }

  async function remove(id: string) {
    if (readOnly) return;
    if (!window.confirm("Excluir esta parcela?")) return;

    const prevSnapshot = items;
    updateItems((current) => current.filter((item) => item.id !== id));
    setSyncStatus("syncing");

    try {
      const response = await fetch(`/api/projects/${projectId}/installments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Não foi possível excluir a parcela.");
      }
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2200);
    } catch (err) {
      updateItems(() => prevSnapshot);
      setSyncStatus("error");
      setError(err instanceof Error ? err.message : "Erro ao excluir parcela.");
    }
  }

  async function toggleStatus(item: Installment) {
    if (readOnly) return;
    const isPaid = isInstallmentPaid(item.status);
    const status = isPaid ? "PENDING" : "PAID";
    const nextPaidDate = isPaid ? null : new Date().toISOString();

    const prevSnapshot = items;
    // Resposta otimista instantânea no estado local (0ms)
    updateItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, status, paidDate: nextPaidDate } : entry
      )
    );
    setSyncStatus("syncing");
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/installments/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, paidDate: nextPaidDate }),
      });
      if (!response.ok) {
        throw new Error("Não foi possível atualizar o status.");
      }
      const saved = await response.json();
      updateItems((current) =>
        current.map((entry) => (entry.id === saved.id ? saved : entry))
      );
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2200);
    } catch (err) {
      updateItems(() => prevSnapshot);
      setSyncStatus("error");
      setError(
        err instanceof Error ? err.message : "Falha de conexão ao atualizar status."
      );
    }
  }

  // Gerador Automático de Parcelas com rateio exato de centavos
  const generatedPreview = useMemo(() => {
    const totalCents = Math.max(0, Math.round((Number(genTotalAmount) || 0) * 100));
    const count = Math.max(1, Math.min(36, Math.floor(genCount) || 1));
    const entryPct = count > 1 ? Math.max(0, Math.min(90, genEntryPercent)) : 100;
    const baseDate = parseDateSafe(genFirstDueDate) || new Date();

    const list: Array<{
      order: number;
      description: string;
      amount: number;
      dueDate: string;
    }> = [];

    if (count === 1) {
      list.push({
        order: items.length + 1,
        description: `01/01 - ${genLabelPrefix} (Parcela Única)`,
        amount: totalCents / 100,
        dueDate: baseDate.toISOString().slice(0, 10),
      });
      return list;
    }

    const entryCents =
      entryPct > 0 ? Math.round((totalCents * entryPct) / 100) : Math.floor(totalCents / count);
    const remainingCents = totalCents - entryCents;
    const restCount = count - 1;
    const eachRestCents = Math.floor(remainingCents / restCount);
    const remainderCents = remainingCents - eachRestCents * restCount;

    for (let i = 0; i < count; i++) {
      const due = new Date(baseDate.getTime());
      due.setDate(due.getDate() + i * Math.max(1, genIntervalDays));
      const numLabel = `${String(i + 1).padStart(2, "0")}/${String(count).padStart(2, "0")}`;
      const cents =
        i === 0
          ? entryCents
          : eachRestCents + (i === count - 1 ? remainderCents : 0);
      list.push({
        order: items.length + i + 1,
        description:
          i === 0 && entryPct > 0
            ? `${numLabel} - ${genLabelPrefix} (Entrada ${entryPct}%)`
            : `${numLabel} - ${genLabelPrefix}`,
        amount: Number((cents / 100).toFixed(2)),
        dueDate: due.toISOString().slice(0, 10),
      });
    }
    return list;
  }, [genTotalAmount, genCount, genEntryPercent, genIntervalDays, genFirstDueDate, genLabelPrefix, items.length]);

  async function handleGenerateInstallments(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly || generatedPreview.length === 0) return;

    const prevSnapshot = items;
    const optimisticList: Installment[] = generatedPreview.map((g, idx) => ({
      id: `temp-gen-${Date.now()}-${idx}`,
      description: g.description,
      amount: g.amount,
      dueDate: g.dueDate,
      paidDate: null,
      status: "PENDING",
      linkedStageId: null,
      order: g.order,
    }));

    updateItems((curr) => [...curr, ...optimisticList]);
    setIsGeneratorOpen(false);
    setSyncStatus("syncing");
    setError(null);

    try {
      const created = await Promise.all(
        optimisticList.map(async (inst) => {
          const res = await fetch(`/api/projects/${projectId}/installments`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              description: inst.description,
              amount: inst.amount,
              dueDate: inst.dueDate,
              status: "PENDING",
              linkedStageId: null,
              order: inst.order,
            }),
          });
          if (!res.ok) throw new Error("Falha ao criar uma ou mais parcelas.");
          return (await res.json()) as Installment;
        })
      );

      updateItems((curr) => {
        const tempIds = new Set(optimisticList.map((o) => o.id));
        const kept = curr.filter((c) => !tempIds.has(c.id));
        return [...kept, ...created].toSorted((a, b) => a.order - b.order);
      });
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 2400);
    } catch (err) {
      updateItems(() => prevSnapshot);
      setSyncStatus("error");
      setError(err instanceof Error ? err.message : "Erro ao gerar parcelamento.");
    }
  }

  const selectedDisciplineDefault = editing
    ? PREDEFINED_DISCIPLINES.find((d) =>
        editing.description.toLowerCase().includes(d.toLowerCase())
      ) ?? ""
    : "";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-zinc-900 print-avoid-break print:p-2 print:border-zinc-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm print:text-xs">
              Financeiro & Cronograma de Pagamentos
            </h3>
            <RealtimeSyncBadge status={syncStatus} errorMessage={error} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 print:hidden">
            Parcelas contratuais, baixa instantânea em 1 clique e cobrança Pix CNPJ ({COMPANY_PIX_CNPJ}).
          </p>
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 active:scale-95 transition dark:border-white/15 dark:bg-zinc-800 dark:text-slate-100 dark:hover:bg-zinc-700"
            >
              ⚡ Gerar Parcelamento
            </button>
            <button
              type="button"
              onClick={() =>
                openModal({
                  id: "",
                  description: "",
                  amount: 0,
                  dueDate: new Date().toISOString().slice(0, 10),
                  paidDate: null,
                  status: "PENDING",
                  linkedStageId: null,
                  order: items.length + 1,
                })
              }
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition"
            >
              + Nova Parcela
            </button>
          </div>
        ) : (
          <Link
            href={`/admin/projetos/${projectId}?tab=financeiro`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 print:hidden inline-flex items-center gap-1"
          >
            Gerenciar no Financeiro →
          </Link>
        )}
      </div>

      {/* Grid de Resumo Financeiro Superior (Responsivo 1 -> 2 -> 4 colunas) */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 bg-zinc-50/70 dark:bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-200/80 dark:border-white/10 print:grid-cols-4 print:p-2 print:gap-2 print:border-zinc-300 print:bg-zinc-50/40 print:my-1.5">
        {[
          ["Valor global", formatCurrencyBRL(metrics.total), "text-zinc-900 dark:text-slate-100"],
          ["Total recebido", formatCurrencyBRL(metrics.paid), "text-emerald-700 dark:text-emerald-400"],
          ["Saldo a receber", formatCurrencyBRL(metrics.toReceive), "text-blue-700 dark:text-blue-400"],
          [
            metrics.overdue > 0 ? "Em atraso" : "Próximo vencimento",
            metrics.overdue > 0
              ? formatCurrencyBRL(metrics.overdue)
              : metrics.next
              ? `${formatDateBR(metrics.next.dueDate)} · ${formatCurrencyBRL(metrics.next.amount)}`
              : "—",
            metrics.overdue > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-zinc-900 dark:text-slate-100",
          ],
        ].map(([label, value, toneClass]) => (
          <div key={label} className="rounded-lg p-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-mono truncate print:text-[9px]">
              {label}
            </p>
            <strong
              className={`mt-0.5 block text-sm font-bold font-mono tabular-nums truncate print:text-xs ${toneClass}`}
            >
              {value}
            </strong>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {/* Dual-View Automática: Tabela Desktop (>= 1024px) + Cards Empilhados Mobile/Tablet (< 1024px) */}
      <div className="mt-4">
        <ResponsiveDataView
          items={items}
          emptyState={
            <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhuma parcela cadastrada neste empreendimento. Use &ldquo;⚡ Gerar Parcelamento&rdquo; para criar automaticamente.
            </p>
          }
          renderDesktopTable={() => (
            <table className="w-full border-collapse text-left text-xs print:text-[10px]">
              <thead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-slate-400 border-b border-zinc-200 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-950/40 print:bg-transparent">
                <tr>
                  <th className="p-3 text-left font-mono font-bold">Parcela</th>
                  <th className="p-3 text-left">Descrição</th>
                  <th className="p-3 text-left">Etapa Vinculada</th>
                  <th className="p-3 text-left font-mono whitespace-nowrap">Vencimento</th>
                  <th className="p-3 text-right font-mono whitespace-nowrap">Valor</th>
                  <th className="p-3 text-center">Status</th>
                  {!readOnly && <th className="p-3 text-right print:hidden">Ações Rápidas</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {items.map((item, index) => {
                  const totalInstallments = String(items.length).padStart(2, "0");
                  const currentInstallment = String(index + 1).padStart(2, "0");
                  const installmentCode = `${currentInstallment}/${totalInstallments}`;
                  const isPaid = isInstallmentPaid(item.status);
                  const isOverdue = isInstallmentOverdue(item);
                  const isReadyToBill = item.status === "READY_TO_BILL";

                  return (
                    <tr
                      key={item.id || index}
                      className="hover:bg-zinc-50/60 dark:hover:bg-white/5 transition print-avoid-break"
                    >
                      <td className="p-3 font-mono font-bold text-zinc-700 dark:text-slate-300">
                        {installmentCode}
                      </td>
                      <td className="p-3 font-semibold text-zinc-900 dark:text-slate-100">
                        {item.description}
                      </td>
                      <td className="p-3 text-zinc-500 dark:text-slate-400 text-[11px] truncate max-w-[180px]">
                        {stages.find((stage) => stage.id === item.linkedStageId)?.name ?? "—"}
                      </td>
                      <td className="p-3 font-mono whitespace-nowrap">
                        <span
                          className={
                            isOverdue
                              ? "text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300 font-semibold px-1.5 py-0.5 rounded"
                              : isReadyToBill
                              ? "text-purple-700 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-300 font-semibold px-1.5 py-0.5 rounded"
                              : "text-zinc-600 dark:text-slate-300"
                          }
                        >
                          {formatDateBR(item.dueDate)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-semibold tabular-nums text-zinc-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrencyBRL(item.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                              : isOverdue
                              ? "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30"
                              : isReadyToBill
                              ? "bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30"
                              : "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30"
                          }`}
                        >
                          {isPaid
                            ? "PAGO"
                            : isOverdue
                            ? "ATRASADO"
                            : isReadyToBill
                            ? "AGENDADO / LIBERADO"
                            : "PENDENTE"}
                        </span>
                      </td>
                      {!readOnly && (
                        <td className="p-3 text-right whitespace-nowrap print:hidden">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleStatus(item)}
                              className={`min-h-[34px] rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                                isPaid
                                  ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-300"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              }`}
                            >
                              {isPaid ? "Reabrir" : "✓ Confirmar Recebimento"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyPix(item)}
                              title={`Copiar cobrança Pix CNPJ ${COMPANY_PIX_CNPJ}`}
                              className="min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-200"
                            >
                              {copiedPixId === item.id ? "Pix Copiado ✓" : "Pix"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal(item)}
                              className="min-h-[34px] rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(item.id)}
                              className="min-h-[34px] rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          renderMobileCard={(item, index) => {
            const totalInstallments = String(items.length).padStart(2, "0");
            const currentInstallment = String(index + 1).padStart(2, "0");
            const installmentCode = `${currentInstallment}/${totalInstallments}`;
            const isPaid = isInstallmentPaid(item.status);
            const isOverdue = isInstallmentOverdue(item);
            const isReadyToBill = item.status === "READY_TO_BILL";
            const stageName = stages.find((s) => s.id === item.linkedStageId)?.name;

            return (
              <div
                key={item.id || index}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-zinc-900 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        {installmentCode}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : isOverdue
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
                            : isReadyToBill
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                        }`}
                      >
                        {isPaid
                          ? "PAGO"
                          : isOverdue
                          ? "ATRASADO"
                          : isReadyToBill
                          ? "AGENDADO"
                          : "PENDENTE"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.description}
                    </p>
                    {stageName && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Etapa: {stageName}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-base font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrencyBRL(item.amount)}
                    </p>
                    <p
                      className={`mt-0.5 font-mono text-[11px] ${
                        isOverdue
                          ? "font-bold text-rose-600 dark:text-rose-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      Venc. {formatDateBR(item.dueDate)}
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => toggleStatus(item)}
                      className={`col-span-2 inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95 ${
                        isPaid
                          ? "border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {isPaid ? "Reabrir Parcela" : "✓ Confirmar Recebimento"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyPix(item)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-200"
                    >
                      {copiedPixId === item.id ? "Pix Copiado ✓" : "Copiar Pix CNPJ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal(item)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:border-white/10 dark:bg-zinc-800 dark:text-blue-400"
                    >
                      Editar / Excluir
                    </button>
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Modal / Bottom Sheet: Cadastro ou Edição de Parcela */}
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 max-sm:items-end max-sm:p-0 backdrop-blur-xs">
          <form
            action={save}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto space-y-4 rounded-3xl max-sm:rounded-b-none max-sm:rounded-t-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-slate-100 dark:border-white/10 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {editing.id ? "Editar Parcela Contratual" : "Nova Parcela Contratual"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Fechar"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Disciplina Vinculada
              </label>
              <select
                onChange={(e) => handleSelectDiscipline(e.target.value)}
                defaultValue={selectedDisciplineDefault}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-zinc-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Selecione a Disciplina da Parcela...</option>
                {PREDEFINED_DISCIPLINES.map((disc) => (
                  <option key={disc} value={disc}>
                    {disc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título / Descrição da Parcela *
              </label>
              <input
                name="description"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                required
                placeholder="Ex: 2ª Parcela - Projeto Estrutural"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 p-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Valor (R$) *
                </label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing.amount !== undefined ? editing.amount : ""}
                  required
                  placeholder="0.00"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 p-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Vencimento *
                </label>
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={toInputDateFormat(editing.dueDate)}
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 p-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vínculo com Etapa do Cronograma
                </label>
                <select
                  name="linkedStageId"
                  defaultValue={editing.linkedStageId ?? ""}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Sem etapa vinculada</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status de Quitação
                </label>
                <select
                  name="status"
                  defaultValue={
                    editing.status === "Liquidado"
                      ? "PAID"
                      : editing.status === "Pendente"
                      ? "PENDING"
                      : editing.status
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {STANDARDIZED_FINANCIAL_STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              {editing.id ? (
                <button
                  type="button"
                  onClick={() => {
                    const idToRemove = editing.id;
                    setEditing(null);
                    void remove(idToRemove);
                  }}
                  className="min-h-[44px] rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-950/30 transition"
                >
                  Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
                >
                  Salvar Parcela
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal / Bottom Sheet: Gerador Automático de Parcelas */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 max-sm:items-end max-sm:p-0 backdrop-blur-xs">
          <form
            onSubmit={handleGenerateInstallments}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto space-y-4 rounded-3xl max-sm:rounded-b-none max-sm:rounded-t-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-slate-100 dark:border-white/10 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  ⚡ Gerador Automático de Parcelas
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Rateio exato em centavos + Chave Pix CNPJ {COMPANY_PIX_CNPJ}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGeneratorOpen(false)}
                aria-label="Fechar"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prefixo / Título do Contrato
              </label>
              <input
                type="text"
                value={genLabelPrefix}
                onChange={(e) => setGenLabelPrefix(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 px-3 py-2 text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Valor Total (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={genTotalAmount}
                  onChange={(e) => setGenTotalAmount(e.target.value)}
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nº de Parcelas
                </label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Entrada (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={genEntryPercent}
                  onChange={(e) => setGenEntryPercent(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intervalo (dias)
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={genIntervalDays}
                  onChange={(e) => setGenIntervalDays(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                1º Vencimento (Entrada)
              </label>
              <input
                type="date"
                value={genFirstDueDate}
                onChange={(e) => setGenFirstDueDate(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 dark:bg-zinc-800 dark:text-slate-100 px-3 py-2 text-xs font-mono"
              />
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-zinc-950/60 p-3 space-y-1.5 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Prévia Automática ({generatedPreview.length} parcelas)
              </p>
              {generatedPreview.map((p) => (
                <div
                  key={p.order}
                  className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300"
                >
                  <span className="truncate pr-2">{p.description}</span>
                  <span className="font-mono font-semibold tabular-nums shrink-0">
                    {formatDateBR(p.dueDate)} · {formatCurrencyBRL(p.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsGeneratorOpen(false)}
                className="min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-slate-900 dark:bg-[#EDE5D8] dark:text-[#18181B] px-5 py-2 text-xs font-bold text-white hover:opacity-90"
              >
                Gerar & Salvar {generatedPreview.length} Parcelas
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
