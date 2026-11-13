import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { stageAlert } from "@/lib/schedule-alerts";
import { completionOf } from "@/lib/progress";
import { currentUser } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";

/**
 * Operação do cronograma pelo funcionário da equipa (OPERADOR).
 *
 * ADMIN vê todos os projetos; OPERADOR vê apenas os projetos atribuídos via
 * `ProjectAccess`. A escrita continua protegida no serviço de cronograma.
 */
export async function listOperationProjects(userId: string, role: "ADMIN" | "EQUIPE" | "OPERADOR") {
  const projects = await prisma.project.findMany({
    where: role === "ADMIN" ? undefined : { access: { some: { userId } } },
    select: {
      id: true,
      name: true,
      status: true,
      address: true,
      client: { select: { name: true, city: true, state: true, phone: true } },
      stages: { select: { completion: true, status: true, dueDate: true, discipline: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  return projects.map((project) => {
    const overdue = project.stages.filter(
      (stage) => stageAlert({ status: stage.status, dueDate: stage.dueDate }, now).overdue,
    ).length;
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      address: project.address,
      client: project.client,
      clientName: project.client.name,
      stages: project.stages,
      overdue,
      progress: completionOf(project.stages),
    };
  });
}

/**
 * Gestão da equipa (ADMIN). Todas as funções abaixo exigem sessão de ADMIN — o
 * próprio operador nunca chega aqui, e um cliente muito menos. A atribuição de
 * projetos é a única forma de dar acesso a um operador: escrevemos `ProjectAccess`,
 * o mesmo mecanismo que isola o cliente, e é essa linha que a operação lê.
 */

/** Operadores e membros de equipe existentes, para o ADMIN gerir. */
export async function listOperadores() {
  await requireModuleAccess("equipe");
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      projectAccess: { select: { projectId: true, canEdit: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Lista completa de usuários para o painel RBAC */
export async function listAllTeamMembers() {
  await requireModuleAccess("equipe");
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
      projectAccess: { select: { projectId: true, canEdit: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

/** Atualiza papel (RBAC) e status de ativação do usuário */
export async function updateUserRoleAndStatus(
  userId: string,
  role: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR",
  isActive: boolean,
) {
  await requireModuleAccess("equipe");
  return prisma.user.update({
    where: { id: userId },
    data: { role, isActive },
  });
}

/** Projetos disponíveis para atribuir (id + nome + cliente). */
export async function listAssignableProjects() {
  await requireModuleAccess("equipe");
  return prisma.project.findMany({
    select: { id: true, name: true, client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Define exatamente quais projetos um operador pode operar. Substitui o conjunto
 * (adição e remoção) numa transacção, para que a lista seja a fonte da verdade e
 * não um acrescento sem fim. IDs inválidos são ignorados pela constraint do
 * banco; a unicidade [projectId, userId] impede duplicados.
 */
export async function setOperatorProjectAccess(
  userId: string,
  projectIds: readonly string[],
  canEdit: boolean = false,
) {
  await requireModuleAccess("equipe");

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!targetUser) throw new DomainError("Usuário não encontrado.", "NOT_FOUND");

  const uniqueProjectIds = [...new Set(projectIds)];
  const validProjects = await prisma.project.findMany({
    where: { id: { in: uniqueProjectIds } },
    select: { id: true },
  });
  const validIds = validProjects.map((project) => project.id);

  await prisma.$transaction(async (tx) => {
    await tx.projectAccess.deleteMany({ where: { userId } });
    if (validIds.length > 0) {
      await tx.projectAccess.createMany({
        data: validIds.map((projectId) => ({ userId, projectId, canEdit })),
        skipDuplicates: true,
      });
    }
  });

  return { userId, projectIds: validIds };
}


