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
  pluginName?: string;
  softwareVersion?: string;
}

export async function authenticatePluginRequest(
  request: Request
): Promise<{ ok: true; ctx: PluginAuthContext } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("authorization");
  const pluginName = request.headers.get("x-plugin-name") || undefined;
  const softwareVersion = request.headers.get("x-software-version") || undefined;

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "").trim();
  } else {
    // Permite token opcional via query string ?token=... para integrações legadas
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken) {
      token = queryToken.trim();
    }
  }

  if (!token) {
    return { ok: false, status: 401, error: "Autenticação requerida via Bearer Token." };
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
      pluginName,
      softwareVersion,
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
  const [permissions, projectAccessRows] = await Promise.all([
    prisma.acervoDisciplinePermission.findMany({
      where: { userId, canUploadRevision: true },
      select: { projectId: true, discipline: true, canApproveForWork: true },
    }),
    prisma.projectAccess.findMany({
      where: { userId },
      select: { projectId: true },
    }),
  ]);

  const isAdmin = userRole === "ADMIN";
  const allowedProjectIds = isAdmin
    ? undefined
    : Array.from(
        new Set([
          ...projectAccessRows.map((r) => r.projectId),
          ...permissions
            .map((p) => p.projectId)
            .filter((id): id is string => Boolean(id)),
        ])
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
      acervoFolders: {
        select: {
          id: true,
          name: true,
          phase: true,
          discipline: true,
          parentId: true,
        },
        orderBy: [{ phase: "asc" }, { name: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

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
      foldersCount: p.acervoFolders.length,
      folders: p.acervoFolders,
      writableDisciplines: disciplines,
    };
  });
}
