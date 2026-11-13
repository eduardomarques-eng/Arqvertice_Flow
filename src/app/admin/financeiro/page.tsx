import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { FinanceHubView, type ProjectOption } from "@/components/finance/finance-hub-view";
import type { Installment } from "@/components/projects/project-finance-manager";

export const metadata = { title: "Gestão Financeira & Parcelas — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function AdminFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  await requirePageRole("ADMIN");
  const { projectId } = await searchParams;

  // Busca todos os projetos ativos
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
    }));
  }

  return (
    <AppShell eyebrow="Financeiro">
      <FinanceHubView
        projects={projects}
        installmentsByProject={installmentsByProject}
        initialProjectId={projectId}
      />
    </AppShell>
  );
}

