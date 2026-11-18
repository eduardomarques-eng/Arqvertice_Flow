import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  DEFAULT_EMAIL_DOMAIN,
  getAccessibleMailboxes,
} from "@/lib/email/email-infra";

function parseSimpleEml(rawEml: string) {
  const normalized = rawEml.replace(/\r\n/g, "\n");
  const splitIdx = normalized.indexOf("\n\n");
  const headerBlock = splitIdx === -1 ? normalized : normalized.slice(0, splitIdx);
  const bodyBlock = splitIdx === -1 ? "" : normalized.slice(splitIdx + 2);

  const getHeader = (name: string) => {
    const regex = new RegExp(`^${name}:\\s*(.+)$`, "im");
    const match = headerBlock.match(regex);
    return match ? match[1].trim() : "";
  };

  const fromRaw = getHeader("From");
  const toRaw = getHeader("To");
  const subject = getHeader("Subject") || "(E-mail importado .eml)";
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const fromEmail =
    (fromRaw.match(emailRegex)?.[0] || fromRaw || "externo@cliente.com").toLowerCase();
  const toEmail =
    (toRaw.match(emailRegex)?.[0] || `contato@${DEFAULT_EMAIL_DOMAIN}`).toLowerCase();

  return {
    fromEmail,
    toEmail,
    subject,
    bodyText: bodyBlock.trim() || "(Corpo vazio)",
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const mailboxes = await getAccessibleMailboxes(user);
  const mailboxIds = mailboxes.map((m) => m.id);

  const threads = await prisma.emailThread.findMany({
    where: { mailboxId: { in: mailboxIds } },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      mailbox: { select: { id: true, address: true, displayName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({ mailboxes, threads });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "update_thread" | "import_eml" | "sync_mailflare";
    threadId?: string;
    mailboxId?: string;
    isRead?: boolean;
    isStarred?: boolean;
    folder?: string;
    snoozedUntil?: string | null;
    clientId?: string | null;
    projectId?: string | null;
    rawEml?: string;
  };

  const accessible = await getAccessibleMailboxes(user);

  if (body.action === "update_thread" && body.threadId) {
    const existing = await prisma.emailThread.findUnique({
      where: { id: body.threadId },
    });
    if (!existing || !accessible.some((m) => m.id === existing.mailboxId)) {
      return NextResponse.json({ error: "Thread não encontrada ou sem acesso." }, { status: 404 });
    }

    const updated = await prisma.emailThread.update({
      where: { id: existing.id },
      data: {
        ...(typeof body.isRead === "boolean" ? { isRead: body.isRead } : {}),
        ...(typeof body.isStarred === "boolean" ? { isStarred: body.isStarred } : {}),
        ...(body.folder ? { folder: body.folder } : {}),
        ...(body.snoozedUntil !== undefined
          ? { snoozedUntil: body.snoozedUntil ? new Date(body.snoozedUntil) : null }
          : {}),
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
      },
    });
    return NextResponse.json({ ok: true, thread: updated });
  }

  if (body.action === "import_eml" && body.rawEml) {
    const parsed = parseSimpleEml(body.rawEml);
    const targetMailbox =
      accessible.find((m) => m.id === body.mailboxId) ||
      accessible.find((m) => m.address === parsed.toEmail) ||
      accessible[0];

    if (!targetMailbox) {
      return NextResponse.json({ error: "Nenhuma caixa disponível." }, { status: 403 });
    }

    const client = await prisma.client.findFirst({
      where: { email: { equals: parsed.fromEmail, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    const thread = await prisma.emailThread.create({
      data: {
        mailboxId: targetMailbox.id,
        subject: parsed.subject,
        folder: "INBOX",
        isRead: false,
        participantEmail: parsed.fromEmail,
        participantName: client?.name || null,
        clientId: client?.id || null,
        snippet: parsed.bodyText.slice(0, 140),
        lastMessageAt: new Date(),
      },
    });

    await prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        direction: "INBOUND",
        fromAddress: parsed.fromEmail,
        toAddresses: [targetMailbox.address],
        subject: parsed.subject,
        bodyText: parsed.bodyText,
        status: "RECEIVED",
        attachmentsMeta: [{ name: "importado.eml", kind: "EML" }],
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, threadId: thread.id });
  }

  if (body.action === "sync_mailflare") {
    const config = await prisma.emailDomainConfig.findUnique({
      where: { id: "default" },
    });
    if (!config?.mailflareWorkerUrl) {
      return NextResponse.json({
        ok: false,
        message: "URL do Worker Mailflare ainda não configurada.",
      });
    }
    try {
      const ping = await fetch(config.mailflareWorkerUrl, { method: "HEAD" });
      return NextResponse.json({
        ok: ping.status < 500,
        status: ping.status,
        workerUrl: config.mailflareWorkerUrl,
        mcpUrl: config.mailflareMcpUrl,
      });
    } catch (err) {
      return NextResponse.json({
        ok: false,
        message: err instanceof Error ? err.message : "Falha ao contatar Mailflare.",
      });
    }
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
