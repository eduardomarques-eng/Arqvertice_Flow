"use client";

import { useState } from "react";

type Client = { id: string; name: string; fullName: string | null; email: string | null; phone: string | null; document: string | null; address: unknown; status: string };
type Installment = { id: string; projectId: string; projectName: string; description: string; amount: number; dueDate: string | Date; paidDate: string | Date | null; status: string };
type Project = { id: string; name: string; type: string | null; progress: number };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string | Date) => new Date(value).toLocaleDateString("pt-BR");
const field = "min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm";

function addressText(address: unknown) {
  if (!address) return "";
  if (typeof address === "string") return address;
  if (typeof address === "object" && address !== null && "formatted" in address) return String(address.formatted);
  return "";
}

export function ClientDetailManager({ client, installments, projects, hasAccess }: { client: Client; installments: Installment[]; projects: Project[]; hasAccess: boolean }) {
  const [current, setCurrent] = useState(client);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [access, setAccess] = useState<{ email: string; temporaryPassword: string | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const total = installments.reduce((sum, item) => sum + item.amount, 0);
  const paid = installments.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);

  async function save(form: FormData) {
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      fullName: String(form.get("fullName") ?? "").trim() || null,
      email: String(form.get("email") ?? "").trim() || null,
      phone: String(form.get("phone") ?? "").trim() || null,
      document: String(form.get("document") ?? "").trim() || null,
      address: { formatted: String(form.get("address") ?? "").trim() },
      status: String(form.get("status") ?? "ACTIVE"),
    };
    const response = await fetch(`/api/clients/${current.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { setError((await response.json()).error ?? "Não foi possível salvar."); return; }
    setCurrent(await response.json());
    setEditing(false);
    setError("");
  }

  async function createAccess() {
    const response = await fetch(`/api/clients/${current.id}/create-access`, { method: "POST" });
    if (!response.ok) { setError((await response.json()).error ?? "Não foi possível criar o acesso."); return; }
    setAccess(await response.json());
  }

  async function togglePaid(item: Installment) {
    const status = item.status === "PAID" ? "PENDING" : "PAID";
    const response = await fetch(`/api/projects/${item.projectId}/installments/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, paidDate: status === "PAID" ? new Date().toISOString() : null }),
    });
    if (!response.ok) { setError("Não foi possível atualizar a parcela."); return; }
    window.location.reload();
  }

  async function addInstallment(form: FormData) {
    const projectId = String(form.get("projectId") ?? "");
    const response = await fetch(`/api/projects/${projectId}/installments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        description: String(form.get("description") ?? "").trim(),
        amount: Number(form.get("amount")),
        dueDate: String(form.get("dueDate")),
        status: "PENDING",
        order: 1,
      }),
    });
    if (!response.ok) { setError((await response.json()).error ?? "Não foi possível adicionar a parcela."); return; }
    setAdding(false);
    window.location.reload();
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setEditing(true)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">✎ Editar Dados</button>
        <button type="button" onClick={createAccess} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Gerar / Redefinir Acesso ao Portal</button>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${current.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{current.status}</span>
    </div>
    {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
    {access ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><strong>Mensagem pronta para WhatsApp:</strong><p className="mt-2 whitespace-pre-line">Olá, {current.name}! Seu acesso ao portal ArqVértice está disponível em {window.location.origin}/login. Use o e-mail {access.email}{access.temporaryPassword ? ` e a senha inicial ${access.temporaryPassword}` : " e sua senha cadastrada"}. Acesse para acompanhar seus projetos.</p></div> : null}
    <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Contacto & Acesso</h2>
      <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-slate-400">Nome</dt><dd>{current.fullName ?? current.name}</dd></div><div><dt className="text-xs text-slate-400">E-mail</dt><dd className="break-all">{current.email ?? "—"}</dd></div><div><dt className="text-xs text-slate-400">Telefone / WhatsApp</dt><dd>{current.phone ?? "—"}</dd></div><div><dt className="text-xs text-slate-400">CPF/CNPJ</dt><dd>{current.document ?? "—"}</dd></div></dl>
      <p className={`mt-5 rounded-xl p-3 text-sm font-semibold ${hasAccess || access ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{hasAccess || access ? "Acesso ativo (portal liberado)" : "Pendente de ativação"}</p>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Resumo financeiro consolidado</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[["Total contratado", total], ["Total recebido", paid], ["Saldo em aberto", total - paid]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-sm">{money.format(Number(value))}</strong></div>)}
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-2">Projeto</th><th className="p-2">Parcela</th><th className="p-2">Vencimento</th><th className="p-2">Valor</th><th className="p-2">Status</th><th className="p-2">Ação</th></tr></thead><tbody>{installments.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2">{item.projectName}</td><td className="p-2">{item.description}</td><td className="p-2">{date(item.dueDate)}</td><td className="p-2">{money.format(item.amount)}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "PAID" ? "bg-emerald-100 text-emerald-700" : item.status === "OVERDUE" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{item.status === "PAID" ? "Liquidado" : item.status === "OVERDUE" ? "Atrasado" : "Pendente"}</span></td><td className="p-2">{item.status !== "PAID" ? <button type="button" onClick={() => togglePaid(item)} className="font-semibold text-emerald-700">Marcar como pago</button> : null}</td></tr>)}</tbody></table>{installments.length === 0 ? <p className="p-4 text-sm text-slate-500">Nenhuma parcela vinculada.</p> : null}</div>
      <button type="button" onClick={() => setAdding(true)} className="mt-4 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700">+ Adicionar parcela</button>
    </section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Projetos vinculados</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{projects.map((project) => <div key={project.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{project.name}</p><p className="text-sm text-slate-500">{project.type ?? "Projeto"}</p></div><span className="text-sm font-bold text-blue-700">{project.progress}%</span></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${project.progress}%` }} /></div><a href={`/operacao?project=${project.id}`} className="mt-3 inline-block text-sm font-semibold text-blue-700">Abrir Kanban operacional →</a></div>)}</div></section>
    {adding ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><form action={addInstallment} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><h2 className="font-semibold">Adicionar parcela</h2><button type="button" onClick={() => setAdding(false)}>×</button></div><select name="projectId" required className={field}><option value="">Selecione o projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input name="description" required placeholder="Descrição do marco" className={field} /><div className="grid grid-cols-2 gap-3"><input name="amount" type="number" step="0.01" min="0" required placeholder="Valor" className={field} /><input name="dueDate" type="date" required className={field} /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button><button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">Salvar</button></div></form></div> : null}
    {editing ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><form action={save} className="w-full max-w-2xl space-y-3 rounded-2xl bg-white p-5 shadow-2xl"><div className="flex justify-between"><h2 className="font-semibold">Editar cadastro</h2><button type="button" onClick={() => setEditing(false)}>×</button></div><div className="grid gap-3 sm:grid-cols-2"><input name="name" required defaultValue={current.name} placeholder="Nome" className={field} /><input name="fullName" defaultValue={current.fullName ?? ""} placeholder="Nome completo" className={field} /><input name="email" type="email" defaultValue={current.email ?? ""} placeholder="E-mail" className={field} /><input name="phone" defaultValue={current.phone ?? ""} placeholder="Telefone/WhatsApp" className={field} /><input name="document" defaultValue={current.document ?? ""} placeholder="CPF/CNPJ" className={field} /><select name="status" defaultValue={current.status} className={field}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></div><textarea name="address" defaultValue={addressText(current.address)} placeholder="Endereço" className={`${field} py-2`} /><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button><button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">Salvar</button></div></form></div> : null}
  </div>;
}
