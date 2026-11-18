import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  getAccessibleMailboxes,
  sendEmailViaResendApi,
} from "@/lib/email/email-infra";

interface SendEmailPayload {
  action?: "queue" | "dispatch";
  messageId?: string;
  mailboxId?: string;
  threadId?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  scheduledFor?: string | null;
  undoWindowSeconds?: number;
  clientId?: string | null;
  projectId?: string | null;
  attachmentsMeta?: Array<{
    name: string;
    kind: "PROPOSTA" | "GRD" | "PIX" | "EML";
    refId?: string;
  }>;
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SendEmailPayload;
  const accessible = await getAccessibleMailboxes(user);

  // Action: dispatch a previously queued message after 30s undo window elapsed
  if (body.action === "dispatch" && body.messageId) {
    const msg = await prisma.emailMessage.findUnique({
      where: { id: body.messageId },
      include: { thread: true },
    });
    if (!msg) {
      return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
    }
    const allowed = accessible.some((m) => m.id === msg.thread.mailboxId);
    if (!allowed) {
      return NextResponse.json({ error: "Sem permissão nesta caixa." }, { status: 403 });
    }
    if (msg.status === "CANCELLED") {
      return NextResponse.json({ ok: true, status: "CANCELLED", skipped: true });
    }
    if (msg.status === "SENT") {
      return NextResponse.json({ ok: true, status: "SENT", providerId: msg.providerId });
    }

    try {
      const sent = await sendEmailViaResendApi({
        from: `ArqVértice <${msg.fromAddress}>`,
        to: msg.toAddresses,
        cc: msg.ccAddresses,
        subject: msg.subject,
        text: msg.bodyText,
        html: msg.bodyHtml,
      });

      const updated = await prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId: sent.id,
        },
      });
      await prisma.emailThread.update({
        where: { id: msg.threadId },
        data: { folder: "SENT", lastMessageAt: new Date(), isRead: true },
      });

      return NextResponse.json({
        ok: true,
        status: updated.status,
        messageId: updated.id,
        providerId: sent.id,
      });
    } catch (err) {
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erro ao enviar via Resend." },
        { status: 502 }
      );
    }
  }

  // Action: queue (with 30s undo window) or schedule or immediate send
  const mailbox =
    accessible.find((m) => m.id === body.mailboxId) || accessible[0];
  if (!mailbox) {
    return NextResponse.json(
      { error: "Nenhuma caixa de e-mail autorizada para este usuário." },
      { status: 403 }
    );
  }

  const toList = (body.to || []).map((e) => e.trim()).filter(Boolean);
  if (toList.length === 0 || !body.subject?.trim() || !body.bodyText?.trim()) {
    return NextResponse.json(
      { error: "Informe destinatário, assunto e corpo do e-mail." },
      { status: 400 }
    );
  }

  const ccList = (body.cc || []).map((e) => e.trim()).filter(Boolean);
  const scheduledDate = body.scheduledFor ? new Date(body.scheduledFor) : null;
  const isScheduled =
    scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate > new Date();

  const undoSeconds =
    typeof body.undoWindowSeconds === "number" ? Math.max(0, body.undoWindowSeconds) : 30;
  const cancelDeadlineAt =
    !isScheduled && undoSeconds > 0
      ? new Date(Date.now() + undoSeconds * 1000)
      : null;

  // Resolve client link automatically if not provided
  let resolvedClientId = body.clientId || null;
  if (!resolvedClientId && toList[0]) {
    const matchedClient = await prisma.client.findFirst({
      where: { email: { equals: toList[0], mode: "insensitive" } },
      select: { id: true },
    });
    resolvedClientId = matchedClient?.id || null;
  }

  const thread = body.threadId
    ? await prisma.emailThread.findUnique({ where: { id: body.threadId } })
    : null;

  const activeThread =
    thread ||
    (await prisma.emailThread.create({
      data: {
        mailboxId: mailbox.id,
        subject: body.subject.trim(),
        folder: isScheduled ? "SCHEDULED" : "SENT",
        isRead: true,
        participantEmail: toList[0],
        clientId: resolvedClientId,
        projectId: body.projectId || null,
        snippet: body.bodyText.slice(0, 140),
        lastMessageAt: new Date(),
      },
    }));

  const initialStatus = isScheduled
    ? "SCHEDULED"
    : undoSeconds > 0
      ? "PENDING_UNDO"
      : "SENT";

  const createdMsg = await prisma.emailMessage.create({
    data: {
      threadId: activeThread.id,
      direction: "OUTBOUND",
      fromAddress: mailbox.address,
      toAddresses: toList,
      ccAddresses: ccList,
      subject: body.subject.trim(),
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml || null,
      status: initialStatus,
      cancelDeadlineAt,
      scheduledFor: isScheduled ? scheduledDate : null,
      attachmentsMeta: body.attachmentsMeta || undefined,
      createdById: user.id,
    },
  });

  if (initialStatus === "SENT") {
    try {
      const sent = await sendEmailViaResendApi({
        from: `ArqVértice <${mailbox.address}>`,
        to: toList,
        cc: ccList,
        subject: body.subject.trim(),
        text: body.bodyText,
        html: body.bodyHtml,
      });
      await prisma.emailMessage.update({
        where: { id: createdMsg.id },
        data: { sentAt: new Date(), providerId: sent.id },
      });
    } catch (err) {
      await prisma.emailMessage.update({
        where: { id: createdMsg.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erro ao enviar e-mail." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    messageId: createdMsg.id,
    threadId: activeThread.id,
    status: initialStatus,
    cancelDeadlineAt: cancelDeadlineAt?.toISOString() || null,
  });
}
