import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { listProposals } from "@/server/services/proposal-service";
import { formatCurrencyBRL } from "@/lib/contract-template";

export const dynamic = "force-dynamic";

export default async function EquipePropostasPage() {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");

  let proposals: Awaited<ReturnType<typeof listProposals>> = [];
  try {
    proposals = await listProposals();
  } catch {
    proposals = [];
  }

  return (
    <AppShell eyebrow="Propostas" role={user.role}>
      <SectionHeading
        title="Propostas Comerciais"
        description="Propostas de projetos vinculados ao seu acesso técnico."
      />
      <div className="mt-6 grid gap-4">
        {proposals.length ? (
          proposals.map((proposal) => {
            const version = proposal.versions[0];
            return (
              <Link key={proposal.id} href={`/equipe/propostas/${proposal.id}`} className="block">
                <Card className="transition hover:border-blue-300">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{proposal.status}</Badge>
                        {proposal.code ? (
                          <span className="text-xs font-mono text-slate-400">{proposal.code}</span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 text-lg font-bold text-slate-950">{version?.title ?? "Proposta"}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {proposal.project.client.name} · {proposal.project.name} · v
                        {version?.version ?? proposal.currentVersion}
                      </p>
                    </div>
                    <strong className="text-base text-slate-900">
                      {formatCurrencyBRL(Number(version?.total ?? 0))}
                    </strong>
                  </div>
                </Card>
              </Link>
            );
          })
        ) : (
          <Card>
            <p className="text-sm text-slate-500">
              Nenhuma proposta disponível para seus projetos vinculados.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
