import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { shouldIndexInboundMessage } from "@/lib/whatsapp/multi-session";
import { verifyWhatsAppWebhookAuth } from "@/lib/whatsapp/gateway-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const rawBody = await req.text().catch(() => "");
  let body: {
    sessionId?: string;
    event?: string;
    data?: Record<string, unknown>;
    timestamp?: string;
  } = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as typeof body) : {};
  } catch {
    body = {};
  }

  const authCheck = verifyWhatsAppWebhookAuth({
    rawBody,
    headers: req.headers,
    parsedTimestamp: typeof body.timestamp === "string" ? body.timestamp : null,
  });
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error || "Webhook não autorizado." }, { status: 401 });
  }

  if (!body.sessionId || !body.event) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const session = await prisma.whatsAppUserSession.findUnique({
    where: { sessionName: body.sessionId },
  });
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }

  const data = body.data || {};

  if (body.event === "qr") {
    await prisma.whatsAppUserSession.update({
      where: { id: session.id },
      data: {
        connectionStatus: "QR_READY",
        qrCodeDataUrl: typeof data.qrCodeDataUrl === "string" ? data.qrCodeDataUrl : null,
      },
    });
  } else if (body.event === "pairing_code") {
    await prisma.whatsAppUserSession.update({
      where: { id: session.id },
      data: {
        connectionStatus: "QR_READY",
        pairingCode: typeof data.pairingCode === "string" ? data.pairingCode : null,
      },
    });
  } else if (body.event === "connected") {
    await prisma.whatsAppUserSession.update({
      where: { id: session.id },
      data: {
        connectionStatus: "CONNECTED",
        qrCodeDataUrl: null,
        pairingCode: null,
        connectedPhone:
          typeof data.connectedPhone === "string" ? data.connectedPhone : session.connectedPhone,
        lastConnectedAt: new Date(),
      },
    });
  } else if (body.event === "disconnected") {
    await prisma.whatsAppUserSession.update({
      where: { id: session.id },
      data: {
        connectionStatus: "DISCONNECTED",
        qrCodeDataUrl: null,
        pairingCode: null,
      },
    });
  } else if (body.event === "message.upsert") {
    const remoteJid = String(data.remoteJid || "");
    const text = String(data.text || "").trim();
    const digits = remoteJid.replace(/@.*/, "").replace(/\D/g, "");
    if (remoteJid && text) {
      const client =
        digits.length >= 8
          ? await prisma.client.findFirst({
            where: { phone: { contains: digits.slice(-8) } },
            select: {
              id: true,
              name: true,
              projects: {
                orderBy: { updatedAt: "desc" },
                take: 1,
                select: { id: true },
              },
            },
          })
          : null;

      if (
        !shouldIndexInboundMessage({
          onlyKnownContacts: session.onlyKnownContacts,
          remoteJid,
          matchedClientId: client?.id || null,
        })
      ) {
        return NextResponse.json({ ok: true, filteredByPrivacy: true });
      }

      const conv = await prisma.whatsAppConversation.upsert({
        where: {
          sessionId_remoteJid: { sessionId: session.id, remoteJid },
        },
        update: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
        create: {
          sessionId: session.id,
          ownerUserId: session.userId,
          remoteJid,
          contactPhone: digits,
          contactName:
            client?.name ||
            (typeof data.pushName === "string" ? data.pushName : digits),
          clientId: client?.id || null,
          projectId: client?.projects?.[0]?.id || null,
          unreadCount: 1,
          lastMessageAt: new Date(),
        },
      });

      await prisma.whatsAppMessage.create({
        data: {
          conversationId: conv.id,
          direction: "INBOUND",
          bodyText: text,
          status: "RECEIVED",
          providerMsgId:
            typeof data.messageId === "string" ? data.messageId : null,
          aiIntent: typeof data.aiIntent === "string" ? data.aiIntent : null,
          aiSuggestedReply:
            typeof data.aiSuggestedReply === "string" ? data.aiSuggestedReply : null,
          aiModel: typeof data.aiModel === "string" ? data.aiModel : null,
        },
      });
    }
  }

  revalidatePath("/admin/whatsapp");
  revalidatePath("/equipe/whatsapp");

  return NextResponse.json({ ok: true });
}
