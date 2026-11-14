import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function EquipePropostasPage() {
  const user = await requirePageTeamRole();
  await requireModuleAccess("projetos");

  const proposals = await prisma.proposal.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, status: true, updatedAt: true, projectId: true },
  });

  return (
    <AppShell eyebrow="Propostas" role={user.role}>
      <SectionHeading
        title="Propostas Comerciais"
        description="Propostas de projetos. Acesso restrito a usuários com permissão projetos."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Propostas Recentes ({proposals.length})</h2>
        <p className="mt-1 text-sm text-slate-500">
          Últimas propostas comerciais do estúdio.
        </p>
      </Card>
    </AppShell>
  );
}
