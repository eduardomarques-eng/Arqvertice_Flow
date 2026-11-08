"use server";

import { revalidatePath } from "next/cache";
import { updateCorporateUserPermissions } from "@/server/services/gestao-service";

export async function updateCorporateUserPermissionsAction(
  userId: string,
  data: {
    role?: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR";
    isActive?: boolean;
    canEdit?: boolean;
    projectIds?: string[];
  },
) {
  const result = await updateCorporateUserPermissions(userId, data);
  revalidatePath("/admin/gestao");
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/equipe");
  revalidatePath("/operacao");
  return result;
}

