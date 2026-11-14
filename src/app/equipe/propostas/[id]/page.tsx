import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { ProposalEditor, type ProposalEditorData } from "@/components/proposals/proposal-editor";
import { StudioEditor } from "@/components/studio/studio-editor";
import { readStudioDeck } from "@/lib/studio-deck";
import { readCommercialData } from "@/lib/studio-commercial";
import { ProposalCommercialPanel } from "@/components/proposals/proposal-commercial-panel";
import { SignatureActions } from "@/components/proposals/signature-actions";
import { ProposalSendActions } from "@/components/proposals/proposal-send-actions";
import { InsightsPanel } from "@/components/proposals/insights-panel";
import { getProposalCommercialInsights } from "@/server/services/commercial-service";
import { Badge } from "@/components/ui/badge";
import { getProposal, getProposalSuggestions } from "@/server/services/proposal-service";
import { listServiceCatalog } from "@/server/services/service-catalog-service";
import { readProposalItems } from "@/lib/proposal-item";
import { UNIT_LABELS, type ServiceUnitName } from "@/lib/pricing";
import { formatCurrencyBRL } from "@/lib/contract-template";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default async function EquipeProposalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");
  const { id } = await params;

  let proposal, insights, suggestions, catalog;
  try {
    [proposal, insights, suggestions, catalog] = await Promise.all([
      getProposal(id),
      getProposalCommercialInsights(id),
      getProposalSuggestions(id),
      listServiceCatalog({ includeInactive: false }),
    ]);
  } catch {
    notFound();
  }

  const version = proposal.versions[0];
  const presentation = (version?.presentation ?? {}) as {
    slides?: Array<{ title?: string; body?: string }>;
    portfolioOverrides?: Record<string, string>;
  };
  const formalText = (version?.formalText ?? {}) as Record<string, unknown>;
  const items = readProposalItems(version?.services);
  const frozen = Boolean(version?.frozenAt);
  const pricing = (version?.pricing ?? null) as { adjustmentReason?: unknown } | null;

  const commercial = version
    ? readCommercialData({
        services: version.services,
        subtotal: Number(version.subtotal ?? 0),
        adjustment: Number(version.adjustment ?? 0),
        total: Number(version.total ?? 0),
        paymentPlan: version.paymentPlan,
      })
    : null;

  const initial: ProposalEditorData = {
    proposalId: proposal.id,
    status: proposal.status,
    code: proposal.code ?? null,
    version: version?.version ?? proposal.currentVersion,
    approvedVersion: proposal.approvedVersion ?? null,
    title: version?.title ?? "",
    slides: (presentation.slides ?? []).map((slide) => ({
      title: String(slide?.title ?? ""),
      body: String(slide?.body ?? ""),
    })),
    object: text(formalText.object),
    conditions: text(formalText.conditions),
    included: text(formalText.included),
    excluded: text(formalText.excluded),
    premisses: Array.isArray(formalText.premises)
      ? formalText.premises.map(String).join("\n")
      : text(formalText.premises),
    observations: text(formalText.observations),
    validityDays: typeof formalText.validityDays === "number" ? formalText.validityDays : 30,
    expiresAt: proposal.expiresAt ? proposal.expiresAt.toISOString().slice(0, 10) : "",
    paymentTerms: text(formalText.formaPagamento),
    lines: items.map((item) => ({
      serviceId: item.serviceId ?? "",
      name: item.name,
      discipline: item.discipline ?? "",
      unit: item.unit ?? "un.",
      quantity: String(item.quantity).replace(".", ","),
      unitPrice: String(item.unitPrice).replace(".", ","),
      optional: item.optional,
      notes: item.notes ?? "",
    })),
    adjustment: Number(version?.adjustment ?? 0),
    adjustmentReason: typeof pricing?.adjustmentReason === "string" ? pricing.adjustmentReason : "",
    catalog: catalog.map((service) => ({
      id: service.id,
      name: service.name,
      discipline: service.discipline,
      unit: UNIT_LABELS[service.unit as ServiceUnitName] ?? service.unit,
      baseMedium: service.baseMedium,
    })),
    suggestions: (suggestions?.suggestions ?? []).map((suggestion) => ({
      serviceId: suggestion.serviceId,
      name: suggestion.name,
      discipline: suggestion.discipline,
      unit: suggestion.unit,
      basePrice: suggestion.basePrice,
      suggestedQuantity: suggestion.suggestedQuantity,
      reason: suggestion.reason,
    })),
    provenance: suggestions?.input.evidence ?? [],
    portfolioOverrides: presentation.portfolioOverrides ?? {},
  };

  const obrigatorias = items.filter((item) => !item.optional);
  const opcionais = items.filter((item) => item.optional);
  const somaObrigatorias = obrigatorias.reduce((sum, item) => sum + item.subtotal, 0);
  const somaOpcionais = opcionais.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <AppShell eyebrow="Comercial" role={user.role}>
      <Link href="/equipe/propostas" className="text-sm font-semibold text-blue-600">
        ← Voltar para propostas
      </Link>

      <div className="mt-6">
        <SectionHeading
          title={initial.title || "Proposta"}
          description={`Cliente ${proposal.project.client.name} · projeto ${proposal.project.name} · status ${proposal.status}`}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Código</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{proposal.code ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Versão</p>
          <p className="mt-1 text-lg font-bold text-slate-950">
            v{initial.version}
            {frozen ? <span className="ml-2 text-xs font-semibold text-emerald-700">congelada</span> : null}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total contratado</p>
          <p className="mt-1 text-lg font-bold text-slate-950">{formatCurrencyBRL(Number(version?.total ?? 0))}</p>
          {opcionais.length ? (
            <p className="mt-1 text-xs text-amber-700">+ {formatCurrencyBRL(somaOpcionais)} opcionais</p>
          ) : null}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Decisão</p>
          <p className="mt-1">
            {proposal.approvedAt || proposal.rejectedAt ? (
              <Badge tone={proposal.status === "APPROVED" ? "green" : "red"}>
                {proposal.status === "APPROVED" ? "Aprovada" : "Recusada"} · v{proposal.approvedVersion}
              </Badge>
            ) : proposal.viewedAt ? (
              <Badge tone="blue">Visualizada</Badge>
            ) : proposal.sentAt ? (
              <Badge tone="blue">Enviada</Badge>
            ) : (
              <Badge tone="neutral">Rascunho</Badge>
            )}
          </p>
        </Card>
      </div>

      {items.length ? (
        <Card className="mt-6">
          <h2 className="font-semibold text-slate-900">Serviços desta versão</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {obrigatorias.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex flex-wrap justify-between gap-3 py-2 text-sm">
                <span className="text-slate-700">
                  {item.name} · {item.quantity} {item.unit}
                  {item.priceOverridden ? <span className="ml-2 text-xs text-amber-700">preço ajustado</span> : null}
                </span>
                <strong className="text-slate-900">{formatCurrencyBRL(item.subtotal)}</strong>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-slate-950">
            <span>Subtotal contratado</span>
            <span>{formatCurrencyBRL(somaObrigatorias)}</span>
          </div>
        </Card>
      ) : null}

      <ProposalCommercialPanel
        proposalId={proposal.id}
        status={proposal.status}
        clientPhone={proposal.project.client.phone}
        approvedVersion={proposal.approvedVersion}
        frozen={frozen}
        contractStatus={proposal.contract?.status ?? null}
      />

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Visualizar como o cliente</h2>
            <p className="mt-1 text-sm text-slate-500">
              Abre exatamente a experiência do cliente, com os dados reais deste processo.
            </p>
          </div>
          <Link
            href={`/equipe/propostas/${proposal.id}/preview`}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Visualizar como o cliente
          </Link>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">Enviar ao cliente</h2>
        <div className="mt-4">
          <ProposalSendActions
            proposalId={proposal.id}
            encerrada={proposal.status === "APPROVED" || proposal.status === "REJECTED" || frozen}
          />
        </div>
      </Card>

      {proposal.contract ? (
        <Card className="mt-6">
          <h2 className="font-semibold text-slate-900">Contrato e assinatura</h2>
          <div className="mt-4">
            <SignatureActions
              contractId={proposal.contract.id}
              status={proposal.contract.signature?.status ?? null}
              provider={proposal.contract.signature?.provider ?? null}
            />
          </div>
        </Card>
      ) : null}

      <Card className="mt-6">
        <h2 className="font-semibold text-slate-900">Recomendações do sistema</h2>
        <div className="mt-4">
          <InsightsPanel insights={insights} />
        </div>
      </Card>

      <Card className="mt-6">
        <StudioEditor
          initialDeck={readStudioDeck(presentation)}
          proposalId={proposal.id}
          readOnly={frozen || Boolean(proposal.approvedVersion)}
          commercial={commercial}
        />
      </Card>

      <Card className="mt-6">
        <ProposalEditor initial={initial} />
      </Card>
    </AppShell>
  );
}
