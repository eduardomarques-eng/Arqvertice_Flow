import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { averageCompletion, completionOf, progressByDiscipline, stageCompletion } from "@/lib/progress";
import { stageAlert, summarizeAlerts } from "@/lib/schedule-alerts";

/**
 * REGRA ÚNICA DE PROGRESSO — a implementação está em `@/lib/progress`.
 *
 * Reexportada daqui porque o painel, o quadro e o relatório consomem a MESMA
 * função. Na Fase 3 a implementação saiu deste ficheiro: existia uma cópia em
 * `schedule-service` (`stageCompletionValue`), e cada cópia é uma verdade nova
 * para o mesmo número.
 */
export { averageCompletion, completionOf, stageCompletion, progressByDiscipline };

export type DashboardMetrics = {
  clients: number;
  projects: number;
  activeProjects: number;
  pendingProposals: number;
  approvedProposals: number;
  contracts: number;
  pendingPayments: number;
  receivedTotal: number;
  tasksInProgress: number;
  delayedStages: number;
  stagesWithoutOwner: number;
};

/**
 * Métricas do dashboard, todas lidas da base — nada de números fixos no
 * componente. `ADMIN` obrigatório: são dados do estúdio inteiro.
 */
export async function dashboardMetrics(): Promise<DashboardMetrics> {
  await requireRole("ADMIN");

  const now = new Date();
  const [
    clients,
    projects,
    activeProjects,
    pendingProposals,
    approvedProposals,
    contracts,
    pendingPayments,
    paidPayments,
    tasksInProgress,
    delayedStages,
    stagesWithoutOwner,
  ] = await Promise.all([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: { in: ["PLANNING", "IN_PROGRESS", "PAUSED"] } } }),
    prisma.proposal.count({ where: { status: { in: ["READY", "SENT", "VIEWED", "IN_REVIEW"] } } }),
    prisma.proposal.count({ where: { status: { in: ["APPROVED", "CONVERTED"] } } }),
    prisma.contract.count(),
    prisma.payment.count({ where: { status: { not: "PAID" } } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.scheduleStage.count({ where: { status: "IN_PROGRESS" } }),
    // Atrasada = prazo passou e a etapa não está concluída.
    prisma.scheduleStage.count({ where: { status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
    prisma.scheduleStage.count({ where: { status: { not: "COMPLETED" }, designer: null } }),
  ]);

  return {
    clients,
    projects,
    activeProjects,
    pendingProposals,
    approvedProposals,
    contracts,
    pendingPayments,
    // `amount` é Decimal no Prisma; a interface é em number, por isso converte.
    receivedTotal: Number(paidPayments._sum.amount ?? 0),
    tasksInProgress,
    delayedStages,
    stagesWithoutOwner,
  };
}

export type ProjectSnapshot = {
  id: string;
  name: string;
  status: string;
  clientName: string;
  progress: number;
  currentStage: string | null;
  nextDueDate: Date | null;
  delayedStages: number;
  disciplines: { discipline: string; progress: number }[];
};

export type ExecutiveDashboardData = {
  metrics: DashboardMetrics & {
    contractedTotal: number;
    installmentsReceived: number;
    openBalance: number;
    finalizedBriefings: number;
    pendingBriefings: number;
    averageProgress: number;
    completedStages: number;
    totalStages: number;
    dueSoon: number;
    nextInstallment: { amount: number; dueDate: Date } | null;
  };
  projects: ProjectSnapshot[];
  deliveries: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    dueDate: Date;
    completion: number;
    status: string;
    designer: string | null;
    overdue: boolean;
  }[];
  team: {
    name: string;
    role: string;
    stages: number;
    completed: number;
    completion: number;
  }[];
  proposalFunnel: { label: string; value: number; tone: "neutral" | "blue" | "violet" | "emerald" }[];
  clients: { id: string; name: string }[];
  briefings: { id: string; projectId: string; projectName: string; clientName: string; status: string }[];
};

export async function executiveDashboardData(): Promise<ExecutiveDashboardData> {
  await requireRole("ADMIN");
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);

  const [metrics, projects, deliveries, installments, briefings, users, stages, funnel, clients] = await Promise.all([
    dashboardMetrics(),
    projectSnapshots(8),
    prisma.scheduleStage.findMany({
      where: { dueDate: { not: null, lte: horizon }, status: { not: "COMPLETED" } },
      orderBy: { dueDate: "asc" },
      take: 12,
      select: {
        id: true, name: true, projectId: true, dueDate: true, completion: true, status: true, designer: true,
        project: { select: { name: true } },
      },
    }),
    prisma.projectInstallment.findMany({ select: { amount: true, status: true } }),
    prisma.briefing.findMany({ select: { id: true, projectId: true, status: true, project: { select: { name: true, client: { select: { name: true } } } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "OPERADOR"] } }, select: { name: true, role: true } }),
    prisma.scheduleStage.findMany({ select: { designer: true, completion: true, status: true } }),
    Promise.all([
      prisma.proposal.count({ where: { status: { in: ["DRAFT", "IN_REVIEW", "NEGOTIATING"] } } }),
      prisma.proposal.count({ where: { status: { in: ["READY", "SENT", "VIEWED"] } } }),
      prisma.proposal.count({ where: { status: "APPROVED" } }),
      prisma.proposal.count({ where: { status: "CONVERTED" } }),
    ]),
    prisma.client.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const contractedTotal = installments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const installmentsReceived = installments
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const team = users.map((user) => {
    const assigned = stages.filter((stage) => stage.designer?.trim() === (user.name ?? "").trim());
    const completion = assigned.length
      ? Math.round(assigned.reduce((sum, stage) => sum + stageCompletion(stage), 0) / assigned.length)
      : 0;
    return {
      name: user.name,
      role: user.role,
      stages: assigned.length,
      completed: assigned.filter((stage) => stage.status === "COMPLETED").length,
      completion,
    };
  });
  const totalStages = stages.length;
  const completedStages = stages.filter((stage) => stage.status === "COMPLETED").length;
  const averageProgress = totalStages
    ? Math.round(stages.reduce((sum, stage) => sum + stageCompletion(stage), 0) / totalStages * 10) / 10
    : 0;
  const nextInstallment = await prisma.projectInstallment.findFirst({
    where: { status: { not: "PAID" } },
    orderBy: { dueDate: "asc" },
    select: { amount: true, dueDate: true },
  });

  return {
    metrics: {
      ...metrics,
      contractedTotal,
      installmentsReceived,
      openBalance: Math.max(0, contractedTotal - installmentsReceived),
      finalizedBriefings: briefings.filter((briefing) => briefing.status === "FINALIZED").length,
      pendingBriefings: briefings.filter((briefing) => briefing.status !== "FINALIZED").length,
      averageProgress,
      completedStages,
      totalStages,
      dueSoon: deliveries.filter((delivery) => delivery.dueDate !== null && delivery.dueDate >= now && delivery.dueDate <= new Date(now.getTime() + 7 * 86400000)).length,
      nextInstallment: nextInstallment ? { amount: Number(nextInstallment.amount), dueDate: nextInstallment.dueDate } : null,
    },
    projects,
    deliveries: deliveries
      .filter((stage): stage is typeof stage & { dueDate: Date } => stage.dueDate !== null)
      .map((stage) => ({
        ...stage,
        projectName: stage.project?.name ?? "Sem projeto",
        overdue: stage.dueDate < now,
      })),
    team,
    proposalFunnel: [
      { label: "Em preparação", value: funnel?.[0] ?? 0, tone: "neutral" },
      { label: "Em análise", value: funnel?.[1] ?? 0, tone: "blue" },
      { label: "Aprovadas", value: funnel?.[2] ?? 0, tone: "violet" },
      { label: "Convertidas", value: funnel?.[3] ?? 0, tone: "emerald" },
    ],
    clients,
    briefings: briefings.map((briefing) => ({
      id: briefing.id,
      projectId: briefing.projectId,
      projectName: briefing.project?.name ?? "Sem projeto",
      clientName: briefing.project?.client?.name ?? "Sem cliente",
      status: briefing.status,
    })),
  };
}

/** Projetos com progresso e etapa atual, para o painel e para o cronograma. */
export async function projectSnapshots(limit = 6): Promise<ProjectSnapshot[]> {
  await requireRole("ADMIN");
  const now = new Date();

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      client: { select: { name: true } },
      stages: { orderBy: { order: "asc" } },
    },
  });

  return projects.map((project) => {
    const stages = project.stages;
    const current = stages.find((stage) => stage.status === "IN_PROGRESS") ?? null;
    const pending = stages.filter((stage) => stage.status !== "COMPLETED");
    const nextDue = [...pending]
      .filter((stage) => stage.dueDate)
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))[0];

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      clientName: project.client?.name ?? "Sem cliente",
      progress: completionOf(stages),
      currentStage: current?.name ?? null,
      nextDueDate: nextDue?.dueDate ?? null,
      // Mesma regra de alertas do quadro e do relatório — não uma contagem
      // recalculada aqui, que voltaria a criar uma segunda verdade.
      delayedStages: summarizeAlerts(
        stages.map((stage) =>
          stageAlert({ status: stage.status, dueDate: stage.dueDate }, now),
        ),
      ).overdue,
      disciplines: progressByDiscipline(stages),
    };
  });
}