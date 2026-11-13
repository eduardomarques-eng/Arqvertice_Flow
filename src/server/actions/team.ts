"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { currentUser, requireRole } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { hash } from "bcryptjs";
import type { UserRole, CommChannel, CommRecipientType } from "@prisma/client";
import { sendTransactionalEmail } from "@/lib/email";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendArqVerticeEmail } from "@/lib/email/resend-service";
import { sendArqVerticeWhatsApp } from "@/lib/whatsapp/whatsapp-service";

export interface UpdateProfileInput {
  userId: string;
  name: string;
  email: string;
  specialty?: string | null;
  whatsapp?: string | null;
  newPassword?: string | null;
}

export interface UpdateGovernanceInput {
  userId: string;
  role: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR";
  isActive: boolean;
  canEdit: boolean;
  projectIds: string[];
  permissions?: string[];
}

export interface CreateProfileInput {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE";
  specialty: string;
  whatsapp: string;
  projectIds?: string[];
  permissions?: string[];
}

export interface DispatchCommunicationInput {
  recipientType: "PROFISSIONAL" | "CLIENTE";
  recipientId?: string | null;
  recipientName: string;
  recipientContact: string; // E-mail ou Telefone
  projectId?: string | null;
  projectName?: string | null;
  channel: "WHATSAPP" | "EMAIL";
  category: "PRAZO_ETAPA" | "RELATORIO_CRONOGRAMA" | "FINANCEIRO" | "ACESSO_SISTEMA" | "AVISO_GERAL";
  subject?: string;
  messageBody: string;
}

/**
 * 1. Atualiza Perfil & Credenciais de um Profissional
 */
export async function updateTeamMemberProfileAction(input: UpdateProfileInput) {
  await requireRole("ADMIN");

  const existing = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!existing) throw new DomainError("Profissional não localizado.", "NOT_FOUND");

  const cleanEmail = input.email.trim().toLowerCase();
  if (cleanEmail !== existing.email.toLowerCase()) {
    const conflict = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (conflict) throw new DomainError("Este e-mail já está em uso por outro membro.", "VALIDATION");
  }

  const updateData: {
    name: string;
    email: string;
    specialty: string | null;
    whatsapp: string | null;
    phone: string | null;
    passwordHash?: string;
    sessionVersion: { increment: number };
    permissionsUpdatedAt: Date;
  } = {
    name: input.name.trim(),
    email: cleanEmail,
    specialty: input.specialty?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    phone: input.whatsapp?.trim() || null,
    sessionVersion: { increment: 1 },
    permissionsUpdatedAt: new Date(),
  };

  if (input.newPassword && input.newPassword.trim().length >= 8) {
    updateData.passwordHash = await hash(input.newPassword.trim(), 12);
  }

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: updateData,
  });

  revalidatePath("/admin/equipe");
  return { success: true, user: { id: updated.id, name: updated.name, email: updated.email } };
}

/**
 * 2. Atualiza Governança (RBAC, Permissões Granulares, Ativo/Inativo e Projetos)
 * Força logout imediato em tempo real via sessionVersion
 */
export async function updateTeamMemberGovernanceAction(input: UpdateGovernanceInput) {
  await requireRole("ADMIN");

  const existing = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!existing) throw new DomainError("Profissional não localizado.", "NOT_FOUND");

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      role: input.role as UserRole,
      isActive: input.isActive,
      permissions: input.permissions ?? existing.permissions,
      sessionVersion: { increment: 1 }, // Força expiração imediata da sessão ativa!
      permissionsUpdatedAt: new Date(),
    },
  });

  // Atualiza acesso aos projetos
  const validProjectIds = [...new Set(input.projectIds)];

  await prisma.$transaction(async (tx) => {
    await tx.projectAccess.deleteMany({ where: { userId: input.userId } });
    if (validProjectIds.length > 0) {
      await tx.projectAccess.createMany({
        data: validProjectIds.map((projectId) => ({
          userId: input.userId,
          projectId,
          canEdit: input.canEdit,
        })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/admin/equipe");
  return { success: true };
}

/**
 * 3. Cria um Novo Perfil Profissional
 */
export async function createTeamMemberAction(input: CreateProfileInput) {
  await requireRole("ADMIN");

  const cleanEmail = input.email.trim().toLowerCase();
  const conflict = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (conflict) throw new DomainError("Já existe um cadastro com este e-mail.", "VALIDATION");

  if (!input.password || input.password.length < 8) {
    throw new DomainError("A senha precisa ter no mínimo 8 caracteres.", "VALIDATION");
  }

  const passwordHash = await hash(input.password, 12);

  const newUser = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: cleanEmail,
      passwordHash,
      role: input.role as UserRole,
      specialty: input.specialty.trim(),
      whatsapp: input.whatsapp.trim(),
      phone: input.whatsapp.trim(),
      permissions: input.permissions ?? ["dashboard", "cronograma", "projetos"],
      isActive: true,
    },
  });

  const allProjects = await prisma.project.findMany({ select: { id: true } });
  const targetProjects = input.projectIds && input.projectIds.length > 0
    ? input.projectIds
    : allProjects.map((p) => p.id);

  if (targetProjects.length > 0) {
    await prisma.projectAccess.createMany({
      data: targetProjects.map((projectId) => ({
        userId: newUser.id,
        projectId,
        canEdit: true,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/equipe");
  return { success: true, id: newUser.id };
}

/**
 * 4. Disparo Unificado de Comunicação Externa (E-mail Resend / WhatsApp Bridge)
 */
export async function dispatchCommunicationAction(input: DispatchCommunicationInput) {
  const admin = await currentUser();
  const adminName = admin?.name || "Administrador ArqVértice";

  let deliveryMethod = "DESCONHECIDO";
  let externalId: string | undefined = undefined;
  let status: "ENVIADO" | "DISPARADO_LINK" | "FALHA" = "ENVIADO";
  let errorMessage: string | undefined = undefined;
  let directLinkUrl: string | undefined = undefined;

  if (input.channel === "EMAIL") {
    const result = await sendArqVerticeEmail({
      to: input.recipientContact.trim(),
      recipientName: input.recipientName,
      category: input.category,
      subject: input.subject || `ArqVértice Flow — Notificação Oficial`,
      messageBody: input.messageBody,
      projectName: input.projectName || undefined,
    });

    deliveryMethod = result.success ? "RESEND_API" : result.fallbackMailto ? "MAILTO_FALLBACK" : "NONE";
    externalId = result.messageId;
    if (!result.success) {
      status = "FALHA";
      errorMessage = result.error;
    }
  } else if (input.channel === "WHATSAPP") {
    const result = await sendArqVerticeWhatsApp({
      phone: input.recipientContact,
      message: input.messageBody,
    });

    deliveryMethod = result.method;
    externalId = result.messageId;
    directLinkUrl = result.fallbackUrl;
    status = result.method === "WHATSAPP_CLI_BRIDGE" ? "ENVIADO" : "DISPARADO_LINK";
  }

  // Registra no banco de dados
  const log = await prisma.communicationLog.create({
    data: {
      recipientType: input.recipientType as CommRecipientType,
      recipientId: input.recipientId || null,
      recipientName: input.recipientName,
      recipientContact: input.recipientContact,
      projectId: input.projectId || null,
      projectName: input.projectName || null,
      channel: input.channel as CommChannel,
      category: input.category,
      subject: input.subject || null,
      messageBody: input.messageBody,
      deliveryMethod,
      externalId,
      status,
      errorMessage,
      sentBy: adminName,
    },
  });

  revalidatePath("/admin/equipe");
  return {
    success: status !== "FALHA",
    logId: log.id,
    deliveryMethod,
    directLinkUrl,
    error: errorMessage,
  };
}

/**
 * 5. Registra log histórico de etapa
 */
export async function recordReminderLogAction(data: {
  stageId: string;
  recipientName: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  channel: "WHATSAPP" | "EMAIL" | "AMBOS";
  triggerType: "PRAZO_PROXIMO" | "ENTREGA_HOJE" | "ATRASADO";
  messageBody: string;
}) {
  const created = await prisma.stageReminderLog.create({
    data: {
      stageId: data.stageId,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone ?? null,
      recipientEmail: data.recipientEmail ?? null,
      channel: data.channel,
      triggerType: data.triggerType,
      messageBody: data.messageBody,
      status: "ENVIADO",
      sentAt: new Date(),
    },
  });

  revalidatePath("/admin/equipe");
  return { success: true, id: created.id };
}
