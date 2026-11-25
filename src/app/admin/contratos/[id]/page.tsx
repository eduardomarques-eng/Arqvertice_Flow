import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requirePageAdminRole } from "@/server/auth";
import { getContractDetail } from "@/server/services/contract-service";
import { ContractEditorWorkspace } from "@/components/contracts/contract-editor-workspace";
import { WhatsAppQuickDispatch } from "@/components/shared/whatsapp-quick-dispatch";
import { formatCurrencyBRL } from "@/lib/contract-template";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editor de Contrato" };

export default async function AdminContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAdminRole();
  const { id } = await params;

  let detail;
  try {
    detail = await getContractDetail(id);
  } catch {
    notFound();
  }

  const { contract, structured } = detail;
  const snapshots = contract.proposal.project.eapProject?.baselineSnapshots ?? [];

  return (
    <AppShell eyebrow="Jurídico & Comercial">
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link href="/admin/contratos" className="font-semibold text-blue-600 hover:text-blue-700">
          ← Voltar para contratos
        </Link>
        <span className="text-slate-300">/</span>
        <Link href={`/admin/propostas/${contract.proposalId}`} className="font-semibold text-slate-600 hover:text-slate-900">
          Ver Proposta ({contract.proposal.code ?? "Origem"})
        </Link>
      </div>

      <SectionHeading
        title={contract.title}
        description={`${contract.proposal.project.client.fullName ?? contract.proposal.project.client.name} · ${contract.proposal.project.name}`}
      />

      <div className="mt-6">
        <ContractEditorWorkspace
          contractId={contract.id}
          contractStatus={contract.status}
          signatureStatus={contract.signature?.status ?? null}
          signatureProvider={contract.signature?.provider ?? null}
          initialData={structured}
          addendums={contract.addendums.map((a) => ({
            id: a.id,
            number: a.number,
            title: a.title,
            description: a.description,
            additionalValue: a.additionalValue,
            additionalDays: a.additionalDays,
            eapSnapshotId: a.eapSnapshotId,
            status: a.status,
            createdAt: a.createdAt.toISOString(),
          }))}
          eapSnapshots={snapshots.map((s) => ({
            id: s.id,
            versionLabel: s.versionLabel,
            totalSelling: Number(s.totalCommercialPrice ?? 0),
          }))}
        />

        <div className="mt-6">
          <WhatsAppQuickDispatch
            entityType="CONTRATO"
            documentTitle={contract.title}
            projectName={contract.proposal.project.name}
            projectId={contract.proposal.project.id}
            clientId={contract.proposal.project.client.id}
            clientName={contract.proposal.project.client.fullName ?? contract.proposal.project.client.name}
            clientPhone={contract.proposal.project.client.phone}
            summaryText={`Valor contratual: ${formatCurrencyBRL(structured.totalValue)} · Minuta v${contract.version}`}
          />
        </div>
      </div>
    </AppShell>
  );
}
