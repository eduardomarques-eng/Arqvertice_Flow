"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { CANONICAL_CHECKLIST_TEMPLATE } from "@/lib/checklist-template";

export interface ChecklistItemData {
  id: string;
  projectId: string;
  category: string;
  task: string;
  notes: string | null;
  isCompleted: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | string | null;
  completedAt: Date | string | null;
  deliverableId: string | null;
  stageId: string | null;
  deliverable?: { id: string; sheetCode: string | null; subject: string } | null;
  stage?: { id: string; name: string } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}


/**
 * Busca ou inicializa o checklist de um projeto.
 */
export async function getProjectChecklist(projectId: string): Promise<ChecklistItemData[]> {
  await requireProjectAccess(projectId);

  let items = await prisma.checklistItem.findMany({
    where: { projectId },
    include: {
      deliverable: { select: { id: true, sheetCode: true, subject: true } },
      stage: { select: { id: true, name: true } },
    },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });

  // Se ainda não houver itens para esse projeto, popula com o template canônico
  if (items.length === 0) {
    const now = new Date();
    await prisma.checklistItem.createMany({
      data: CANONICAL_CHECKLIST_TEMPLATE.map((tpl) => ({
        projectId,
        category: tpl.category,
        task: tpl.task,
        notes: tpl.notes,
        isCompleted: tpl.isCompleted,
        verifiedBy: tpl.verifiedBy,
        verifiedAt: tpl.isCompleted ? now : null,
        completedAt: tpl.isCompleted ? now : null,
      })),
    });

    items = await prisma.checklistItem.findMany({
      where: { projectId },
      include: {
        deliverable: { select: { id: true, sheetCode: true, subject: true } },
        stage: { select: { id: true, name: true } },
      },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    });
  }

  return items;
}

/**
 * 1. toggleChecklistItem(itemId, projectId, isCompleted, verifiedBy)
 * Atualiza isCompleted, define verifiedBy e verifiedAt = new Date() (ou limpa ambos se desmarcado).
 * Revalida o caminho /admin/projetos/[id].
 */
export async function toggleChecklistItem(
  itemId: string,
  projectId: string,
  isCompleted: boolean,
  verifiedBy: string = "Eduardo Marques"
) {
  await requireRole("ADMIN");

  const existing = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.projectId !== projectId) {
    return notFound("Item de Checklist");
  }

  const now = new Date();

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      isCompleted,
      verifiedBy: isCompleted ? (verifiedBy || "Eduardo Marques") : null,
      verifiedAt: isCompleted ? now : null,
      completedAt: isCompleted ? now : null,
    },
  });

  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/admin/projetos/${projectId}/relatorio`);
  revalidatePath(`/portal/${projectId}`);

  return { success: true, item: updated };
}

/**
 * 2. createChecklistItem(data)
 * Insere o item na tabela ChecklistItem e revalida /admin/projetos/[id].
 */
export async function createChecklistItem(data: {
  projectId: string;
  category: string;
  task: string;
  stageId?: string;
  deliverableId?: string;
  notes?: string;
  verifiedBy?: string;
}) {
  await requireRole("ADMIN");

  const item = await prisma.checklistItem.create({
    data: {
      projectId: data.projectId,
      category: data.category.trim() || "Liberação para Execução em Canteiro",
      task: data.task.trim(),
      notes: data.notes?.trim() || null,
      stageId: data.stageId || null,
      deliverableId: data.deliverableId || null,
      isCompleted: false,
    },
  });

  revalidatePath(`/admin/projetos/${data.projectId}`);
  revalidatePath(`/admin/projetos/${data.projectId}/relatorio`);
  revalidatePath(`/portal/${data.projectId}`);

  return { success: true, item };
}

/**
 * 3. updateChecklistNotes(itemId, projectId, notes)
 * Atualiza observações técnicas e recomendações de canteiro.
 */
export async function updateChecklistNotes(
  itemId: string,
  projectId: string,
  notes: string
) {
  await requireRole("ADMIN");

  const existing = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.projectId !== projectId) {
    return notFound("Item de Checklist");
  }

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      notes: notes.trim(),
    },
  });

  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/admin/projetos/${projectId}/relatorio`);
  revalidatePath(`/portal/${projectId}`);

  return { success: true, item: updated };
}

/**
 * 4. deleteChecklistItem(itemId, projectId)
 * Remove um item do checklist com segurança.
 */
export async function deleteChecklistItem(itemId: string, projectId: string) {
  await requireRole("ADMIN");

  const existing = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.projectId !== projectId) {
    return notFound("Item de Checklist");
  }

  await prisma.checklistItem.delete({ where: { id: itemId } });

  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/admin/projetos/${projectId}/relatorio`);
  revalidatePath(`/portal/${projectId}`);

  return { success: true };
}

