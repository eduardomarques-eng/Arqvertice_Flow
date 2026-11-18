import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  ensureWhatsAppBootstrapForUser,
  getHumanizedDelayMs,
} from "@/lib/whatsapp/multi-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "send" | "convert_to_rfi";
    sessionId?: string;
    toPhone?: string;
    contactName?: string;
    projectId?: string | null;
    clientId?: string | null;
    text?: string;
    conversationId?: string;
    messageId?: string;
  };

  if (body.action === "convert_to_rfi" && body.conversationId && body.text) {
    const conv = await prisma.whatsAppConversation.findUnique({
      where: { id: body.conversationId },
    });
    if (!conv) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }
    if (user.role !== "ADMIN" && conv.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Sem permissão nesta conversa." }, { status: 403 });
    }

    // Also log communication/audit entry for project traceability
    await prisma.communicationLog.create({
      data: {
        recipientType: "CLIENTE",
        recipientId: conv.clientId || conv.id,
        recipientName: conv.contactName || conv.contactPhone,
        recipientContact: conv.contactPhone,
        projectId: conv.projectId,
        channel: "WHATSAPP",
        category: "RFI_OBRA",
        deliveryMethod: "CONVERSAO_WHATSAPP",
        status: "ENVIADO",
        sentBy: user.name,
        messageBody: `[RFI convertido do WhatsApp] ${body.text}`,
      },
    });

    return NextResponse.json({ ok: true, converted: true });
  }

  const toPhone = (body.toPhone || "").replace(/\D/g, "");
  const text = (body.text || "").trim();
  if (!toPhone || !text) {
    return NextResponse.json(
      { error: "Informe o telefone de destino e o texto da mensagem." },
      { status: 400 }
    );
  }

  const mySession = await ensureWhatsAppBootstrapForUser(user);
  const senderSession =
    user.role === "ADMIN" && body.sessionId
      ? (await prisma.whatsAppUserSession.findUnique({
          where: { id: body.sessionId },
        })) || mySession
      : mySession;

  const gateway = await prisma.whatsAppGatewayConfig.findUnique({
    where: { id: "default" },
  });
  const gatewayUrl = gateway?.gatewayUrl?.replace(/\/$/, "");
  const apiKey = process.env.WA_AKG_API_KEY?.trim() || "";

  const remoteJid = `${toPhone}@s.whatsapp.net`;
  const matchedClient =
    !body.clientId
      ? await prisma.client.findFirst({
          where: { phone: { contains: toPhone.slice(-8) } },
          select: { id: true, name: true },
        })
      : null;

  const conversation = await prisma.whatsAppConversation.upsert({
    where: {
      sessionId_remoteJid: {
        sessionId: senderSession.id,
        remoteJid,
      },
    },
    update: {
      lastMessageAt: new Date(),
      ...(body.projectId ? { projectId: body.projectId } : {}),
    },
    create: {
      sessionId: senderSession.id,
      ownerUserId: senderSession.userId,
      remoteJid,
      contactPhone: toPhone,
      contactName: body.contactName || matchedClient?.name || toPhone,
      clientId: body.clientId || matchedClient?.id || null,
      projectId: body.projectId || null,
      lastMessageAt: new Date(),
    },
  });

  let status = "QUEUED";
  let providerMsgId: string | null = null;
  const humanizedDelayMs = getHumanizedDelayMs();

  if (gatewayUrl && senderSession.connectionStatus === "CONNECTED") {
    try {
      const gwRes = await fetch(
        `${gatewayUrl}/sessions/${encodeURIComponent(senderSession.sessionName)}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "x-api-key": apiKey } : {}),
          },
          body: JSON.stringify({ to: toPhone, text, delayMs: humanizedDelayMs }),
        }
      );
      if (gwRes.ok) {
        const gwJson = (await gwRes.json()) as { messageId?: string | null };
        status = "SENT";
        providerMsgId = gwJson.messageId || null;
      }
    } catch {
      status = "QUEUED";
    }
  }

  const message = await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      bodyText: text,
      status,
      providerMsgId,
    },
  });

  revalidatePath("/admin/whatsapp");
  revalidatePath("/equipe/whatsapp");

  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    message,
    humanizedDelayMs,
  });
}
