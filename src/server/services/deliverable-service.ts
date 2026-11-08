import { prisma } from "@/server/db";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import type { ProjectDiscipline, DeliverableType, ApprovalStatus } from "@prisma/client";
import { DISCIPLINE_LABELS } from "@/lib/sheet-metadata-parser";

export type CreateDeliverableInput = {
  projectId: string;
  folderId?: string | null;
  environmentId?: string | null;
  stageId?: string | null;
  discipline: ProjectDiscipline;
  type: DeliverableType;
  sheetCode: string;
  subject: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  thumbnailUrl?: string | null;
  version?: string;
  fileSize?: string | null;
  status?: ApprovalStatus;
  isClientView?: boolean;
  isRequired?: boolean;
};

export type UpdateDeliverableInput = Partial<CreateDeliverableInput>;

export async function listProjectDeliverables(projectId: string, clientVisibleOnly = false) {
  if (clientVisibleOnly) {
    await requireProjectAccess(projectId);
  } else {
    await requireRole("ADMIN");
  }

  return prisma.projectDeliverable.findMany({
    where: {
      projectId,
      ...(clientVisibleOnly ? { isClientView: true } : {}),
    },
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
  });
}

export async function getDeliverableById(id: string) {
  const deliverable = await prisma.projectDeliverable.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, discipline: true } },
      environment: { select: { id: true, name: true } },
      folder: { select: { id: true, name: true } },
      checklists: true,
    },
  });

  if (!deliverable) return notFound("Prancha / Entregável");
  return deliverable;
}

export async function createProjectDeliverable(input: CreateDeliverableInput) {
  await requireRole("ADMIN");

  // Se o environmentId for string com texto e não UUID, ou se precisar criar ambiente novo
  let finalEnvId = input.environmentId;
  if (input.environmentId && !input.environmentId.includes("-")) {
    // É o nome de um ambiente, cria ou busca
    const existingEnv = await prisma.projectEnvironment.findFirst({
      where: { projectId: input.projectId, name: { equals: input.environmentId, mode: "insensitive" } },
    });
    if (existingEnv) {
      finalEnvId = existingEnv.id;
    } else {
      const newEnv = await prisma.projectEnvironment.create({
        data: { projectId: input.projectId, name: input.environmentId },
      });
      finalEnvId = newEnv.id;
    }
  }

  return prisma.projectDeliverable.create({
    data: {
      projectId: input.projectId,
      folderId: input.folderId || null,
      environmentId: finalEnvId || null,
      stageId: input.stageId || null,
      discipline: input.discipline,
      type: input.type,
      sheetCode: input.sheetCode.trim(),
      subject: input.subject.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      fileUrl: input.fileUrl,
      thumbnailUrl: input.thumbnailUrl || null,
      version: input.version?.trim() || "R00",
      fileSize: input.fileSize || null,
      status: input.status || "EM_ELABORACAO",
      isClientView: input.isClientView ?? false,
      isRequired: input.isRequired ?? true,
    },
    include: {
      stage: true,
      environment: true,
    },
  });
}

export async function updateProjectDeliverable(id: string, input: UpdateDeliverableInput) {
  await requireRole("ADMIN");

  const existing = await prisma.projectDeliverable.findUnique({ where: { id } });
  if (!existing) return notFound("Prancha / Entregável");

  let finalEnvId = input.environmentId;
  if (input.environmentId && !input.environmentId.includes("-")) {
    const existingEnv = await prisma.projectEnvironment.findFirst({
      where: { projectId: existing.projectId, name: { equals: input.environmentId, mode: "insensitive" } },
    });
    if (existingEnv) {
      finalEnvId = existingEnv.id;
    } else {
      const newEnv = await prisma.projectEnvironment.create({
        data: { projectId: existing.projectId, name: input.environmentId },
      });
      finalEnvId = newEnv.id;
    }
  }

  return prisma.projectDeliverable.update({
    where: { id },
    data: {
      ...(input.folderId !== undefined ? { folderId: input.folderId || null } : {}),
      ...(input.environmentId !== undefined ? { environmentId: finalEnvId || null } : {}),
      ...(input.stageId !== undefined ? { stageId: input.stageId || null } : {}),
      ...(input.discipline ? { discipline: input.discipline } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.sheetCode ? { sheetCode: input.sheetCode.trim() } : {}),
      ...(input.subject ? { subject: input.subject.trim() } : {}),
      ...(input.title ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.fileUrl ? { fileUrl: input.fileUrl } : {}),
      ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
      ...(input.version ? { version: input.version.trim() } : {}),
      ...(input.fileSize !== undefined ? { fileSize: input.fileSize } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.isClientView !== undefined ? { isClientView: input.isClientView } : {}),
      ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
    },
    include: {
      stage: true,
      environment: true,
    },
  });
}

export async function deleteProjectDeliverable(id: string) {
  await requireRole("ADMIN");
  const existing = await prisma.projectDeliverable.findUnique({ where: { id } });
  if (!existing) return notFound("Prancha / Entregável");
  return prisma.projectDeliverable.delete({ where: { id } });
}

export type DeliverableMatrix = {
  total: number;
  delivered: number;
  pending: number;
  inReview: number;
  complianceRate: number; // %
  byDiscipline: {
    discipline: ProjectDiscipline;
    label: string;
    total: number;
    delivered: number;
    pending: number;
    inReview: number;
    complianceRate: number;
    sheets: {
      id: string;
      sheetCode: string | null;
      subject: string;
      version: string;
      status: ApprovalStatus;
      isClientView: boolean;
      isRequired: boolean;
      fileUrl: string;
      stageName: string | null;
    }[];
  }[];
};

export async function getDeliverableMatrix(projectId: string, clientVisibleOnly = false): Promise<DeliverableMatrix> {
  const deliverables = await listProjectDeliverables(projectId, clientVisibleOnly);

  const isDelivered = (status: ApprovalStatus) => status === "APROVADO_CLIENTE" || status === "LIBERADO_OBRA";
  const isInReview = (status: ApprovalStatus) => status === "REVISAO_INTERNA";
  const isPending = (status: ApprovalStatus) => status === "EM_ELABORACAO" || status === "REJEITADO";

  const total = deliverables.length;
  const delivered = deliverables.filter((d) => isDelivered(d.status)).length;
  const inReview = deliverables.filter((d) => isInReview(d.status)).length;
  const pending = deliverables.filter((d) => isPending(d.status)).length;
  const complianceRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  // Agrupar por disciplina
  const discMap = new Map<ProjectDiscipline, typeof deliverables>();
  for (const d of deliverables) {
    const list = discMap.get(d.discipline) ?? [];
    list.push(d);
    discMap.set(d.discipline, list);
  }

  // Assegura todas as disciplinas principais se houver pranchas
  const activeDisciplines = Object.keys(DISCIPLINE_LABELS) as ProjectDiscipline[];
  const byDiscipline = activeDisciplines
    .map((disc) => {
      const items = discMap.get(disc) ?? [];
      const dDelivered = items.filter((d) => isDelivered(d.status)).length;
      const dInReview = items.filter((d) => isInReview(d.status)).length;
      const dPending = items.filter((d) => isPending(d.status)).length;
      const dRate = items.length > 0 ? Math.round((dDelivered / items.length) * 100) : 0;

      return {
        discipline: disc,
        label: DISCIPLINE_LABELS[disc],
        total: items.length,
        delivered: dDelivered,
        inReview: dInReview,
        pending: dPending,
        complianceRate: dRate,
        sheets: items.map((item) => ({
          id: item.id,
          sheetCode: item.sheetCode,
          subject: item.subject,
          version: item.version,
          status: item.status,
          isClientView: item.isClientView,
          isRequired: item.isRequired,
          fileUrl: item.fileUrl,
          stageName: item.stage?.name ?? null,
        })),
      };
    })
    .filter((g) => g.total > 0); // Exibe disciplinas com ao menos 1 prancha ou previsão

  return {
    total,
    delivered,
    pending,
    inReview,
    complianceRate,
    byDiscipline,
  };
}

