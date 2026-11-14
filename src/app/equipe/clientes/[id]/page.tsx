import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { requirePageTeamRole } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { getClient } from "@/server/services/client-service";
import { stageCompletion } from "@/server/services/dashboard-service";
import { prisma } from "@/server/db";
import { ClientDetailManager } from "@/components/clients/client-detail-manager";

export const dynamic = "force-dynamic";

export default async function EquipeClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageTeamRole();
  await requireModuleAccess("clientes");
  const { id } = await params;

  let client;
  try {
    client = await getClient(id);
  } catch {
    notFound();
  }

  const projectIds = client.projects?.map((project) => project.id) || [];
  const stagesByProject =
    projectIds.length > 0
      ? await prisma.scheduleStage.findMany({
          where: { projectId: { in: projectIds } },
          select: { projectId: true, completion: true, status: true },
        })
      : [];

  const progressFor = (projectId: string) => {
    const stages = stagesByProject.filter((stage) => stage.projectId === projectId);
    if (!stages || stages.length === 0) return 0;
    return Math.round(stages.reduce((sum, stage) => sum + stageCompletion(stage), 0) / stages.length);
  };

  const installments = (client.projects || []).flatMap((project) =>
    (project.installments || []).map((item) => ({
      id: item.id,
      projectId: project.id,
      projectName: project.name,
      description: item.description,
      amount: item.amount ?? 0,
      dueDate: item.dueDate,
      paidDate: item.paidDate,
      status: item.status !== "PAID" && item.dueDate < new Date() ? "OVERDUE" : item.status,
    }))
  );

  const projectSummaries = (client.projects || []).map((project) => ({
    id: project.id,
    name: project.name,
    type: project.type,
    progress: progressFor(project.id) ?? 0,
  }));

  return (
    <AppShell eyebrow="Relacionamento" role={user.role}>
      <Link href="/equipe/clientes" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
        ← Voltar a clientes
      </Link>

      <SectionHeading
        title={client.name || "Cliente"}
        description={client.email || "Sem e-mail registrado"}
        action={<Badge tone={client.status === "ACTIVE" ? "green" : "neutral"}>{client.status || "INACTIVE"}</Badge>}
      />

      <ClientDetailManager
        client={{
          id: client.id,
          name: client.name || "Cliente",
          fullName: client.fullName || client.name || "Não informado",
          email: client.email || "Não informado",
          phone: client.phone || "Não informado",
          document: client.document || "Não informado",
          address: client.address,
          status: client.status || "ACTIVE",
        }}
        installments={installments}
        projects={projectSummaries}
        hasAccess={client.users?.some((u) => u.role === "CLIENT" || u.role === "CLIENTE") ?? false}
      />
    </AppShell>
  );
}
