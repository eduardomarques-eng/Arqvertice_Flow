"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface InstallmentItem {
  id: string;
  name: string;
  amount: string;
  amountNumber: number;
  dueDate: string;
  paidAt: string;
  stage: string;
  status: string;
  order: number;
}

interface ClientInfo {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  loteQuadra?: string | null;
  areaConstruida?: string | null;
}

interface ReportClientFinanceCardProps {
  projectId: string;
  client: ClientInfo;
  initialPayments: InstallmentItem[];
  financialRows: Array<{ label: string; value: string }>;
}

export function ReportClientFinanceCard({
  projectId,
  client,
  initialPayments,
  financialRows,
}: ReportClientFinanceCardProps) {
  const [payments, setPayments] = useState<InstallmentItem[]>(initialPayments);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const togglePayment = async (item: InstallmentItem) => {
    const isPaid = item.status === "PAID" || item.status === "Liquidado";
    const nextStatus = isPaid ? "PENDING" : "PAID";
    const nextPaidDate = isPaid ? null : new Date().toISOString();

    // 1. Atualização Otimista Imediata (resposta em milissegundos)
    setPayments((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? {
              ...p,
              status: nextStatus === "PAID" ? "Liquidado" : "Pendente",
              paidAt: nextPaidDate
                ? new Date(nextPaidDate).toLocaleDateString("pt-BR")
                : "—",
            }
          : p,
      ),
    );

    try {
      setLoadingId(item.id);
      const res = await fetch(`/api/projects/${projectId}/installments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          paidDate: nextPaidDate,
        }),
      });

      if (!res.ok) {
        // Reversão em caso de falha de rede
        setPayments((prev) =>
          prev.map((p) => (p.id === item.id ? item : p)),
        );
      }
    } catch (err) {
      console.error("Erro ao alterar status da parcela:", err);
      // Reversão em caso de exceção
      setPayments((prev) =>
        prev.map((p) => (p.id === item.id ? item : p)),
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      {/* 1. Dados Cadastrais do Cliente e da Edificação */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cliente / Contratante
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">{client.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{client.phone || client.email || "Contato oficial"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Localização / Lote
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">{client.loteQuadra || "Loteamento praia bela"}</p>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{client.address || "Endereço cadastrado"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Área Construída Homologada
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">{client.areaConstruida || "385,00 m²"}</p>
          <p className="mt-0.5 text-xs text-slate-500">Edificação Residencial Unifamiliar</p>
        </div>
      </div>

      {/* 2. Resumo de Desembolso Financeiro */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {financialRows.map((row) => (
          <div
            key={row.label}
            className="rounded-2xl bg-slate-50/70 p-3.5 ring-1 ring-inset ring-slate-100"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {row.label}
            </dt>
            <dd className="mt-1 text-sm font-bold text-slate-900">{row.value}</dd>
          </div>
        ))}
      </div>

      {/* 3. Tabela Financeira com Checkboxes Interativos Apple HIG */}
      {payments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Cronograma de Parcelas & Quitação Interativa
            </span>
            <span className="text-[11px] text-slate-500">
              Clique na caixa de seleção para alternar status (Pago / Pendente)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-4 pr-2 w-12 text-center">Status</th>
                  <th className="py-2.5 px-2">Parcela / Marco</th>
                  <th className="py-2.5 px-2">Vencimento</th>
                  <th className="py-2.5 px-2">Data Quitação</th>
                  <th className="py-2.5 px-2">Etapa Vinculada</th>
                  <th className="py-2.5 pr-4 pl-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const isPaid = p.status === "Liquidado" || p.status === "PAID";
                  const isLoading = loadingId === p.id;

                  return (
                    <tr
                      key={p.id || p.name}
                      className={`transition ${
                        isPaid ? "bg-emerald-50/20" : "hover:bg-slate-50/60"
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={isPaid}
                          disabled={isLoading}
                          onChange={() => togglePayment(p)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                          title="Clique para alternar entre Pago e Pendente"
                        />
                      </td>

                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{p.name}</span>
                          <Badge tone={isPaid ? "green" : "neutral"} className="text-[10px]">
                            {isPaid ? "Liquidado" : "Pendente"}
                          </Badge>
                        </div>
                      </td>

                      <td className="py-3 px-2 font-mono text-slate-600">
                        {p.dueDate}
                      </td>

                      <td className="py-3 px-2 font-mono text-slate-600">
                        {p.paidAt}
                      </td>

                      <td className="py-3 px-2 text-slate-600">
                        {p.stage}
                      </td>

                      <td className="py-3 pr-4 pl-2 text-right font-bold text-slate-900">
                        {p.amount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

