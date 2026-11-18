import { AppShell } from "@/components/app-shell";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { prisma } from "@/server/db";
import { getStudioSettings } from "@/server/services/settings-service";
import { FinanceHubView, type ProjectOption } from "@/components/finance/finance-hub-view";
import type { Installment } from "@/components/projects/project-finance-manager";

export const metadata = { title: "Gestão Financeira & Parcelas — Equipe ArqVértice" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EquipeFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("financeiro");
  const { projectId } = await searchParams;

  const rawProjects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      budget: true,
      client: { select: { name: true } },
      stages: { select: { id: true, name: true }, orderBy: { order: "asc" } },
      installments: {
        select: {
          id: true,
          description: true,
          amount: true,
          dueDate: true,
          paidDate: true,
          status: true,
          linkedStageId: true,
          order: true,
          version: true,
        },
        orderBy: [{ order: "asc" }, { dueDate: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const projects: ProjectOption[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client?.name || "Cliente",
    budget: p.budget ? Number(p.budget) : null,
    stages: p.stages,
  }));

  const installmentsByProject: Record<string, Installment[]> = {};
  for (const p of rawProjects) {
    installmentsByProject[p.id] = p.installments.map((inst) => ({
      id: inst.id,
      description: inst.description,
      amount: Number(inst.amount ?? 0),
      dueDate: inst.dueDate,
      paidDate: inst.paidDate,
      status: inst.status,
      linkedStageId: inst.linkedStageId,
      order: inst.order,
      version: inst.version,
    }));
  }

  const studioSettings = await getStudioSettings();

  return (
    <AppShell eyebrow="Gestão Financeira" role={user.role}>
      <FinanceHubView
        projects={projects}
        installmentsByProject={installmentsByProject}
        initialProjectId={projectId}
        basePath="/equipe"
        studioPixKey={studioSettings.pixKey}
        studioPixKeyType={studioSettings.pixKeyType}
      />
    </AppShell>
  );
}
