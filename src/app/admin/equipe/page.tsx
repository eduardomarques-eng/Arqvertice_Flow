import { AppShell } from "@/components/app-shell";
import { currentUser, isTeamRole } from "@/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import {
  TeamGovernanceHub,
  type TeamMemberData,
  type TeamMemberStage,
  type ProjectSummary,
  type ReminderLogItem,
  type ClientContact,
  type TrafficLogItem,
  type CommLogItem,
} from "@/components/team/team-governance-hub";

export const metadata = { title: "Equipe & Governança — ArqVértice Flow" };
export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const now = new Date();
  const user = await currentUser();
  if (!user) redirect("/");

  // 3. ARQUITETO | ENGENHEIRO | EQUIPE | OPERADOR → /equipe
  // Antigo: requirePageRole("ADMIN")
  if (!isTeamRole(user.role)) redirect("/");

  // 1. Busca usuários, projetos, etapas, clientes, logs de acesso e de comunicação
  const [users, rawProjects, rawStages, rawLogs, rawClients, rawTrafficLogs, rawCommLogs] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          specialty: true,
          whatsapp: true,
          isActive: true,
          permissions: true,
          projectAccess: { select: { projectId: true, canEdit: true } },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.project.findMany({
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.scheduleStage.findMany({
        select: {
          id: true,
          name: true,
          discipline: true,
          designer: true,
          dueDate: true,
          completion: true,
          status: true,
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: [{ dueDate: "asc" }, { order: "asc" }],
      }),
      prisma.stageReminderLog.findMany({
        take: 100,
        orderBy: { sentAt: "desc" },
      }),
      prisma.client.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          projects: { select: { name: true }, take: 1 },
        },
        orderBy: { name: "asc" },
      }),
      prisma.userAccessLog.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      prisma.communicationLog.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const projects: ProjectSummary[] = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client?.name || "Cliente",
  }));

  const clients: ClientContact[] = rawClients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    projectName: c.projects[0]?.name || null,
  }));

  const trafficLogs: TrafficLogItem[] = rawTrafficLogs.map((log) => ({
    id: log.id,
    userName: log.userName,
    userEmail: log.userEmail,
    userRole: log.userRole,
    eventType: log.eventType,
    ipAddress: log.ipAddress,
    deviceInfo: log.deviceInfo,
    createdAt: log.createdAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  }));

  const commLogs: CommLogItem[] = rawCommLogs.map((log) => ({
    id: log.id,
    recipientName: log.recipientName,
    recipientContact: log.recipientContact,
    channel: log.channel,
    category: log.category,
    deliveryMethod: log.deliveryMethod,
    status: log.status,
    sentBy: log.sentBy,
    messageBody: log.messageBody,
    createdAt: log.createdAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  // 2. Mapeamento por Pessoa (Person-Centric Workspace)
  const members: TeamMemberData[] = users.map((u) => {
    const userFirstName = u.name.trim().toLowerCase().split(" ")[0];

    const userStages: TeamMemberStage[] = rawStages
      .filter((s) => {
        if (!s.designer) return false;
        const d = s.designer.trim().toLowerCase();
        return d.includes(userFirstName) || d === u.name.trim().toLowerCase();
      })
      .map((s) => {
        let urgency: TeamMemberStage["urgency"] = "NO_PRAZO";
        if (s.dueDate && s.completion < 100) {
          const due = new Date(s.dueDate);
          const diffMs = due.getTime() - now.getTime();
          const daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          if (daysDiff < 0) {
            urgency = "ATRASADO";
          } else if (daysDiff === 0) {
            urgency = "HOJE";
          } else if (daysDiff <= 3) {
            urgency = "PROXIMO";
          }
        }

        return {
          id: s.id,
          name: s.name,
          discipline: s.discipline || "Geral",
          projectId: s.projectId,
          projectName: s.project.name,
          dueDate: s.dueDate,
          completion: s.completion,
          status: s.status,
          urgency,
        };
      });

    const userLogs: ReminderLogItem[] = rawLogs
      .filter(
        (l) =>
          l.recipientName?.toLowerCase().includes(userFirstName) ||
          (l.recipientEmail && l.recipientEmail.toLowerCase() === u.email.toLowerCase()) ||
          (u.whatsapp &&
            l.recipientPhone &&
            l.recipientPhone.replace(/\D/g, "") === u.whatsapp.replace(/\D/g, ""))
      )
      .slice(0, 15)
      .map((l) => ({
        id: l.id,
        triggerType: l.triggerType,
        channel: l.channel,
        messageBody: l.messageBody,
        sentAt: l.sentAt ? new Date(l.sentAt).toLocaleString("pt-BR") : "—",
        status: l.status,
      }));

    const canEdit = u.projectAccess.some((a) => a.canEdit);
    const assignedProjectIds = u.projectAccess.map((a) => a.projectId);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as TeamMemberData["role"],
      specialty: u.specialty,
      whatsapp: u.whatsapp,
      isActive: u.isActive,
      permissions: u.permissions || [],
      assignedProjectIds,
      canEdit,
      stages: userStages,
      logs: userLogs,
    };
  });

  return (
    <AppShell eyebrow="Governança">
      <TeamGovernanceHub
        members={members}
        projects={projects}
        clients={clients}
        trafficLogs={trafficLogs}
        commLogs={commLogs}
      />
    </AppShell>
  );
}
