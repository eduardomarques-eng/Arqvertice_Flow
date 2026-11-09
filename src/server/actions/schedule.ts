"use server";

import { revalidatePath } from "next/cache";
import {
  toggleScheduleStageVisibility,
  updateScheduleStage,
  createScheduleStage,
  deleteScheduleStage,
} from "@/server/services/schedule-service";

export async function toggleStageVisibilityAction(
  stageId: string,
  isVisibleInKanban: boolean,
  projectId: string,
) {
  try {
    const updated = await toggleScheduleStageVisibility(stageId, isVisibleInKanban);
    revalidatePath(`/admin/projetos/${projectId}`);
    revalidatePath(`/admin/projetos/${projectId}/cronograma`);
    revalidatePath("/admin/projetos");
    revalidatePath("/operacao");
    return { ok: true, stage: updated };
  } catch (error) {
    console.error("[schedule action] Erro ao alternar visibilidade:", error);
    throw error;
  }
}

export async function updateStageProgressAction(
  stageId: string,
  completion: number,
  projectId: string,
) {
  try {
    const updated = await updateScheduleStage(stageId, { completion });
    revalidatePath(`/admin/projetos/${projectId}`);
    revalidatePath(`/admin/projetos/${projectId}/cronograma`);
    revalidatePath("/admin/projetos");
    revalidatePath("/operacao");
    return { ok: true, stage: updated };
  } catch (error) {
    console.error("[schedule action] Erro ao atualizar avanço:", error);
    throw error;
  }
}

export async function saveScheduleStageAction(input: unknown) {
  try {
    const stage = await createScheduleStage(input);
    if (typeof input === "object" && input !== null && "projectId" in input && typeof input.projectId === "string") {
      revalidatePath(`/admin/projetos/${input.projectId}`);
      revalidatePath(`/admin/projetos/${input.projectId}/cronograma`);
    }
    revalidatePath("/admin/projetos");
    revalidatePath("/operacao");
    return stage;
  } catch (error) {
    console.error("[schedule action] Erro ao salvar etapa:", error);
    throw error;
  }
}

export async function editScheduleStageAction(id: string, input: unknown, projectId?: string) {
  try {
    const stage = await updateScheduleStage(id, input);
    if (projectId) {
      revalidatePath(`/admin/projetos/${projectId}`);
      revalidatePath(`/admin/projetos/${projectId}/cronograma`);
    }
    revalidatePath("/admin/projetos");
    revalidatePath("/operacao");
    return stage;
  } catch (error) {
    console.error("[schedule action] Erro ao editar etapa:", error);
    throw error;
  }
}

export async function deleteScheduleStageAction(id: string, projectId?: string) {
  try {
    const stage = await deleteScheduleStage(id);
    if (projectId) {
      revalidatePath(`/admin/projetos/${projectId}`);
      revalidatePath(`/admin/projetos/${projectId}/cronograma`);
    }
    revalidatePath("/admin/projetos");
    revalidatePath("/operacao");
    return stage;
  } catch (error) {
    console.error("[schedule action] Erro ao excluir etapa:", error);
    throw error;
  }
}

