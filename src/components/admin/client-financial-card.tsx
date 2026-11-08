"use client";

import { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";

export interface ClientData {
  id: string;
  name: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  address?: {
    neighborhood?: string;
    city?: string;
    state?: string;
    loteQuadra?: string;
    areaConstruida?: string;
    formatted?: string;
  } | unknown;
  status: string;
}

export interface InstallmentData {
  id: string;
  projectId: string;
  projectName?: string;
  description: string;
  amount: number;
  dueDate: string | Date;
  paidDate?: string | Date | null;
  status: string; // "PAID" | "PENDING" | "OVERDUE"
  order?: number;
}

interface ClientFinancialCardProps {
  initialClient: ClientData;
  initialInstallments: InstallmentData[];
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = (val: string | Date) =>
  new Date(val).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function ClientFinancialCard({ initialClient, initialInstallments }: ClientFinancialCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [client, setClient] = useState<ClientData>(initialClient);
  const [installments, setInstallments] = useState<InstallmentData[]>(initialInstallments);

  // Estados de formulário do cliente
  const [name, setName] = useState(client.name || "");
  const [fullName, setFullName] = useState(client.fullName || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [document, setDocument] = useState(client.document || "");
  const [loteQuadra, setLoteQuadra] = useState(() => {
    if (client.address && typeof client.address === "object" && "loteQuadra" in client.address) {
      return String((client.address as { loteQuadra?: string }).loteQuadra || "");
    }
    return "";
  });
  const [cidadeEstado, setCidadeEstado] = useState(() => {
    if (client.address && typeof client.address === "object") {
      const addr = client.address as { neighborhood?: string; city?: string; state?: string; formatted?: string };
      if (addr.formatted) return addr.formatted;
      return [addr.neighborhood, addr.city, addr.state].filter(Boolean).join(" - ");
    }
    return "";
  });

  const [clientSaveMsg, setClientSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Métricas financeiras calculadas
  const totalAmount = installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const paidAmount = installments
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const openBalance = Math.max(0, totalAmount - paidAmount);
  const progressPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  // 1. Salvar dados do cliente diretamente no Neon
  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault();
    setClientSaveMsg(null);

    const payload = {
      name: name.trim(),
      fullName: fullName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      document: document.trim() || null,
      address: {
        loteQuadra: loteQuadra.trim(),
        formatted: cidadeEstado.trim() ? `${loteQuadra} | ${cidadeEstado}` : loteQuadra,
      },
    };

    startTransition(async () => {
      try {
        const res = await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao salvar cliente.");
        }

        const updated = await res.json();
        setClient(updated);
        setClientSaveMsg({ type: "success", text: "Dados cadastrais atualizados com sucesso!" });
        router.refresh();
      } catch (err) {
        setClientSaveMsg({
          type: "error",
          text: err instanceof Error ? err.message : "Falha na comunicação com o servidor.",
        });
      }
    });
  }

  // 2. Toggle interativo da parcela (pago / pendente) sem recarregar tela
  async function handleToggleInstallment(item: InstallmentData) {
    const isCurrentlyPaid = item.status === "PAID";
    const nextStatus = isCurrentlyPaid ? "PENDING" : "PAID";
    const nextPaidDate = isCurrentlyPaid ? null : new Date().toISOString();

    // Atualização otimista imediata
    setTogglingId(item.id);
    setInstallments((prev) =>
      prev.map((inst) =>
        inst.id === item.id ? { ...inst, status: nextStatus, paidDate: nextPaidDate } : inst
      )
    );

    try {
      const res = await fetch(`/api/projects/${item.projectId}/installments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          paidDate: nextPaidDate,
        }),
      });

      if (!res.ok) {
        // Reverter em caso de falha
        setInstallments((prev) =>
          prev.map((inst) => (inst.id === item.id ? item : inst))
        );
        alert("Não foi possível atualizar o status da parcela no banco.");
      } else {
        router.refresh();
      }
    } catch {
      setInstallments((prev) =>
        prev.map((inst) => (inst.id === item.id ? item : inst))
      );
      alert("Erro de conexão ao atualizar a parcela.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo no topo - Padrão Apple HIG */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Contratado</span>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{moneyFormatter.format(totalAmount)}</p>
          <span className="mt-1 block text-xs text-slate-500">Valor global de honorários</span>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Liquidado</span>
          <p className="mt-1 text-xl font-extrabold text-emerald-700">{moneyFormatter.format(paidAmount)}</p>
          <span className="mt-1 block text-xs text-emerald-600 font-medium">{progressPercent}% quitado</span>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">Saldo a Faturar</span>
          <p className="mt-1 text-xl font-extrabold text-sky-700">{moneyFormatter.format(openBalance)}</p>
          <span className="mt-1 block text-xs text-sky-600 font-medium">Aguardando marcos técnicos</span>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col justify-center">
          <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Avanço Financeiro</span>
            <span className="text-blue-600 font-bold">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        {/* Formulário: Dados Cadastrais do Cliente (Editável e Pré-preenchido) */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Ficha Técnica</span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">Dados do Cliente</h3>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              {client.status === "ACTIVE" ? "Cliente Ativo" : client.status}
            </span>
          </div>

          <form onSubmit={handleSaveClient} className="mt-5 space-y-4">
            {clientSaveMsg && (
              <div
                className={`rounded-xl p-3 text-xs font-semibold ${
                  clientSaveMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {clientSaveMsg.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome de Exibição</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pedro"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo / Razão Social</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Pedro de Alencar"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail Cadastrado</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pedro@arqvertice.com"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp / Telefone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="5585999990001"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lote / Quadra / Imóvel</label>
                <input
                  type="text"
                  value={loteQuadra}
                  onChange={(e) => setLoteQuadra(e.target.value)}
                  placeholder="Ex: Lote 14, Quadra B"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loteamento / Localização</label>
                <input
                  type="text"
                  value={cidadeEstado}
                  onChange={(e) => setCidadeEstado(e.target.value)}
                  placeholder="Ex: Loteamento Praia Bela, Litoral Sul"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition active:scale-[0.99] disabled:opacity-50"
              >
                {isPending ? "Atualizando no Neon..." : "Salvar Alterações Cadastrais"}
              </button>
            </div>
          </form>
        </div>

        {/* Gestão Interativa de Parcelas - Checkboxes / Toggles Instantâneos */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Controle Financeiro</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">Parcelas de Pagamento</h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {installments.length} parcela(s) registrada(s)
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {installments.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Nenhuma parcela cadastrada para este cliente.
                </div>
              ) : (
                installments.map((inst, index) => {
                  const isPaid = inst.status === "PAID";
                  const isOverdue = !isPaid && new Date(inst.dueDate) < new Date();
                  const isToggling = togglingId === inst.id;

                  return (
                    <div
                      key={inst.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isPaid
                          ? "border-emerald-200 bg-emerald-50/40"
                          : isOverdue
                          ? "border-rose-200 bg-rose-50/30"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Checkbox Interativo Apple Style */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isPaid}
                          disabled={isToggling}
                          onClick={() => handleToggleInstallment(inst)}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
                            isPaid
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                              : "border-slate-300 bg-white hover:border-slate-400"
                          } ${isToggling ? "opacity-50 animate-pulse" : ""}`}
                        >
                          {isPaid && (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {inst.description || `Parcela ${String(index + 1).padStart(2, "0")}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            Vencimento: <span className="font-semibold text-slate-700">{dateFormatter(inst.dueDate)}</span>
                            {inst.projectName ? ` · ${inst.projectName}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Valor e Badge de Status */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-extrabold text-slate-900">
                          {moneyFormatter.format(Number(inst.amount))}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleInstallment(inst)}
                          disabled={isToggling}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : isOverdue
                              ? "bg-rose-100 text-rose-800 hover:bg-rose-200"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          }`}
                        >
                          {isToggling ? "Salvando..." : isPaid ? "Quitado ✓" : isOverdue ? "Atrasado !" : "Pendente"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Clique no checkbox para quitar ou estornar em 1 clique</span>
            <span className="font-semibold text-emerald-600">Sincronizado com Neon Postgres</span>
          </div>
        </div>
      </div>
    </div>
  );
}

