import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { shouldIndexInboundMessage } from "@/lib/whatsapp/multi-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isWebhookAuthorized(secretHeader: string | null): boolean {
  const expected = process.env.WA_AKG_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  if (!secretHeader) return false;
  const a = Buffer.from(secretHeader.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!isWebhookAuthorized(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    event?: string;
    data?: Record<string, unknown>;
  };

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
        },
      });
    }
  }

  revalidatePath("/admin/whatsapp");
  revalidatePath("/equipe/whatsapp");

  return NextResponse.json({ ok: true });
}
