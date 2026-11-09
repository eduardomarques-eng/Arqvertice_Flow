"use client";

import { useState } from "react";
import Link from "next/link";
import {
  formatDateBR,
  toISODateInput,
  parseDateSafe,
  formatCurrencyBRL,
} from "@/lib/formatters";

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

export const PREDEFINED_DISCIPLINES = [
  "Projeto Arquitetônico",
  "Projeto Estrutural",
  "Projetos Complementares",
  "Projeto 3D Modelagem e Imagens",
];

export function ProjectFinanceManager({
  projectId,
  initialInstallments,
  stages,
  readOnly = false,
}: {
  projectId: string;
  initialInstallments: Installment[];
  stages: Stage[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState(initialInstallments);
  const [editing, setEditing] = useState<Installment | null>(null);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const paid = items
    .filter((item) => item.status === "PAID" || item.status === "Liquidado")
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const next = items
    .filter((item) => item.status === "PENDING" || item.status === "Pendente")
    .toSorted((a, b) => {
      const timeA = parseDateSafe(a.dueDate)?.getTime() ?? 0;
      const timeB = parseDateSafe(b.dueDate)?.getTime() ?? 0;
      return timeA - timeB;
    })[0];

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

  async function save(form: FormData) {
    const status = String(form.get("status") ?? "PENDING");
    const payload = {
      description: (descriptionInput || String(form.get("description") ?? "")).trim(),
      amount: Number(form.get("amount")),
      dueDate: String(form.get("dueDate")),
      status,
      linkedStageId: String(form.get("linkedStageId") ?? "") || null,
      order: Number(form.get("order") ?? items.length + 1),
      paidDate: status === "PAID" ? editing?.paidDate ?? new Date().toISOString() : null,
    };

    const url = editing?.id
      ? `/api/projects/${projectId}/installments/${editing.id}`
      : `/api/projects/${projectId}/installments`;

    const response = await fetch(url, {
      method: editing?.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setError((await response.json()).error ?? "Não foi possível salvar.");
      return;
    }

    const saved = await response.json();
    setItems((current) =>
      editing?.id
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved].toSorted((a, b) => a.order - b.order),
    );
    setEditing(null);
    setError(null);
  }

  async function remove(id: string) {
    if (readOnly) return;
    if (!window.confirm("Excluir esta parcela?")) return;
    const response = await fetch(`/api/projects/${projectId}/installments/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Não foi possível excluir a parcela.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function toggleStatus(item: Installment) {
    const isPaid = item.status === "PAID" || item.status === "Liquidado";
    const status = isPaid ? "PENDING" : "PAID";
    const nextPaidDate = isPaid ? null : new Date().toISOString();

    // Resposta otimista instantânea no estado local (0ms)
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, status, paidDate: nextPaidDate } : entry,
      ),
    );

    try {
      const response = await fetch(`/api/projects/${projectId}/installments/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, paidDate: nextPaidDate }),
      });
      if (!response.ok) {
        setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
        setError("Não foi possível atualizar o status.");
        return;
      }
      const saved = await response.json();
      setItems((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    } catch {
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
      setError("Falha de conexão ao atualizar status.");
    }
  }

  const selectedDisciplineDefault = editing
    ? PREDEFINED_DISCIPLINES.find((d) =>
        editing.description.toLowerCase().includes(d.toLowerCase()),
      ) ?? ""
    : "";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs print-avoid-break print:p-2 print:border-zinc-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm print:text-xs">
            Financeiro & Condições Comerciais
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 print:hidden">
            Parcelas contratuais vinculadas às disciplinas e etapas do cronograma.
          </p>
        </div>

        {!readOnly ? (
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
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition print:hidden"
          >
            + Adicionar Parcela
          </button>
        ) : (
          <Link
            href={`/admin/projetos/${projectId}?tab=financeiro`}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 print:hidden inline-flex items-center gap-1"
          >
            Gerenciar no Financeiro →
          </Link>
        )}
      </div>

      {/* Grid de Resumo Financeiro Superior */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50/70 p-3.5 rounded-xl border border-zinc-200/80 print:grid-cols-4 print:p-2 print:gap-2 print:border-zinc-300 print:bg-zinc-50/40 print:my-1.5">
        {[
          ["Valor global", formatCurrencyBRL(total)],
          ["Total recebido", formatCurrencyBRL(paid)],
          ["Saldo a receber", formatCurrencyBRL(total - paid)],
          [
            "Próximo vencimento",
            next ? `${formatDateBR(next.dueDate)} · ${formatCurrencyBRL(next.amount)}` : "—",
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg p-1">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono print:text-[9px]">
              {label}
            </p>
            <strong className="mt-0.5 block text-sm font-bold text-zinc-900 font-mono print:text-xs">
              {value}
            </strong>
          </div>
        ))}
      </div>

      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs table-fixed print:text-[10px]">
          <thead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-zinc-200 bg-zinc-50/60 print:bg-transparent">
            <tr>
              <th className="w-[10%] p-2 text-left font-mono font-bold text-zinc-700 print:p-1">Parcela</th>
              <th className={readOnly ? "w-[38%] p-2 text-left font-medium text-zinc-900 print:p-1" : "w-[30%] p-2 text-left font-medium text-zinc-900 print:p-1"}>Descrição</th>
              <th className="w-[20%] p-2 text-left text-zinc-500 print:p-1">Etapa Vinculada</th>
              <th className="w-[14%] p-2 text-left font-mono whitespace-nowrap print:p-1">Vencimento</th>
              <th className="w-[14%] p-2 text-right font-mono font-semibold text-zinc-900 whitespace-nowrap print:p-1">Valor</th>
              <th className="w-[12%] p-2 text-center print:p-1">Status</th>
              {!readOnly && <th className="p-2 text-center print:hidden w-[10%]">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item, index) => {
              const totalInstallments = String(items.length).padStart(2, "0");
              const currentInstallment = String(index + 1).padStart(2, "0");
              const installmentCode = `${currentInstallment}/${totalInstallments}`;

              const dueObj = parseDateSafe(item.dueDate);
              const isOverdue =
                item.status === "OVERDUE" ||
                ((item.status === "PENDING" || item.status === "Pendente") &&
                  dueObj !== null &&
                  dueObj.getTime() < new Date().setHours(0, 0, 0, 0));

              const isPaid = item.status === "PAID" || item.status === "Liquidado";

              return (
                <tr
                  key={item.id || index}
                  className="hover:bg-zinc-50/50 transition print-avoid-break print:hover:bg-transparent"
                >
                  <td className="p-2 text-left font-mono font-bold text-zinc-700 print:p-1 print:text-[10px]">
                    {installmentCode}
                  </td>
                  <td className="p-2 text-left font-semibold text-zinc-900 print:p-1 print:text-[10px]">
                    {item.description}
                  </td>
                  <td className="p-2 text-left text-zinc-500 text-[11px] truncate print:p-1 print:text-[9.5px]">
                    {stages.find((stage) => stage.id === item.linkedStageId)?.name ?? "—"}
                  </td>
                  <td className="p-2 text-left font-mono whitespace-nowrap print:p-1 print:text-[10px]">
                    <span
                      className={
                        isOverdue
                          ? "text-rose-600 bg-rose-50/60 font-semibold px-1 py-0.5 rounded"
                          : "text-zinc-600"
                      }
                    >
                      {formatDateBR(item.dueDate)}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-zinc-900 whitespace-nowrap print:p-1 print:text-[10px]">
                    {formatCurrencyBRL(item.amount)}
                  </td>
                  <td className="p-2 text-center print:p-1">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleStatus(item)}
                      title={readOnly ? undefined : "Alternar status (Pago / Pendente)"}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition active:scale-95 inline-block ${
                        isPaid
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : isOverdue
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      } ${readOnly ? "cursor-default pointer-events-none" : "hover:opacity-85"}`}
                    >
                      {isPaid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                    </button>
                  </td>
                  {!readOnly && (
                    <td className="p-2 text-center whitespace-nowrap print:hidden">
                      <button
                        type="button"
                        onClick={() => openModal(item)}
                        className="mr-2 font-semibold text-xs text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="font-semibold text-xs text-rose-600 hover:text-rose-800"
                      >
                        Excluir
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">Nenhuma parcela cadastrada.</p>
        ) : null}
      </div>

      {/* Modal de Cadastro / Edição com Pré-preenchimento e Seleção de Disciplina */}
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
          <form
            action={save}
            className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editing.id ? "Editar Parcela Contratual" : "Nova Parcela Contratual"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Fechar"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Dropdown de disciplina vinculada */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Disciplina Vinculada
              </label>
              <select
                onChange={(e) => handleSelectDiscipline(e.target.value)}
                defaultValue={selectedDisciplineDefault}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Título / Descrição da Parcela *
              </label>
              <input
                name="description"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                required
                placeholder="Ex: 2ª Parcela - Projeto Estrutural"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor (R$) *
                </label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing.amount || ""}
                  required
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data de Vencimento *
                </label>
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={toISODateInput(editing.dueDate)}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vínculo com Etapa do Cronograma
                </label>
                <select
                  name="linkedStageId"
                  defaultValue={editing.linkedStageId ?? ""}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status de Quitação
                </label>
                <select
                  name="status"
                  defaultValue={editing.status === "Liquidado" ? "PAID" : editing.status === "Pendente" ? "PENDING" : editing.status}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="PENDING">Pendente</option>
                  <option value="PAID">Pago</option>
                  <option value="OVERDUE">Atrasado</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
              >
                Salvar Parcela
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
