import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { ProjectDiscipline } from "@prisma/client";

export interface PluginAuthContext {
  userId: string;
  userName: string;
  userRole: string;
  tokenProjectId: string | null;
  tokenName: string;
}

export async function authenticatePluginRequest(
  request: Request
): Promise<{ ok: true; ctx: PluginAuthContext } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Autenticação requerida via Bearer Token." };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { ok: false, status: 401, error: "Token vazio." };
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const apiToken = await prisma.acervoApiToken.findUnique({
    where: { tokenHash },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  if (!apiToken || apiToken.revokedAt) {
    return { ok: false, status: 403, error: "Token de API inválido ou revogado." };
  }

  if (apiToken.expiresAt && new Date() > apiToken.expiresAt) {
    return { ok: false, status: 403, error: "Token de API expirado." };
  }

  await prisma.acervoApiToken.update({
    where: { id: apiToken.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    ok: true,
    ctx: {
      userId: apiToken.createdBy?.id || apiToken.createdById || "system-plugin",
      userName: apiToken.createdBy?.name || "Plugin CAD/BIM",
      userRole: apiToken.createdBy?.role || "EQUIPE",
      tokenProjectId: apiToken.projectId,
      tokenName: apiToken.name,
    },
  };
}

export async function authenticatePluginCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, role: true, passwordHash: true, isActive: true },
  });

  if (!user || !user.isActive || !user.passwordHash) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  };
}

export async function getAllowedProjectsAndDisciplines(
  userId: string,
  userRole: string,
  tokenProjectId: string | null
) {
  const permissions = await prisma.acervoDisciplinePermission.findMany({
    where: { userId, canUploadRevision: true },
    select: { projectId: true, discipline: true, canApproveForWork: true },
  });

  const isAdmin = userRole === "ADMIN";
  const allowedProjectIds = isAdmin
    ? undefined
    : Array.from(
        new Set(
          permissions
            .map((p) => p.projectId)
            .filter((id): id is string => Boolean(id))
        )
      );

  const projects = await prisma.project.findMany({
    where: {
      ...(tokenProjectId ? { id: tokenProjectId } : {}),
      ...(allowedProjectIds ? { id: { in: allowedProjectIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const folderCounts = await prisma.acervoFolder.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projects.map((p) => p.id) } },
    _count: { _all: true },
  });
  const countMap = new Map(folderCounts.map((f) => [f.projectId, f._count._all]));

  const allDisciplines: ProjectDiscipline[] = [
    "ARQUITETURA",
    "ESTRUTURA",
    "ESTRUTURAL",
    "ELETRICO",
    "HIDROSSANITARIO",
    "HVAC",
    "INTERIORES",
    "COMPATIBILIZACAO",
    "RENDER_3D",
  ];

  return projects.map((p) => {
    const projectPerms = permissions.filter((perm) => perm.projectId === p.id || perm.projectId === null);
    const disciplines = isAdmin
      ? allDisciplines
      : Array.from(new Set(projectPerms.map((perm) => perm.discipline)));
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      foldersCount: countMap.get(p.id) || 0,
      writableDisciplines: disciplines,
    };
  });
}
