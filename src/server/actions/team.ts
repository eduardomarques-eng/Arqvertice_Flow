"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { currentUser, requireRole } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { hash } from "bcryptjs";
import type { UserRole, CommChannel, CommRecipientType } from "@prisma/client";
import { sendTransactionalEmail } from "@/lib/email";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

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
    sessionVersion?: { increment: number };
    permissionsUpdatedAt?: Date;
  } = {
    name: input.name.trim(),
    email: cleanEmail,
    specialty: input.specialty?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    phone: input.whatsapp?.trim() || null,
  };

  if (input.newPassword && input.newPassword.trim().length >= 8) {
    updateData.passwordHash = await hash(input.newPassword.trim(), 12);
    // Força renovação da sessão ao mudar senha
    updateData.sessionVersion = { increment: 1 };
    updateData.permissionsUpdatedAt = new Date();
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
    const result = await sendTransactionalEmail({
      to: input.recipientContact.trim(),
      subject: input.subject || `ArqVértice Flow — Notificação Oficial`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #0f172a; margin-top: 0;">ArqVértice Flow</h2>
          <p style="font-size: 14px; color: #475569;">Olá, <strong>${input.recipientName}</strong>,</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; font-size: 14px; color: #1e293b; margin: 16px 0; white-space: pre-wrap;">
${input.messageBody}
          </div>
          ${input.projectName ? `<p style="font-size: 12px; color: #64748b;">Referente ao empreendimento: <strong>${input.projectName}</strong></p>` : ""}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8;">Notificação oficial emitida pelo Estúdio ArqVértice Flow.</p>
        </div>
      `,
      text: input.messageBody,
    });

    deliveryMethod = result.provider === "resend" ? "RESEND_API" : result.provider === "smtp" ? "SMTP" : "NONE";
    externalId = result.externalId;
    if (!result.ok) {
      status = "FALHA";
      errorMessage = result.error;
    }
  } else if (input.channel === "WHATSAPP") {
    const result = await sendWhatsAppMessage({
      phone: input.recipientContact,
      message: input.messageBody,
    });

    deliveryMethod = result.deliveryMethod;
    externalId = result.externalId;
    directLinkUrl = result.url;
    status = result.deliveryMethod === "WHATSAPP_CLI_BRIDGE" ? "ENVIADO" : "DISPARADO_LINK";
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
