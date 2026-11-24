"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { generateContractAction } from "@/app/actions/domain-actions";
import { formatCurrencyBRL } from "@/lib/contract-template";

export interface ContractListItem {
  id: string;
  title: string;
  version: number;
  status: string;
  updatedAt: string;
  signatureStatus: string | null;
  addendumCount: number;
  proposalId: string;
  proposalCode: string | null;
  projectId: string;
  projectName: string;
  clientName: string;
  totalValue: number;
}

export interface ProposalReadyItem {
  id: string;
  code: string | null;
  status: string;
  projectName: string;
  clientName: string;
  title: string;
  total: number;
}

export function ContractsHubClient({
  contracts,
  readyProposals,
}: {
  contracts: ContractListItem[];
  readyProposals: ProposalReadyItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sigFilter, setSigFilter] = useState("ALL");
  const [showNew, setShowNew] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState(
    readyProposals.find((p) => p.status === "APPROVED")?.id || readyProposals[0]?.id || "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (sigFilter !== "ALL" && (c.signatureStatus || "NONE") !== sigFilter) return false;
      if (!term) return true;
      return (
        c.title.toLowerCase().includes(term) ||
        c.projectName.toLowerCase().includes(term) ||
        c.clientName.toLowerCase().includes(term) ||
        (c.proposalCode ?? "").toLowerCase().includes(term)
      );
    });
  }, [contracts, query, statusFilter, sigFilter]);

  function handleGenerate() {
    if (!selectedProposalId) return;
    setError("");
    startTransition(async () => {
      try {
        const created = await generateContractAction(selectedProposalId);
        router.push(`/admin/contratos/${created.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível gerar o contrato.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por cliente, projeto, código ou título..."
            className="min-h-10 min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">Status: Todos</option>
            <option value="DRAFT">Rascunho (DRAFT)</option>
            <option value="READY">Pronto (READY)</option>
            <option value="SENT">Enviado (SENT)</option>
            <option value="SIGNED">Assinado (SIGNED)</option>
          </select>
          <select
            value={sigFilter}
            onChange={(e) => setSigFilter(e.target.value)}
            className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">Assinatura: Todas</option>
            <option value="NONE">Sem solicitação</option>
            <option value="PENDING">Pendente</option>
            <option value="SENT">Enviada</option>
            <option value="SIGNED">Assinada</option>
            <option value="COMPLETED">Concluída</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Novo Contrato / Gerar da Proposta
        </button>
      </div>

      {showNew ? (
        <Card className="border-blue-200 bg-blue-50/40 p-5">
          <h3 className="text-sm font-bold text-slate-900">Gerar Contrato a partir de Proposta Aprovada</h3>
          <p className="mt-1 text-xs text-slate-600">
            O contrato herda automaticamente o escopo, metragem, cliente e condições da versão aprovada e aplica o CNPJ oficial de StudioSetting.
          </p>
          {readyProposals.length === 0 ? (
            <p className="mt-3 text-xs font-medium text-amber-800">
              Não há propostas sem contrato no momento. Aprove uma proposta ou crie uma nova em Propostas.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={selectedProposalId}
                onChange={(e) => setSelectedProposalId(e.target.value)}
                className="min-h-10 min-w-[280px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {readyProposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code ?? "PROP"} · {p.projectName} ({p.clientName}) — {p.status} · {formatCurrencyBRL(p.total)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !selectedProposalId}
                onClick={handleGenerate}
                className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending ? "Gerando..." : "Gerar Minuta (8 Cláusulas)"}
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p> : null}
        </Card>
      ) : null}

      <div className="grid gap-4">
        {filtered.length ? (
          filtered.map((c) => (
            <Card key={c.id} className="transition hover:border-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={c.status === "SIGNED" ? "green" : c.status === "SENT" ? "blue" : "neutral"}>
                      {c.status}
                    </Badge>
                    {c.signatureStatus ? <Badge tone="blue">Assinatura: {c.signatureStatus}</Badge> : null}
                    {c.addendumCount > 0 ? <Badge tone="amber">{c.addendumCount} Aditivo(s)</Badge> : null}
                    {c.proposalCode ? <span className="font-mono text-xs text-slate-400">{c.proposalCode}</span> : null}
                  </div>
                  <Link href={`/admin/contratos/${c.id}`} className="block text-lg font-bold text-slate-950 hover:text-blue-700">
                    {c.title}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {c.clientName} · {c.projectName} · Contrato v{c.version}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <strong className="text-base text-slate-900">{formatCurrencyBRL(c.totalValue)}</strong>
                  <a
                    href={`/api/contracts/${c.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    PDF
                  </a>
                  <Link
                    href={`/admin/contratos/${c.id}`}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Editar &amp; Preview
                  </Link>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-slate-500">Nenhum contrato encontrado com os filtros selecionados.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
