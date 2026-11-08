"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireProjectAccess, requireRole, currentUser } from "@/server/auth";
import { notFound } from "@/server/errors";
import type {
  ProjectDiscipline,
  DeliverableType,
  ApprovalStatus,
  ProjectStagePhase,
  AcervoCategory,
  AccessActionType,
} from "@prisma/client";

export type SaveDeliverableInput = {
  projectId: string;
  sheetCode?: string;
  subject: string;
  title: string;
  subtitle?: string | null;
  discipline: ProjectDiscipline;
  phaseFolder?: ProjectStagePhase;
  category?: AcervoCategory;
  type?: DeliverableType;
  environmentId?: string;
  folderId?: string;
  stageId?: string;
  fileUrl: string;
  thumbnailUrl?: string;
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
  subtitle: string;
  discipline: ProjectDiscipline;
  phaseFolder: ProjectStagePhase;
  category: AcervoCategory;
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

export type BatchSaveDeliverableItem = {
  projectId?: string;
  sheetCode?: string | null;
  subject: string;
  title: string;
  subtitle?: string | null;
  discipline: ProjectDiscipline;
  phaseFolder?: ProjectStagePhase;
  category?: AcervoCategory;
  type?: DeliverableType;
  environmentId?: string | null;
  environmentName?: string | null;
  stageId?: string | null;
  folderId?: string | null;
  fileUrl: string;
  fileSize?: string | null;
  thumbnailUrl?: string | null;
  version?: string;
  description?: string | null;
  isClientView?: boolean;
  isRequired?: boolean;
  status?: ApprovalStatus;
};

export type CatalogUploadedDeliverableItem = {
  projectId: string;
  sheetCode?: string | null;
  title: string;
  subtitle?: string | null;
  subject: string;
  discipline: ProjectDiscipline;
  phaseFolder: ProjectStagePhase;
  category: AcervoCategory;
  type?: DeliverableType;
  version?: string;
  description?: string | null;
  stageId?: string | null;
  environmentId?: string | null;
  folderId?: string | null;
  fileUrl: string;
  fileSize?: string | null;
  thumbnailUrl?: string | null;
  isClientView?: boolean;
  isRequired?: boolean;
  status?: ApprovalStatus;
};

export type UpdateCatalogedDeliverableData = Partial<{
  projectId: string;
  sheetCode: string | null;
  subject: string;
  title: string;
  subtitle: string | null;
  discipline: ProjectDiscipline;
  phaseFolder: ProjectStagePhase;
  category: AcervoCategory;
  type: DeliverableType;
  environmentId: string | null;
  folderId: string | null;
  stageId: string | null;
  version: string;
  description: string | null;
  fileUrl: string;
  fileSize: string | null;
  thumbnailUrl: string | null;
  isClientView: boolean;
  isRequired: boolean;
  status: ApprovalStatus;
}>;

export type LogDeliverableAccessInput = {
  projectId: string;
  deliverableId: string;
  action: AccessActionType | "VIEW" | "DOWNLOAD";
  userName?: string | null;
  userRole?: string | null;
  userId?: string | null;
  sheetTitle?: string | null;
};

export type RecordAccessLogInput = LogDeliverableAccessInput;

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
      phaseFolder: data.phaseFolder || "PROJETO_EXECUTIVO",
      category: data.category || "PLANTA_TECNICA_PDF",
      type: data.type || "PRANCHA_EXECUTIVA",
      sheetCode: data.sheetCode?.trim() || null,
      subject: data.subject.trim(),
      title: data.title.trim() || `${data.sheetCode || ""} - ${data.subject.trim()}`,
      subtitle: data.subtitle?.trim() || null,
      description: data.description?.trim() || null,
      fileUrl: data.fileUrl,
      thumbnailUrl: data.thumbnailUrl || null,
      fileSize: data.fileSize || null,
      version: data.version?.trim() || "R00",
      status: data.status || "APROVADO_INTERNO",
      isClientView: data.isClientView ?? true,
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
 * 3. catalogUploadedDeliverables(items)
 * Recebe um ou múltiplos arquivos recém-enviados na janela temporária de catalogação
 * e grava todos no banco com title, subtitle, subject, discipline,
 * phaseFolder (PROJETO_PRELIMINAR, PROJETO_LEGAL, PROJETO_EXECUTIVO), category,
 * version (R00), description e stageId.
 */
export async function catalogUploadedDeliverables(
  items: CatalogUploadedDeliverableItem[],
) {
  await requireRole("ADMIN");

  if (!items || items.length === 0) {
    return { success: true, count: 0, deliverables: [] };
  }

  const createdDeliverables = await prisma.$transaction(
    items.map((item) =>
      prisma.projectDeliverable.create({
        data: {
          projectId: item.projectId,
          sheetCode: item.sheetCode?.trim() || null,
          title: item.title.trim() || `${item.sheetCode || ""} - ${item.subject.trim()}`,
          subtitle: item.subtitle?.trim() || null,
          subject: item.subject.trim(),
          discipline: item.discipline,
          phaseFolder: item.phaseFolder || "PROJETO_EXECUTIVO",
          category: item.category || "PLANTA_TECNICA_PDF",
          type: item.type || "PRANCHA_EXECUTIVA",
          version: item.version?.trim() || "R00",
          description: item.description?.trim() || null,
          stageId: item.stageId || null,
          environmentId: item.environmentId || null,
          folderId: item.folderId || null,
          fileUrl: item.fileUrl,
          fileSize: item.fileSize || null,
          thumbnailUrl: item.thumbnailUrl || null,
          isClientView: item.isClientView ?? true,
          isRequired: item.isRequired ?? true,
          status: item.status || "APROVADO_INTERNO",
        },
        include: {
          stage: true,
          environment: true,
          folder: true,
        },
      })
    )
  );

  const affectedProjects = Array.from(new Set(items.map((i) => i.projectId)));
  for (const pId of affectedProjects) {
    revalidatePath(`/admin/projetos/${pId}`);
    revalidatePath(`/admin/projetos/${pId}/relatorio`);
    revalidatePath(`/portal/${pId}`);
  }

  return { success: true, count: createdDeliverables.length, deliverables: createdDeliverables };
}

/**
 * batchSaveDeliverables(projectId, items) - Alias de compatibilidade
 */
export async function batchSaveDeliverables(
  projectId: string,
  items: BatchSaveDeliverableItem[],
) {
  return catalogUploadedDeliverables(
    items.map((item) => ({
      ...item,
      projectId: item.projectId || projectId,
      phaseFolder: item.phaseFolder || "PROJETO_EXECUTIVO",
      category: item.category || "PLANTA_TECNICA_PDF",
    }))
  );
}

/**
 * 4. updateCatalogedDeliverable(id, data)
 * Permite editar qualquer dado da planta cadastrada posteriormente.
 */
export async function updateCatalogedDeliverable(
  id: string,
  data: UpdateCatalogedDeliverableData,
) {
  await requireRole("ADMIN");

  const existing = await prisma.projectDeliverable.findUnique({ where: { id } });
  if (!existing) return notFound("Prancha / Entregável");

  const projectId = data.projectId || existing.projectId;

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
      ...(data.phaseFolder ? { phaseFolder: data.phaseFolder } : {}),
      ...(data.category ? { category: data.category } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.sheetCode !== undefined ? { sheetCode: data.sheetCode?.trim() || null } : {}),
      ...(data.subject !== undefined ? { subject: data.subject.trim() } : {}),
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.subtitle !== undefined ? { subtitle: data.subtitle?.trim() || null } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.version !== undefined ? { version: data.version.trim() } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.isClientView !== undefined ? { isClientView: data.isClientView } : {}),
      ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
      ...(data.fileUrl ? { fileUrl: data.fileUrl } : {}),
      ...(data.fileSize !== undefined ? { fileSize: data.fileSize } : {}),
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
 * updateDeliverableMetadata(id, projectId, data) - Alias de compatibilidade
 */
export async function updateDeliverableMetadata(
  id: string,
  projectId: string,
  data: UpdateDeliverableInput,
) {
  return updateCatalogedDeliverable(id, { ...data, projectId });
}

/**
 * 5. deleteDeliverable(id, projectId)
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

/**
 * 6. logDeliverableAccess({ projectId, deliverableId, action, userName, userRole })
 * Registra instantaneamente na tabela DeliverableAccessLog toda vez que alguém clicar em "Visualizar" ou "Download".
 */
export async function logDeliverableAccess(data: LogDeliverableAccessInput) {
  const user = await currentUser();

  const finalUserId = data.userId || user?.id || null;
  const finalUserName = data.userName || user?.name || user?.email || "Visitante";
  const finalUserRole = data.userRole || user?.role || "CLIENT";
  const actionEnum: AccessActionType = data.action === "DOWNLOAD" ? "DOWNLOAD" : "VIEW";

  let finalSheetTitle = data.sheetTitle;
  if (!finalSheetTitle) {
    const deliverable = await prisma.projectDeliverable.findUnique({
      where: { id: data.deliverableId },
      select: { title: true, subtitle: true, version: true, sheetCode: true },
    });
    if (deliverable) {
      const codePart = deliverable.sheetCode ? `[${deliverable.sheetCode}] ` : "";
      const subPart = deliverable.subtitle ? ` - ${deliverable.subtitle}` : "";
      finalSheetTitle = `${codePart}${deliverable.title}${subPart} (${deliverable.version})`;
    } else {
      finalSheetTitle = "Prancha / Documento Técnico";
    }
  }

  const log = await prisma.deliverableAccessLog.create({
    data: {
      projectId: data.projectId,
      deliverableId: data.deliverableId,
      userId: finalUserId,
      userName: finalUserName,
      userRole: finalUserRole,
      action: actionEnum,
      sheetTitle: finalSheetTitle,
    },
  });

  return { success: true, log };
}

/**
 * recordDeliverableAccessLog(data) - Alias de compatibilidade
 */
export async function recordDeliverableAccessLog(data: RecordAccessLogInput) {
  return logDeliverableAccess(data);
}

/**
 * 7. getProjectAccessLogs(projectId)
 * Retorna o histórico completo de visualizações e downloads ordenado do mais recente para o mais antigo para o Relatório do Admin.
 */
export async function getProjectAccessLogs(projectId: string) {
  await requireProjectAccess(projectId);

  const logs = await prisma.deliverableAccessLog.findMany({
    where: { projectId },
    include: {
      deliverable: {
        select: {
          id: true,
          sheetCode: true,
          title: true,
          subtitle: true,
          discipline: true,
          phaseFolder: true,
          category: true,
          version: true,
          fileUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return logs;
}

/**
 * getDeliverableAccessLogs(projectId, deliverableId, limit) - Alias de compatibilidade com filtro opcional
 */
export async function getDeliverableAccessLogs(
  projectId: string,
  deliverableId?: string,
  limit: number = 50,
) {
  await requireRole("ADMIN");

  const logs = await prisma.deliverableAccessLog.findMany({
    where: {
      projectId,
      ...(deliverableId ? { deliverableId } : {}),
    },
    include: {
      deliverable: {
        select: {
          id: true,
          sheetCode: true,
          title: true,
          subtitle: true,
          discipline: true,
          phaseFolder: true,
          category: true,
          version: true,
          fileUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs;
}
