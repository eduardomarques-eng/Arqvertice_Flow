import {
  appUrl,
  briefingLinkEmail,
  briefingSubmittedEmail,
  sendAdminBriefingCompletedAlert,
  sendBriefingInviteEmail,
  sendStageCompletedEmail,
  stageCompletedEmail,
} from "@/lib/email";
import { COMMERCIAL_EVENT, NOTIFICATION_CHANNEL, NOTIFICATION_STATUS, type CommercialEventType } from "@/lib/commercial-events";
import { WhatsAppTemplates, buildWhatsAppLink } from "@/lib/whatsapp";
import { prisma } from "@/server/db";
import { sendEmail } from "@/server/services/email-service";
import { dispatchWhatsAppMessage } from "@/server/services/whatsapp-service";
import { recordNotification } from "@/server/services/notification-service";

const internalEmail = () => process.env.ADMIN_ALERT_EMAIL?.trim() || "eduardo.marques.arq@gmail.com";

async function safeWhatsApp(input: { phone: string; message: string; eventType: CommercialEventType; entityType: string; entityId: string }) {
  try {
    const result = await dispatchWhatsAppMessage(input.phone, input.message);
    await recordNotification({
      type: input.eventType,
      channel: NOTIFICATION_CHANNEL.WHATSAPP,
      status: result.status === "SENT" ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.SKIPPED,
      body: input.message,
      recipient: input.phone,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: { provider: result.provider, deepLink: result.deepLink ?? null, externalId: result.externalId ?? null },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no WhatsApp.";
    await recordNotification({
      type: input.eventType,
      channel: NOTIFICATION_CHANNEL.WHATSAPP,
      status: NOTIFICATION_STATUS.FAILED,
      body: input.message,
      recipient: input.phone,
      error: message,
      entityType: input.entityType,
      entityId: input.entityId,
    }).catch(() => undefined);
    return { provider: "wa.me" as const, status: "SKIPPED" as const, deepLink: undefined, error: message };
  }
}

export async function notifyBriefingLink(projectId: string, token: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, client: { select: { name: true, email: true, phone: true } } },
  });
  if (!project) return { url: null, whatsapp: null };
  const url = `${appUrl()}/briefing/${encodeURIComponent(token)}`;
  const email = briefingLinkEmail({ clientName: project.client.name, projectName: project.name, url });
  if (project.client.email) {
    const result = await sendBriefingInviteEmail({
      to: project.client.email,
      clientName: project.client.name,
      projectName: project.name,
      briefingUrl: url,
    });
    await recordNotification({
      type: COMMERCIAL_EVENT.BRIEFING_SENT,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      status: result.ok ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.FAILED,
      body: email.text,
      subject: email.subject,
      recipient: project.client.email,
      error: result.error,
      entityType: "Briefing",
      entityId: projectId,
    }).catch(() => undefined);
  }
  const message = WhatsAppTemplates.briefingInvite({
    clientName: project.client.name,
    projectName: project.name,
    briefingUrl: url,
  });
  const whatsapp = project.client.phone
    ? await safeWhatsApp({
        phone: project.client.phone,
        message,
        eventType: COMMERCIAL_EVENT.BRIEFING_SENT,
        entityType: "Briefing",
        entityId: projectId,
      })
    : null;
  return { url, whatsapp: whatsapp?.deepLink ?? null };
}

export async function notifyBriefingSubmitted(briefingId: string, projectId: string, clientName: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  if (!project) return;
  const briefing = await prisma.briefing.findUnique({ where: { id: briefingId }, select: { responses: true } });
  const summary = JSON.stringify(briefing?.responses ?? {}, null, 2).slice(0, 4000);
  const email = briefingSubmittedEmail({ clientName, projectName: project.name, summary });
  const result = await sendAdminBriefingCompletedAlert({
    clientName,
    projectName: project.name,
    answersSummary: summary,
  });
  await recordNotification({
    type: COMMERCIAL_EVENT.BRIEFING_SUBMITTED,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    status: result.ok ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.FAILED,
    body: email.text,
    subject: email.subject,
    recipient: internalEmail(),
    error: result.error,
    entityType: "Briefing",
    entityId: briefingId,
  }).catch(() => undefined);
  const adminPhone = process.env.ADMIN_WHATSAPP?.trim();
  if (adminPhone) {
    await safeWhatsApp({
      phone: adminPhone,
      message: WhatsAppTemplates.adminBriefingCompleted({
        clientName,
        projectName: project.name,
        reportUrl: `${appUrl()}/admin/briefing/${projectId}/relatorio`,
      }),
      eventType: COMMERCIAL_EVENT.BRIEFING_SUBMITTED,
      entityType: "Briefing",
      entityId: briefingId,
    });
  }
}

export async function notifyStageCompleted(stageId: string) {
  const stage = await prisma.scheduleStage.findUnique({
    where: { id: stageId },
    select: { id: true, name: true, completion: true, project: { select: { id: true, name: true, client: { select: { name: true, email: true, phone: true } } } } },
  });
  if (!stage) return;
  const input = {
    clientName: stage.project.client.name,
    projectName: stage.project.name,
    stageName: stage.name,
    completion: stage.completion,
  };
  const email = stage.project.client.email ? stageCompletedEmail(input) : null;
  if (email && stage.project.client.email) {
    const result = await sendStageCompletedEmail({
      to: stage.project.client.email,
      clientName: stage.project.client.name,
      stageName: stage.name,
      projectName: stage.project.name,
    });
    await recordNotification({
      type: COMMERCIAL_EVENT.STAGE_COMPLETED,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      status: result.ok ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.FAILED,
      body: email.text,
      subject: email.subject,
      recipient: stage.project.client.email,
      error: result.error,
      entityType: "ScheduleStage",
      entityId: stageId,
    }).catch(() => undefined);
  }
  if (stage.project.client.phone) {
    await safeWhatsApp({
      phone: stage.project.client.phone,
      message: WhatsAppTemplates.stageCompleted({
        clientName: stage.project.client.name,
        stageName: stage.name,
        projectName: stage.project.name,
        portalUrl: `${appUrl()}/portal/${stage.project.id}`,
      }),
      eventType: COMMERCIAL_EVENT.STAGE_COMPLETED,
      entityType: "ScheduleStage",
      entityId: stageId,
    });
  }
  if (internalEmail() !== stage.project.client.email) {
    await sendEmail({
      ...stageCompletedEmail({ ...input, clientName: "Equipe ArqVértice" }),
      to: internalEmail(),
      eventType: COMMERCIAL_EVENT.STAGE_COMPLETED,
      entityType: "ScheduleStage",
      entityId: stageId,
    });
  }
}

export function briefingWhatsAppPreview(phone: string, clientName: string, projectName: string, url: string) {
  return buildWhatsAppLink(phone, `Olá ${clientName}, preparamos o briefing do projeto ${projectName}. Acesse: ${url}`);
}
