"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createStandaloneContractAction } from "@/app/actions/domain-actions";
import { formatCurrencyBRL } from "@/lib/contract-template";
import { SCOPE_TEMPLATES, type ScopeTemplateKey } from "@/lib/scope-templates";

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

export interface ContractProjectOption {
  id: string;
  name: string;
  clientName: string;
  clientDocument?: string;
  hasBriefing?: boolean;
  areaM2?: number;
  suggestedTemplate?: ScopeTemplateKey;
}

export function ContractsHubClient({
  contracts,
  projects = [],
}: {
  contracts: ContractListItem[];
  projects?: ContractProjectOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sigFilter, setSigFilter] = useState("ALL");
  const [showNew, setShowNew] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [includeStructuralPartner, setIncludeStructuralPartner] = useState(false);
  const [artEnabled, setArtEnabled] = useState(false);
  const [useBriefing, setUseBriefing] = useState(true);
  const [templateKey, setTemplateKey] = useState<ScopeTemplateKey>("COMPLETO");
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

  function handleProjectSelect(nextProjectId: string) {
    setSelectedProjectId(nextProjectId);
    const found = projects.find((p) => p.id === nextProjectId);
    if (found) {
      if (!title.trim()) setTitle(`Contrato de Prestação de Serviços — ${found.name}`);
      setClientName(found.clientName);
      setClientDocument(found.clientDocument ?? "");
      if (found.suggestedTemplate) setTemplateKey(found.suggestedTemplate);
    }
  }

  function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId && !clientName.trim()) {
      setError("Informe o nome da Contratante ou selecione um projeto existente.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const created = await createStandaloneContractAction({
          projectId: selectedProjectId || null,
          title: title.trim() || undefined,
          clientName: clientName.trim() || undefined,
          clientDocument: clientDocument.trim() || undefined,
          totalValue: Number(totalValue.replace(",", ".")) || 0,
          includeStructuralPartner,
          artEnabled,
          useBriefing,
          templateKey,
        });
        router.push(`/admin/contratos/${created.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível criar o contrato.");
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
          className="apple-primary-btn h-10 text-sm cursor-pointer"
        >
          + Novo Contrato
        </button>
      </div>

      {showNew ? (
        <Card className="border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/95">
          <h3 className="apple-section-title">Novo Contrato Jurídico (Minuta Padrão — 8 Cláusulas)</h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Crie diretamente um contrato independente com qualificação da Contratada (ArqVértice Studio · CNPJ 66.773.164/0001-60), pré-visualização ao vivo e geração de PDF oficial.
          </p>

          <form onSubmit={handleCreateContract} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Vincular a Projeto (Opcional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">Preenchimento manual (contrato avulso)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.clientName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Título do Contrato
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Contrato Projeto Executivo Residencial"
                className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Nome da Contratante
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome completo / Razão social"
                className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                CPF / CNPJ da Contratante
              </label>
              <input
                type="text"
                value={clientDocument}
                onChange={(e) => setClientDocument(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Valor Global (R$)
              </label>
              <input
                type="text"
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value)}
                placeholder="Ex.: 28500"
                className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Template de Escopo / Objeto
              </label>
              <select
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value as ScopeTemplateKey)}
                className="mt-1 h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {(Object.keys(SCOPE_TEMPLATES) as ScopeTemplateKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SCOPE_TEMPLATES[key].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBriefing}
                  onChange={(e) => setUseBriefing(e.target.checked)}
                />
                Puxar dados e escopo do Briefing / Projeto
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStructuralPartner}
                  onChange={(e) => setIncludeStructuralPartner(e.target.checked)}
                />
                Incluir Parceiro Estrutural (Emanoel Luan · CNPJ)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={artEnabled}
                  onChange={(e) => setArtEnabled(e.target.checked)}
                />
                Incluir Taxa de ART / RRT (R$ 108,39)
              </label>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="apple-primary-btn h-10 text-sm cursor-pointer disabled:opacity-50"
              >
                {pending ? "Criando..." : "Criar Contrato (Minuta 8 Cláusulas)"}
              </button>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="apple-glass-btn h-10 text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
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
