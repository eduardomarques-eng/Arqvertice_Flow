import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import Link from "next/link";
import { requirePageAdminRole } from "@/server/auth";
import { listProposals } from "@/server/services/proposal-service";
import { prisma } from "@/server/db";
import { CreateProposalButton } from "@/components/proposals/create-proposal-button";
import { extractBriefingScopeContext } from "@/lib/scope-templates";
import {
  BentoCollapsiblePanel,
  BentoHorizontalRanking,
  BentoKpiStrip,
} from "@/components/analytics";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  await requirePageAdminRole();
  const [proposals, projects] = await Promise.all([
    listProposals(),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        description: true,
        client: { select: { name: true, phone: true, city: true } },
        briefing: { select: { responses: true } },
      },
    }),
  ]);
  const totalProposed = proposals.reduce(
    (s, p) => s + Number(p.versions[0]?.total ?? 0),
    0
  );
  const approvedCount = proposals.filter((p) => p.status === "APPROVED").length;
  const negotiatingCount = proposals.filter(
    (p) => p.status === "SENT" || p.status === "VIEWED" || p.status === "DRAFT"
  ).length;
  const conversionRate =
    proposals.length > 0 ? Math.round((approvedCount / proposals.length) * 100) : 0;

  return (
    <AppShell eyebrow="Comercial">
      <SectionHeading
        title="Propostas"
        description="Apresentações, propostas formais, versões e decisões do cliente."
        action={
          <CreateProposalButton
            projects={projects.map((p) => {
              const ctx = extractBriefingScopeContext({
                projectType: p.type,
                projectScope: p.scope,
                projectDescription: p.description,
                clientPhone: p.client.phone,
                clientCity: p.client.city,
                briefingResponses: p.briefing?.responses,
              });
              return {
                id: p.id,
                name: p.name,
                clientName: p.client.name,
                hasBriefing: ctx.hasBriefing,
                areaM2: ctx.areaM2,
                suggestedTemplate: ctx.suggestedTemplate,
              };
            })}
          />
        }
      />

      <div className="mb-6">
        <BentoCollapsiblePanel title="Panorama Comercial & Funil" badge={`${proposals.length} propostas`}>
          <BentoKpiStrip
            columns={4}
            items={[
              {
                id: "total-prop",
                label: "Total Proposto",
                value: totalProposed.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }),
                featured: true,
              },
              {
                id: "conv",
                label: "Taxa de Conversão",
                value: `${conversionRate}%`,
                deltaTone: conversionRate >= 30 ? "positive" : "neutral",
              },
              {
                id: "neg",
                label: "Em Negociação",
                value: String(negotiatingCount),
              },
              {
                id: "app",
                label: "Aprovadas",
                value: String(approvedCount),
              },
            ]}
          />
          <BentoHorizontalRanking
            title="Funil de Status de Propostas"
            maxScale={Math.max(1, proposals.length)}
            items={[
              { id: "draft", label: "Rascunho / Em Elaboração", value: proposals.filter((p) => p.status === "DRAFT").length },
              { id: "sent", label: "Enviadas / Em Negociação", value: proposals.filter((p) => p.status === "SENT" || p.status === "VIEWED").length },
              { id: "approved", label: "Aprovadas", value: approvedCount, highlight: true },
            ]}
          />
        </BentoCollapsiblePanel>
      </div>

      <div className="grid gap-4">
        {proposals.length ? proposals.map((proposal) => {
          const version = proposal.versions[0];
          return <Link key={proposal.id} href={`/admin/propostas/${proposal.id}`} className="block"><Card><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="apple-micro-label">{proposal.status}</p><h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{version?.title ?? "Proposta"}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{proposal.project.client.name} · {proposal.project.name} · versão {version?.version ?? proposal.currentVersion}</p></div><strong className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">R$ {Number(version?.total ?? 0).toFixed(2).replace(".", ",")}</strong></div></Card></Link>;
        }) : <Card><p className="text-sm text-slate-500">Nenhuma proposta criada ainda.</p></Card>}
      </div>
    </AppShell>
  );
}
