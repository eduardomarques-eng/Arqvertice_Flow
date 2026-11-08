"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import type {
  ProjectDiscipline,
  DeliverableType,
  ApprovalStatus,
} from "@prisma/client";

export type SaveDeliverableInput = {
  projectId: string;
  sheetCode?: string;
  subject: string;
  title: string;
  discipline: ProjectDiscipline;
  type: DeliverableType;
  environmentId?: string;
  folderId?: string;
  stageId?: string;
  fileUrl: string;
  fileSize?: string;
  version: string;
  description?: string;
  isClientView: boolean;
  isRequired?: boolean;
  status?: ApprovalStatus;
};

export type UpdateDeliverableInput = Partial<{
  sheetCode: string;
  subject: string;
  title: string;
  discipline: ProjectDiscipline;
  type: DeliverableType;
  environmentId: string;
  folderId: string;
  stageId: string;
  version: string;
  description: string;
  isClientView: boolean;
  isRequired: boolean;
  status: ApprovalStatus;
}>;

/**
 * 1. getProjectDeliverablesData(projectId)
 * Retorna as pastas, ambientes, etapas do cronograma e pranchas/entregáveis do projeto.
 */
export async function getProjectDeliverablesData(projectId: string) {
  await requireProjectAccess(projectId);

  const [folders, environments, stages, deliverables] = await Promise.all([
    prisma.projectFolder.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    }),
    prisma.projectEnvironment.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    }),
    prisma.scheduleStage.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    }),
    prisma.projectDeliverable.findMany({
      where: { projectId },
      include: {
        stage: { select: { id: true, name: true, discipline: true, status: true } },
        environment: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true } },
        checklists: true,
      },
      orderBy: [
        { discipline: "asc" },
        { sheetCode: "asc" },
        { createdAt: "desc" },
      ],
    }),
  ]);

  return {
    folders,
    environments,
    stages,
    deliverables,
  };
}

/**
 * 2. saveDeliverableWithMetadata(data)
 * Grava o entregável na tabela ProjectDeliverable e revalida a rota.
 */
export async function saveDeliverableWithMetadata(data: SaveDeliverableInput) {
  await requireRole("ADMIN");

  let finalEnvId = data.environmentId;
  // Se passou nome de ambiente novo em vez de UUID
  if (data.environmentId && !data.environmentId.includes("-")) {
    const existing = await prisma.projectEnvironment.findFirst({
      where: {
        projectId: data.projectId,
        name: { equals: data.environmentId, mode: "insensitive" },
      },
    });
    if (existing) {
      finalEnvId = existing.id;
    } else {
      const created = await prisma.projectEnvironment.create({
        data: { projectId: data.projectId, name: data.environmentId },
      });
      finalEnvId = created.id;
    }
  }

  const deliverable = await prisma.projectDeliverable.create({
    data: {
      projectId: data.projectId,
      folderId: data.folderId || null,
      environmentId: finalEnvId || null,
      stageId: data.stageId || null,
      discipline: data.discipline,
      type: data.type,
      sheetCode: data.sheetCode?.trim() || null,
      subject: data.subject.trim(),
      title: data.title.trim() || `${data.sheetCode || ""} - ${data.subject.trim()}`,
      description: data.description?.trim() || null,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize || null,
      version: data.version?.trim() || "R00",
      status: data.status || "EM_ELABORACAO",
      isClientView: data.isClientView ?? false,
      isRequired: data.isRequired ?? true,
    },
    include: {
      stage: true,
      environment: true,
      folder: true,
    },
  });

  revalidatePath(`/admin/projetos/${data.projectId}`);
  revalidatePath(`/admin/projetos/${data.projectId}/relatorio`);
  revalidatePath(`/portal/${data.projectId}`);

  return { success: true, deliverable };
}

/**
 * 3. updateDeliverableMetadata(id, projectId, data)
 * Atualiza os metadados da prancha no banco Neon e revalida a rota.
 */
export async function updateDeliverableMetadata(
  id: string,
  projectId: string,
  data: UpdateDeliverableInput,
) {
  await requireRole("ADMIN");

  const existing = await prisma.projectDeliverable.findUnique({ where: { id } });
  if (!existing) return notFound("Prancha / Entregável");

  let finalEnvId = data.environmentId;
  if (data.environmentId && !data.environmentId.includes("-")) {
    const existingEnv = await prisma.projectEnvironment.findFirst({
      where: {
        projectId,
        name: { equals: data.environmentId, mode: "insensitive" },
      },
    });
    if (existingEnv) {
      finalEnvId = existingEnv.id;
    } else {
      const created = await prisma.projectEnvironment.create({
        data: { projectId, name: data.environmentId },
      });
      finalEnvId = created.id;
    }
  }

  const deliverable = await prisma.projectDeliverable.update({
    where: { id },
    data: {
      ...(data.folderId !== undefined ? { folderId: data.folderId || null } : {}),
      ...(data.environmentId !== undefined ? { environmentId: finalEnvId || null } : {}),
      ...(data.stageId !== undefined ? { stageId: data.stageId || null } : {}),
      ...(data.discipline ? { discipline: data.discipline } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.sheetCode !== undefined ? { sheetCode: data.sheetCode?.trim() || null } : {}),
      ...(data.subject !== undefined ? { subject: data.subject.trim() } : {}),
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.version !== undefined ? { version: data.version.trim() } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.isClientView !== undefined ? { isClientView: data.isClientView } : {}),
      ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
    },
    include: {
      stage: true,
      environment: true,
      folder: true,
    },
  });

  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/admin/projetos/${projectId}/relatorio`);
  revalidatePath(`/portal/${projectId}`);

  return { success: true, deliverable };
}

/**
 * 4. deleteDeliverable(id, projectId)
 * Remove o registro do banco de dados com segurança e revalida a rota.
 */
export async function deleteDeliverable(id: string, projectId: string) {
  await requireRole("ADMIN");

  const existing = await prisma.projectDeliverable.findUnique({ where: { id } });
  if (!existing) return notFound("Prancha / Entregável");

  await prisma.projectDeliverable.delete({ where: { id } });

  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/admin/projetos/${projectId}/relatorio`);
  revalidatePath(`/portal/${projectId}`);

  return { success: true };
}

