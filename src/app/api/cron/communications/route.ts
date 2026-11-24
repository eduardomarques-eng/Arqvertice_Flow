import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { sendTransactionalEmail, escapeHtml } from "@/lib/email";
import { sendEmailViaResendApi } from "@/lib/email/email-infra";
import { buildArqVerticeEmailTemplate } from "@/lib/email/resend-service";
import { sendEmail } from "@/server/services/email-service";
import {
  resolveOfficialGatewayConfig,
  sendViaOfficialGateway,
} from "@/lib/whatsapp/gateway-client";
import { getStudioLegalProfile } from "@/server/services/settings-service";
import { formatCurrencyBRL } from "@/lib/contract-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim() || "";
  if (cronSecret.length < 16) return false;
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(cronSecret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Drena filas de comunicação pendentes e executa a régua automática de cobrança:
 * - Mensagens WhatsApp `QUEUED` via `wa-akg-service`
 * - E-mails `SCHEDULED` (vencidos) e `PENDING_UNDO` (janela de desfazimento vencida)
 * - Régua de cobrança (`ProjectInstallment` vencida ou vencendo em até 3 dias)
 */
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado. Credenciais de CRON inválidas." },
      { status: 401 }
    );
  }

  const now = new Date();
  const summary = {
    whatsappSent: 0,
    whatsappSkipped: 0,
    emailsSent: 0,
    emailsFailed: 0,
    billingEmailsSent: 0,
    billingWhatsAppSent: 0,
  };

  // 1. Drenagem da fila QUEUED do WhatsApp
  const queuedWa = await prisma.whatsAppMessage.findMany({
    where: { direction: "OUTBOUND", status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 25,
    include: {
      conversation: {
        select: {
          contactPhone: true,
          session: { select: { sessionName: true, connectionStatus: true } },
        },
      },
    },
  });

  for (const msg of queuedWa) {
    const phone = msg.conversation?.contactPhone;
    if (!phone) {
      summary.whatsappSkipped += 1;
      continue;
    }
    const res = await sendViaOfficialGateway({
      phone,
      message: msg.bodyText,
      sessionName:
        msg.conversation?.session?.connectionStatus === "CONNECTED"
          ? msg.conversation.session.sessionName
          : undefined,
    });
    if (res.ok && res.method === "WA_AKG_GATEWAY") {
      await prisma.whatsAppMessage.update({
        where: { id: msg.id },
        data: { status: "SENT", providerMsgId: res.messageId || null },
      });
      summary.whatsappSent += 1;
    } else {
      summary.whatsappSkipped += 1;
    }
  }

  // 2. Drenagem de e-mails SCHEDULED e PENDING_UNDO vencidos
  const dueEmails = await prisma.emailMessage.findMany({
    where: {
      direction: "OUTBOUND",
      OR: [
        { status: "SCHEDULED", scheduledFor: { lte: now } },
        { status: "PENDING_UNDO", cancelDeadlineAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 25,
    include: { thread: { select: { id: true } } },
  });

  for (const em of dueEmails) {
    try {
      let providerId: string | undefined;
      if (process.env.RESEND_API_KEY?.trim()) {
        const sent = await sendEmailViaResendApi({
          from: `ArqVértice <${em.fromAddress}>`,
          to: em.toAddresses,
          cc: em.ccAddresses,
          subject: em.subject,
          text: em.bodyText,
          html: em.bodyHtml,
        });
        providerId = sent.id;
      } else {
        const tx = await sendTransactionalEmail({
          to: em.toAddresses.join(", "),
          subject: em.subject,
          text: em.bodyText,
          html: em.bodyHtml || `<pre>${escapeHtml(em.bodyText)}</pre>`,
        });
        if (!tx.ok) throw new Error(tx.error || "Falha ao enviar e-mail agendado.");
        providerId = tx.externalId;
      }

      await prisma.emailMessage.update({
        where: { id: em.id },
        data: { status: "SENT", sentAt: new Date(), providerId: providerId || null },
      });
      await prisma.emailThread.update({
        where: { id: em.threadId },
        data: { folder: "SENT", lastMessageAt: new Date() },
      });
      summary.emailsSent += 1;
    } catch {
      await prisma.emailMessage.update({
        where: { id: em.id },
        data: { status: "FAILED" },
      });
      summary.emailsFailed += 1;
    }
  }

  // 3. Régua de Cobrança Automática (ProjectInstallment vencendo em até 3 dias ou OVERDUE)
  const dueHorizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const recentCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const [installmentsDue, gwConfig, legal] = await Promise.all([
    prisma.projectInstallment.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { lte: dueHorizon },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
      take: 30,
    }),
    resolveOfficialGatewayConfig(),
    getStudioLegalProfile(),
  ]);

  for (const inst of installmentsDue) {
    const client = inst.project.client;
    if (!client) continue;

    const alreadyNotified = await prisma.notificationEvent.findFirst({
      where: {
        entityType: "ProjectInstallment",
        entityId: inst.id,
        occurredAt: { gte: recentCutoff },
      },
      select: { id: true },
    });
    if (alreadyNotified) continue;

    const dueStr = new Date(inst.dueDate).toLocaleDateString("pt-BR");
    const amountStr = formatCurrencyBRL(Number(inst.amount ?? 0));
    const isOverdue = inst.status === "OVERDUE" || new Date(inst.dueDate) < now;
    const statusLabel = isOverdue ? "em aberto / vencida" : "com vencimento próximo";

    const messageText = [
      `Olá, ${client.name}!`,
      "",
      `Identificamos uma parcela ${statusLabel} do projeto ${inst.project.name}:`,
      `• Descrição: ${inst.description}`,
      `• Valor: ${amountStr}`,
      `• Vencimento: ${dueStr}`,
      `• Chave Pix Oficial (${legal.pixKeyType}): ${legal.pixKey}`,
      `• Beneficiário: ${legal.studioName} (CNPJ ${legal.studioCnpj})`,
      "",
      "Após o pagamento, envie o comprovante pelo Portal do Cliente ou responda este contato.",
    ].join("\n");

    if (client.email) {
      const html = buildArqVerticeEmailTemplate({
        recipientName: client.name,
        category: isOverdue ? "Cobrança em Aberto" : "Lembrete de Vencimento",
        projectName: inst.project.name,
        messageBody: messageText,
      });
      const sent = await sendEmail({
        to: client.email,
        subject: `${isOverdue ? "Parcela vencida" : "Lembrete financeiro"} — ${inst.project.name}`,
        text: messageText,
        html,
        eventType: "message.sent",
        entityType: "ProjectInstallment",
        entityId: inst.id,
      });
      if (sent.ok) summary.billingEmailsSent += 1;
    }

    if (gwConfig.autoNotifyFinance && client.phone) {
      const wa = await sendViaOfficialGateway({
        phone: client.phone,
        message: messageText,
      });
      if (wa.ok) summary.billingWhatsAppSent += 1;
      await prisma.communicationLog.create({
        data: {
          recipientType: "CLIENTE",
          recipientId: client.id,
          recipientName: client.name,
          recipientContact: client.phone,
          projectId: inst.project.id,
          projectName: inst.project.name,
          channel: "WHATSAPP",
          category: "FINANCEIRO",
          deliveryMethod: wa.method,
          externalId: wa.messageId || null,
          status: wa.ok ? "ENVIADO" : "DISPARADO_LINK",
          messageBody: messageText,
          sentBy: "Sistema (Régua Automática)",
        },
      });
      if (!client.email) {
        await prisma.notificationEvent
          .create({
            data: {
              type: "message.sent",
              channel: "WHATSAPP",
              status: wa.ok ? "SENT" : "RECORDED",
              body: messageText,
              recipient: client.phone,
              entityType: "ProjectInstallment",
              entityId: inst.id,
            },
          })
          .catch(() => undefined);
      }
    }
  }

  return NextResponse.json({ ok: true, timestamp: now.toISOString(), summary });
}
