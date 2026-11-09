"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";

export type ReminderTriggerType = "PRAZO_PROXIMO" | "ENTREGA_HOJE" | "ATRASADO";
export type ReminderChannel = "WHATSAPP" | "EMAIL" | "AMBOS";

export interface FormatReminderParams {
  recipientName: string;
  stageName: string;
  projectName: string;
  dueDate: string;
  progressPercent: number;
  triggerType: ReminderTriggerType;
}

/**
 * 1. Formata a mensagem padronizada oficial
 */
export async function formatReminderMessage({
  recipientName,
  stageName,
  projectName,
  dueDate,
  progressPercent,
  triggerType,
}: FormatReminderParams): Promise<{ subject: string; body: string }> {
  const cleanName = recipientName.trim() || "Responsável Técnico";

  switch (triggerType) {
    case "PRAZO_PROXIMO":
      return {
        subject: `Lembrete de Prazo: ${stageName} — ${projectName}`,
        body: `Olá, ${cleanName}! Lembramos que a etapa ${stageName} da ${projectName} vence em ${dueDate}. O avanço atual está em ${progressPercent}%.`,
      };
    case "ENTREGA_HOJE":
      return {
        subject: `Entrega Hoje: ${stageName} — ${projectName}`,
        body: `Atenção, ${cleanName}! A entrega da etapa ${stageName} da ${projectName} está programada para hoje (${dueDate}).`,
      };
    case "ATRASADO":
    default:
      return {
        subject: `Aviso de Pendência: ${stageName} — ${projectName}`,
        body: `Aviso de Pendência: A etapa ${stageName} da ${projectName} ultrapassou o prazo previsto em ${dueDate}. Favor atualizar o status no sistema.`,
      };
  }
}

/**
 * 2. Gerador de link direto do WhatsApp (Web & App)
 */
export async function generateWhatsAppLink(phone: string, text: string): Promise<string> {
  const digits = phone.replace(/\D/g, "");
  // Se não tiver código de país, prefixa com 55 (Brasil)
  const formattedPhone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
}

/**
 * 3. Registra disparo ou tentativa de lembrete no banco
 */
export async function logReminderAction(params: {
  stageId: string;
  recipientName: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  channel?: ReminderChannel;
  triggerType: ReminderTriggerType;
  messageBody: string;
  status?: "PENDENTE" | "ENVIADO" | "FALHA";
}) {
  const created = await prisma.stageReminderLog.create({
    data: {
      stageId: params.stageId,
      recipientName: params.recipientName,
      recipientPhone: params.recipientPhone ?? null,
      recipientEmail: params.recipientEmail ?? null,
      channel: params.channel ?? "AMBOS",
      triggerType: params.triggerType,
      messageBody: params.messageBody,
      status: params.status ?? "ENVIADO",
      sentAt: new Date(),
    },
  });

  revalidatePath("/admin/notificacoes");
  return { success: true, logId: created.id };
}

/**
 * 4. Obtém dados operacionais de todas as etapas ativas e lembretes para o Painel
 */
export async function getReminderDashboardData() {
  const now = new Date();
  const stages = await prisma.scheduleStage.findMany({
    where: {
      completion: { lt: 100 },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { name: true } },
        },
      },
      reminders: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: [{ dueDate: "asc" }, { order: "asc" }],
  });

  // Mapeamento com cálculo de urgência
  const stageRows = stages.map((s) => {
    let urgency: "ATRASADO" | "HOJE" | "PROXIMO" | "NO_PRAZO" = "NO_PRAZO";
    let daysDiff = 999;

    if (s.dueDate) {
      const due = new Date(s.dueDate);
      const diffMs = due.getTime() - now.getTime();
      daysDiff = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysDiff < 0) {
        urgency = "ATRASADO";
      } else if (daysDiff === 0) {
        urgency = "HOJE";
      } else if (daysDiff <= 3) {
        urgency = "PROXIMO";
      }
    }

    // Telefone e e-mail padrão do responsável técnico
    const designerName = s.designer?.trim() || "Eduardo Marques";
    let designerPhone = "85999990000";
    let designerEmail = "contato@arqvertice.com.br";

    if (designerName.toLowerCase().includes("luan")) {
      designerPhone = "85988880001";
      designerEmail = "luan.engenharia@arqvertice.com.br";
    } else if (designerName.toLowerCase().includes("erick")) {
      designerPhone = "85988880002";
      designerEmail = "erick.operacoes@arqvertice.com.br";
    }

    return {
      stageId: s.id,
      stageName: s.name,
      discipline: s.discipline || "Geral",
      projectId: s.project.id,
      projectName: s.project.name,
      designerName,
      designerPhone,
      designerEmail,
      dueDate: s.dueDate ? new Date(s.dueDate).toLocaleDateString("pt-BR") : "—",
      dueDateRaw: s.dueDate,
      completion: s.completion,
      status: s.status,
      urgency,
      daysDiff,
      recentReminders: s.reminders.map((r) => ({
        id: r.id,
        triggerType: r.triggerType,
        channel: r.channel,
        sentAt: r.sentAt ? new Date(r.sentAt).toLocaleString("pt-BR") : "—",
        status: r.status,
      })),
    };
  });

  // Histórico recente geral de disparos
  const recentLogs = await prisma.stageReminderLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      stage: {
        select: {
          name: true,
          project: { select: { name: true } },
        },
      },
    },
  });

  return {
    stageRows,
    recentLogs: recentLogs.map((log) => ({
      id: log.id,
      stageName: log.stage.name,
      projectName: log.stage.project.name,
      recipientName: log.recipientName,
      recipientPhone: log.recipientPhone,
      recipientEmail: log.recipientEmail,
      channel: log.channel,
      triggerType: log.triggerType,
      messageBody: log.messageBody,
      sentAt: log.sentAt ? new Date(log.sentAt).toLocaleString("pt-BR") : "—",
      status: log.status,
    })),
  };
}

/**
 * 5. Disparo em lote de lembretes para todas as etapas a vencer na semana ou atrasadas
 */
export async function sendBatchRemindersAction() {
  const data = await getReminderDashboardData();
  const candidates = data.stageRows.filter(
    (s) => s.urgency === "ATRASADO" || s.urgency === "HOJE" || s.urgency === "PROXIMO"
  );

  let successCount = 0;

  for (const s of candidates) {
    const triggerType: ReminderTriggerType =
      s.urgency === "ATRASADO" ? "ATRASADO" : s.urgency === "HOJE" ? "ENTREGA_HOJE" : "PRAZO_PROXIMO";

    const { body } = await formatReminderMessage({
      recipientName: s.designerName,
      stageName: s.stageName,
      projectName: s.projectName,
      dueDate: s.dueDate,
      progressPercent: s.completion,
      triggerType,
    });

    await prisma.stageReminderLog.create({
      data: {
        stageId: s.stageId,
        recipientName: s.designerName,
        recipientPhone: s.designerPhone,
        recipientEmail: s.designerEmail,
        channel: "AMBOS",
        triggerType,
        messageBody: body,
        status: "ENVIADO",
        sentAt: new Date(),
      },
    });

    successCount++;
  }

  revalidatePath("/admin/notificacoes");
  return { success: true, count: successCount };
}

