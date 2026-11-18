import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  DEFAULT_EMAIL_DOMAIN,
  ensureEmailBootstrap,
} from "@/lib/email/email-infra";

function isSecretValid(headerSecret: string | null): boolean {
  const expected = process.env.EMAIL_INBOUND_SECRET?.trim();
  if (!expected || !headerSecret) return false;
  const a = Buffer.from(headerSecret.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface InboundPayload {
  from: string;
  fromName?: string;
  to: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  externalThreadId?: string;
  providerId?: string;
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-inbound-secret");
  if (!isSecretValid(secret)) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as InboundPayload | null;
  if (!body?.from || !body?.to) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  await ensureEmailBootstrap();

  const toAddresses = (Array.isArray(body.to) ? body.to : [body.to])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const fromAddress = body.from.trim().toLowerCase();

  let mailbox = await prisma.emailMailbox.findFirst({
    where: { address: { in: toAddresses }, isActive: true },
  });
  if (!mailbox) {
    mailbox = await prisma.emailMailbox.findFirst({
      where: { address: `contato@${DEFAULT_EMAIL_DOMAIN}` },
    });
  }
  if (!mailbox) {
    return NextResponse.json({ error: "Caixa de destino não encontrada." }, { status: 404 });
  }

  // Link automatically to Client & most recent Project
  const client = await prisma.client.findFirst({
    where: { email: { equals: fromAddress, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      projects: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const subject = (body.subject || "(Sem assunto)").trim();
  const textBody = (body.text || "").trim() || "(Mensagem sem conteúdo em texto)";

  let thread = body.externalThreadId
    ? await prisma.emailThread.findFirst({
        where: {
          mailboxId: mailbox.id,
          externalThreadId: body.externalThreadId,
        },
      })
    : null;

  if (!thread) {
    thread = await prisma.emailThread.create({
      data: {
        mailboxId: mailbox.id,
        subject,
        folder: "INBOX",
        isRead: false,
        participantEmail: fromAddress,
        participantName: body.fromName || client?.name || null,
        clientId: client?.id || null,
        projectId: client?.projects?.[0]?.id || null,
        externalThreadId: body.externalThreadId || null,
        snippet: textBody.slice(0, 140),
        lastMessageAt: new Date(),
      },
    });
  } else {
    await prisma.emailThread.update({
      where: { id: thread.id },
      data: {
        folder: "INBOX",
        isRead: false,
        snippet: textBody.slice(0, 140),
        lastMessageAt: new Date(),
      },
    });
  }

  const msg = await prisma.emailMessage.create({
    data: {
      threadId: thread.id,
      direction: "INBOUND",
      fromAddress,
      toAddresses,
      subject,
      bodyText: textBody,
      bodyHtml: body.html || null,
      status: "RECEIVED",
      providerId: body.providerId || null,
      sentAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    threadId: thread.id,
    messageId: msg.id,
    linkedClientId: client?.id || null,
    linkedProjectId: client?.projects?.[0]?.id || null,
  });
}
