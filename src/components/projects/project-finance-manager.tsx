"use client";

import { useState } from "react";

type Installment = {
  id: string;
  description: string;
  amount: number;
  dueDate: string | Date;
  paidDate: string | Date | null;
  status: string;
  linkedStageId: string | null;
  order: number;
};

type Stage = { id: string; name: string };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | Date) => new Date(value).toLocaleDateString("pt-BR");

export function ProjectFinanceManager({ projectId, initialInstallments, stages }: { projectId: string; initialInstallments: Installment[]; stages: Stage[] }) {
  const [items, setItems] = useState(initialInstallments);
  const [editing, setEditing] = useState<Installment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const paid = items.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
  const next = items.filter((item) => item.status === "PENDING").toSorted((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];

  async function save(form: FormData) {
    const status = String(form.get("status") ?? "PENDING");
    const payload = {
      description: String(form.get("description") ?? "").trim(),
      amount: Number(form.get("amount")),
      dueDate: String(form.get("dueDate")),
      status,
      linkedStageId: String(form.get("linkedStageId") ?? "") || null,
      order: Number(form.get("order") ?? items.length + 1),
      paidDate: status === "PAID" ? editing?.paidDate ?? new Date().toISOString() : null,
    };
    const url = editing ? `/api/projects/${projectId}/installments/${editing.id}` : `/api/projects/${projectId}/installments`;
    const response = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      setError((await response.json()).error ?? "Não foi possível salvar.");
      return;
    }
    const saved = await response.json();
    setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].toSorted((a, b) => a.order - b.order));
    setEditing(null);
    setError(null);
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta parcela?")) return;
    const response = await fetch(`/api/projects/${projectId}/installments/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("Não foi possível excluir a parcela."); return; }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function toggleStatus(item: Installment) {
    const status = item.status === "PAID" ? "PENDING" : "PAID";
    const nextPaidDate = status === "PAID" ? new Date().toISOString() : null;

    // Resposta otimista instantânea no estado local
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
        // Reverte se falhou
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

  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold text-slate-900">Financeiro & Condições Comerciais</h2><p className="mt-1 text-sm text-slate-500">Parcelas editáveis vinculadas às entregas do cronograma.</p></div>
      <button type="button" onClick={() => setEditing({ id: "", description: "", amount: 0, dueDate: new Date().toISOString().slice(0, 10), paidDate: null, status: "PENDING", linkedStageId: null, order: items.length + 1 })} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">+ Adicionar Parcela</button>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">
      {[["Valor global", money.format(total)], ["Total recebido", money.format(paid)], ["Saldo a receber", money.format(total - paid)], ["Próximo vencimento", next ? `${date(next.dueDate)} · ${money.format(next.amount)}` : "—"]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-sm text-slate-900">{value}</strong></div>)}
    </div>
    {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-2">Parcela</th><th className="p-2">Descrição</th><th className="p-2">Etapa</th><th className="p-2">Vencimento</th><th className="p-2">Valor</th><th className="p-2">Status</th><th className="p-2">Ações</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 font-semibold">{String(item.order).padStart(2, "0")}/{items.length.toString().padStart(2, "0")}</td><td className="p-2">{item.description}</td><td className="p-2">{stages.find((stage) => stage.id === item.linkedStageId)?.name ?? "—"}</td><td className={`p-2 ${item.status === "OVERDUE" ? "font-bold text-rose-600" : ""}`}>{date(item.dueDate)}</td><td className="p-2">{money.format(item.amount)}</td><td className="p-2"><button type="button" onClick={() => toggleStatus(item)} className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "PAID" ? "bg-emerald-100 text-emerald-700" : item.status === "OVERDUE" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{item.status === "PAID" ? "Pago" : item.status === "OVERDUE" ? "Atrasado" : "Pendente"}</button></td><td className="p-2"><button type="button" onClick={() => setEditing(item)} className="mr-2 font-semibold text-blue-600">Editar</button><button type="button" onClick={() => remove(item.id)} className="font-semibold text-rose-600">Excluir</button></td></tr>)}</tbody></table>{items.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">Nenhuma parcela cadastrada.</p> : null}</div>
    {editing ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><form action={save} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><h3 className="font-semibold"> {editing.id ? "Editar parcela" : "Adicionar parcela"}</h3><button type="button" onClick={() => setEditing(null)} aria-label="Fechar">×</button></div><input name="description" defaultValue={editing.description} required placeholder="Descrição do marco" className="w-full rounded-xl border p-2 text-sm" /><div className="grid grid-cols-2 gap-3"><input name="amount" type="number" step="0.01" min="0" defaultValue={editing.amount} required placeholder="Valor" className="rounded-xl border p-2 text-sm" /><input name="dueDate" type="date" defaultValue={String(editing.dueDate).slice(0, 10)} required className="rounded-xl border p-2 text-sm" /></div><select name="linkedStageId" defaultValue={editing.linkedStageId ?? ""} className="w-full rounded-xl border p-2 text-sm"><option value="">Sem etapa vinculada</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select><select name="status" defaultValue={editing.status} className="w-full rounded-xl border p-2 text-sm"><option value="PENDING">Pendente</option><option value="PAID">Pago</option><option value="OVERDUE">Atrasado</option></select><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button><button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">Salvar</button></div></form></div> : null}
  </section>;
}
