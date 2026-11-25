import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requirePageAdminRole } from "@/server/auth";
import { listContracts, listProposalsReadyForContract } from "@/server/services/contract-service";
import { ContractsHubClient } from "@/components/contracts/contracts-hub-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contratos & Minutas" };

export default async function AdminContractsPage() {
  await requirePageAdminRole();
  const [contracts, readyProposals] = await Promise.all([
    listContracts(),
    listProposalsReadyForContract(),
  ]);

  return (
    <AppShell eyebrow="Jurídico & Comercial">
      <SectionHeading
        title="Contratos & Termos Aditivos"
        description="Minutas editáveis, assinatura eletrônica, arquivamento PDF no Acervo e aditivos integrados."
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
          readyProposals={readyProposals.map((p) => ({
            id: p.id,
            code: p.code,
            status: p.status,
            projectName: p.project.name,
            clientName: p.project.client.fullName ?? p.project.client.name,
            title: p.versions[0]?.title ?? "Proposta",
            total: Number(p.versions[0]?.total ?? 0),
          }))}
        />
      </div>
    </AppShell>
  );
}
