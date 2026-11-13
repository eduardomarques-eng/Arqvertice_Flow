import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { MASTER_DISCIPLINES, MASTER_PHASES, MASTER_ROLES } from "@/lib/master-data";
import { hashPassword } from "@/lib/password";

export interface CorporateUserMember {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR";
  isActive: boolean;
  phone: string | null;
  designation: string;
  canEdit: boolean;
  assignedProjectIds: string[];
}

/**
 * Busca todos os profissionais e clientes corporativos para o painel de Gestão.
 * Se algum membro padrão não estiver na base, garante sua criação de forma segura.
 */
export async function getCorporateGestaoData() {
  await requireModuleAccess("equipe");

  // 1. Busca todos os projetos para seleção
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      client: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // 2. Busca todos os usuários cadastrados
  let users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      phone: true,
      projectAccess: {
        select: { projectId: true, canEdit: true },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  // 3. Garantir os 5 perfis corporativos essenciais + cliente
  const defaultAccounts = [
    {
      name: "Eduardo Marques",
      email: "eduardo.marques.arq@gmail.com",
      role: "ADMIN" as const,
      designation: "Arquiteto Projetista",
      canEdit: true,
    },
    {
      name: "Luan Almeida",
      email: "luan.almeida@arqvertice.com.br",
      role: "ENGENHEIRO" as const,
      designation: "Engenheiro Calculista",
      canEdit: true,
    },
    {
      name: "Erick Santiago",
      email: "erick.santiago@arqvertice.com.br",
      role: "ARQUITETO" as const,
      designation: "Arquiteto de Obra",
      canEdit: true,
    },
    {
      name: "Claudio Marrocos",
      email: "claudiomarrocos2018@gmail.com",
      role: "ARQUITETO" as const,
      designation: "Arquiteto Projetista",
      canEdit: true,
    },
    {
      name: "Wagner Silva",
      email: "wagner.silva@arqvertice.com.br",
      role: "ENGENHEIRO" as const,
      designation: "Engenheiro Projetista",
      canEdit: true,
    },
    {
      name: "Pedro",
      email: "pedro@arqvertice.com",
      role: "CLIENTE" as const,
      designation: "Residência de Praia",
      canEdit: false,
    },
  ];

  // Identifica membros faltantes e provisiona se necessário
  for (const acc of defaultAccounts) {
    const existing = users.find(
      (u) =>
        u.email.toLowerCase() === acc.email.toLowerCase() ||
        u.name.toLowerCase().includes(acc.name.toLowerCase().split(" ")[0]),
    );

    if (!existing) {
      try {
        const created = await prisma.user.create({
          data: {
            name: acc.name,
            email: acc.email,
            passwordHash: hashPassword(process.env.SEED_ADMIN_PASSWORD || "ArqVertice@2026"),
            role: acc.role,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            phone: true,
            projectAccess: { select: { projectId: true, canEdit: true } },
          },
        });
        users.push(created);
      } catch {
        // Ignora caso haja colisão concomitante
      }
    }
  }

  // Mapeia para a estrutura corporativa padronizada
  const mappedMembers: CorporateUserMember[] = users.map((u) => {
    let designation = "Profissional do Estúdio";
    if (u.name.toLowerCase().includes("eduardo")) designation = "Arquiteto Titular";
    else if (u.name.toLowerCase().includes("luan") || u.role === "ENGENHEIRO") designation = "Engenharia Estrutural";
    else if (u.name.toLowerCase().includes("erick") || u.role === "EQUIPE") designation = "Fullstack & Sistemas";
    else if (u.name.toLowerCase().includes("pedro") || u.role === "CLIENTE" || (u.role as string) === "CLIENT") designation = "Residência de Praia";

    const canEdit = u.projectAccess.some((pa) => pa.canEdit) || u.role === "ADMIN" || u.role === "ARQUITETO" || u.role === "ENGENHEIRO";
    const assignedProjectIds = u.projectAccess.map((pa) => pa.projectId);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as CorporateUserMember["role"],
      isActive: u.isActive ?? true,
      phone: u.phone,
      designation,
      canEdit,
      assignedProjectIds,
    };
  });

  return {
    members: mappedMembers,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.client?.name || "Cliente",
    })),
    disciplines: MASTER_DISCIPLINES,
    phases: MASTER_PHASES,
    roles: MASTER_ROLES,
  };
}

/**
 * Atualiza instantaneamente as permissões, papel e projetos de um usuário.
 */
export async function updateCorporateUserPermissions(
  userId: string,
  data: {
    role?: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR";
    isActive?: boolean;
    canEdit?: boolean;
    projectIds?: string[];
  },
) {
  await requireModuleAccess("equipe");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new DomainError("Usuário corporativo não localizado.", "NOT_FOUND");

  // 1. Atualiza dados de cadastro e papel se fornecidos
  if (data.role !== undefined || data.isActive !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  // 2. Atualiza vínculos de projetos e privilégio canEdit
  if (data.projectIds !== undefined) {
    const uniqueIds = [...new Set(data.projectIds)];
    const validProjects = await prisma.project.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const validProjectIds = validProjects.map((p) => p.id);

    const canEditValue = data.canEdit ?? false;

    await prisma.$transaction(async (tx) => {
      await tx.projectAccess.deleteMany({ where: { userId } });
      if (validProjectIds.length > 0) {
        await tx.projectAccess.createMany({
          data: validProjectIds.map((projectId) => ({
            userId,
            projectId,
            canEdit: canEditValue,
          })),
          skipDuplicates: true,
        });
      }
    });
  } else if (data.canEdit !== undefined) {
    // Apenas altera o canEdit nos projetos já vinculados
    await prisma.projectAccess.updateMany({
      where: { userId },
      data: { canEdit: data.canEdit },
    });
  }

  return { success: true, userId };
}




