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
  hideClientMetadata?: boolean;
  hideFinancialSummary?: boolean;
}

export function ReportClientFinanceCard({
  projectId,
  client,
  initialPayments,
  financialRows,
  hideClientMetadata = false,
  hideFinancialSummary = false,
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
      {/* 1. Dados Cadastrais do Cliente e da Edificação (opcional) */}
      {!hideClientMetadata && (
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
      )}

      {/* 2. Resumo de Desembolso Financeiro Consolidado */}
      {!hideFinancialSummary && financialRows && financialRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50/70 p-4 rounded-xl border border-zinc-200/80 print:grid-cols-4 print:p-3 print:gap-2 print:border-zinc-300 print:bg-zinc-50/40">
          {financialRows.map((row) => (
            <div key={row.label} className="rounded-lg p-1">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
                {row.label}
              </dt>
              <dd className="mt-1 text-base font-bold text-zinc-900 font-mono">
                {row.value}
              </dd>
            </div>
          ))}
        </div>
      )}

      {/* 3. Tabela Financeira com Checkboxes Interativos Apple HIG */}
      {payments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white break-inside-avoid">
          <div className="bg-zinc-50/80 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
              Cronograma de Parcelas & Quitação Interativa
            </span>
            <span className="text-[11px] text-zinc-500 print:hidden">
              Clique no checkbox para alternar status (Pago / Pendente)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                <tr>
                  <th className="py-2.5 pl-3 pr-2 w-8 text-center print:hidden">#</th>
                  <th className="w-[10%] py-2.5 p-2 text-left font-bold text-zinc-700">Parcela</th>
                  <th className="w-[32%] py-2.5 p-2 text-left font-medium text-zinc-900">Descrição</th>
                  <th className="w-[20%] py-2.5 p-2 text-left text-zinc-500">Etapa Vinculada</th>
                  <th className="w-[14%] py-2.5 p-2 text-left font-mono whitespace-nowrap">Vencimento</th>
                  <th className="w-[14%] py-2.5 p-2 text-right font-mono font-semibold text-zinc-900 whitespace-nowrap">Valor</th>
                  <th className="w-[10%] py-2.5 p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map((p, index) => {
                  const isPaid = p.status === "Liquidado" || p.status === "PAID";
                  const isLoading = loadingId === p.id;
                  const totalInstallments = String(payments.length).padStart(2, "0");
                  const currentInstallment = String(index + 1).padStart(2, "0");
                  const installmentCode = `${currentInstallment}/${totalInstallments}`;

                  return (
                    <tr
                      key={p.id || p.name || index}
                      className={`transition break-inside-avoid ${
                        isPaid ? "bg-emerald-50/20" : "hover:bg-zinc-50/60"
                      }`}
                    >
                      <td className="py-3 pl-3 pr-2 text-center print:hidden">
                        <input
                          type="checkbox"
                          checked={isPaid}
                          disabled={isLoading}
                          onChange={() => togglePayment(p)}
                          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                          title="Clique para alternar entre Pago e Pendente"
                        />
                      </td>

                      <td className="w-[10%] py-3 p-2 font-mono font-bold text-zinc-700">
                        {installmentCode}
                      </td>

                      <td className="w-[32%] py-3 p-2 font-medium text-zinc-900">
                        {p.name}
                      </td>

                      <td className="w-[20%] py-3 p-2 text-zinc-500 text-xs">
                        {p.stage || "—"}
                      </td>

                      <td className="w-[14%] py-3 p-2 font-mono text-zinc-600 whitespace-nowrap">
                        {p.dueDate}
                      </td>

                      <td className="w-[14%] py-3 p-2 text-right font-mono font-semibold text-zinc-900 whitespace-nowrap">
                        {p.amount}
                      </td>

                      <td className="w-[10%] py-3 p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isPaid ? "Pago" : "Pendente"}
                        </span>
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

