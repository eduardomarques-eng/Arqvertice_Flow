import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requirePageAdminRole } from "@/server/auth";
import { listContracts } from "@/server/services/contract-service";
import { prisma } from "@/server/db";
import { ContractsHubClient } from "@/components/contracts/contracts-hub-client";
import { extractBriefingScopeContext } from "@/lib/scope-templates";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contratos & Minutas" };

export default async function AdminContractsPage() {
  await requirePageAdminRole();
  const [contracts, projects] = await Promise.all([
    listContracts(),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        description: true,
        client: { select: { name: true, fullName: true, document: true, cpf: true, phone: true, city: true } },
        briefing: { select: { responses: true } },
      },
    }),
  ]);

  return (
    <AppShell eyebrow="Jurídico">
      <SectionHeading
        title="Contratos & Termos Aditivos"
        description="Minutas padrão de 8 cláusulas, qualificação automática, pré-visualização, assinatura eletrônica e PDF oficial."
      />
      <div className="mt-6">
        <ContractsHubClient
          contracts={contracts.map((c) => {
            const content = (c.content ?? {}) as Record<string, unknown>;
            return {
              id: c.id,
              title: c.title,
              version: c.version,
              status: c.status,
              updatedAt: c.updatedAt.toISOString(),
              signatureStatus: c.signature?.status ?? null,
              addendumCount: c.addendums.length,
              proposalId: c.proposal.id,
              proposalCode: c.proposal.code,
              projectId: c.proposal.project.id,
              projectName: c.proposal.project.name,
              clientName: c.proposal.project.client.fullName ?? c.proposal.project.client.name,
              totalValue: Number(content.total ?? 0),
            };
          })}
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
              clientName: p.client.fullName ?? p.client.name,
              clientDocument: p.client.cpf ?? p.client.document ?? "",
              hasBriefing: ctx.hasBriefing,
              areaM2: ctx.areaM2,
              suggestedTemplate: ctx.suggestedTemplate,
            };
          })}
        />
      </div>
    </AppShell>
  );
}
