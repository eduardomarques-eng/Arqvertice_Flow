import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canUserAccessProject, currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  ensureWhatsAppBootstrapForUser,
  getHumanizedDelayMs,
} from "@/lib/whatsapp/multi-session";
import { resolveOfficialGatewayConfig } from "@/lib/whatsapp/gateway-client";
import { buildBucketKey, checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const rate = checkRateLimit(buildBucketKey("wa-send", user.id), {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Limite de envios WhatsApp excedido." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "send" | "convert_to_rfi";
    sessionId?: string;
    toPhone?: string;
    contactName?: string;
    projectId?: string | null;
    documentId?: string | null;
    revisionId?: string | null;
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

    const targetProjectId = body.projectId || conv.projectId || null;
    if (user.role !== "ADMIN" && targetProjectId) {
      const canAccess = await canUserAccessProject(user, targetProjectId);
      if (!canAccess) {
        return NextResponse.json({ error: "Sem permissão neste projeto." }, { status: 403 });
      }
    }

    const targetRevision = body.revisionId
      ? await prisma.acervoRevision.findUnique({
          where: { id: body.revisionId },
          include: { document: { select: { id: true, projectId: true, code: true } } },
        })
      : body.documentId
        ? await prisma.acervoRevision.findFirst({
            where: { documentId: body.documentId },
            orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
            include: { document: { select: { id: true, projectId: true, code: true } } },
          })
        : targetProjectId
          ? await prisma.acervoRevision.findFirst({
              where: {
                document: { projectId: targetProjectId, isArchived: false },
              },
              orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
              include: { document: { select: { id: true, projectId: true, code: true } } },
            })
          : null;

    if (targetRevision && user.role !== "ADMIN") {
      const canAccessRevProj = await canUserAccessProject(user, targetRevision.document.projectId);
      if (!canAccessRevProj) {
        return NextResponse.json(
          { error: "Sem permissão na revisão/documento informado." },
          { status: 403 }
        );
      }
    }

    let createdRfi: { id: string; code: string; documentId: string; revisionId: string } | null = null;
    if (targetRevision) {
      const existingRfiCount = await prisma.acervoRfiMarkup.count({
        where: { documentId: targetRevision.documentId },
      });
      const rfiCode = `RFI-${String(existingRfiCount + 1).padStart(3, "0")}`;
      createdRfi = await prisma.acervoRfiMarkup.create({
        data: {
          code: rfiCode,
          documentId: targetRevision.documentId,
          revisionId: targetRevision.id,
          title: `RFI WhatsApp — ${(conv.contactName || conv.contactPhone).slice(0, 80)}`,
          description: body.text.trim(),
          status: "ABERTA",
          markupType: "PIN",
          createdById: user.id,
        },
        select: { id: true, code: true, documentId: true, revisionId: true },
      });
    }

    await prisma.communicationLog.create({
      data: {
        recipientType: "CLIENTE",
        recipientId: conv.clientId || conv.id,
        recipientName: conv.contactName || conv.contactPhone,
        recipientContact: conv.contactPhone,
        projectId: targetRevision?.document.projectId || targetProjectId,
        channel: "WHATSAPP",
        category: "RFI_OBRA",
        deliveryMethod: "CONVERSAO_WHATSAPP",
        status: "ENVIADO",
        sentBy: user.name,
        messageBody: createdRfi
          ? `[${createdRfi.code} convertido do WhatsApp] ${body.text}`
          : `[RFI convertido do WhatsApp] ${body.text}`,
      },
    });

    revalidatePath("/admin/acervo");
    revalidatePath("/equipe/acervo");
    revalidatePath("/admin/whatsapp");
    revalidatePath("/equipe/whatsapp");

    return NextResponse.json({ ok: true, converted: true, rfi: createdRfi });
  }

  const toPhone = (body.toPhone || "").replace(/\D/g, "");
  const text = (body.text || "").trim();
  if (!toPhone || !text) {
    return NextResponse.json(
      { error: "Informe o telefone de destino e o texto da mensagem." },
      { status: 400 }
    );
  }

  if (body.projectId && user.role !== "ADMIN") {
    const canAccess = await canUserAccessProject(user, body.projectId);
    if (!canAccess) {
      return NextResponse.json({ error: "Sem permissão neste projeto." }, { status: 403 });
    }
  }

  const mySession = await ensureWhatsAppBootstrapForUser(user);
  const senderSession =
    user.role === "ADMIN" && body.sessionId
      ? (await prisma.whatsAppUserSession.findUnique({
          where: { id: body.sessionId },
        })) || mySession
      : mySession;

  const { gatewayUrl, apiKey } = await resolveOfficialGatewayConfig();

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

  if (gatewayUrl && apiKey && senderSession.connectionStatus === "CONNECTED") {
    try {
      const gwRes = await fetch(
        `${gatewayUrl}/sessions/${encodeURIComponent(senderSession.sessionName)}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ to: toPhone, text, delayMs: humanizedDelayMs }),
          signal: AbortSignal.timeout(4000),
          redirect: "error",
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
