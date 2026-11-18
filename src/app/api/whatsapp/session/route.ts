import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  ensureWhatsAppBootstrapForUser,
  generateSessionQrDataUrl,
} from "@/lib/whatsapp/multi-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function isValidGatewayKey(req: Request): boolean {
  const provided =
    req.headers.get("x-api-key") || req.headers.get("x-webhook-secret") || "";
  const expected =
    process.env.WA_AKG_API_KEY?.trim() ||
    process.env.WA_AKG_WEBHOOK_SECRET?.trim() ||
    "";
  if (!provided || !expected) return false;
  const a = Buffer.from(provided.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function probeLocalGatewayHealth(gatewayUrl: string | null | undefined) {
  if (!gatewayUrl) {
    return { online: false, mode: "local-windows", ollamaOnline: false, ollamaModel: null as string | null };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${gatewayUrl.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { online: false, mode: "local-windows", ollamaOnline: false, ollamaModel: null as string | null };
    }
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      mode?: string;
      ollamaOnline?: boolean;
      ollamaModel?: string | null;
    };
    return {
      online: Boolean(data.ok),
      mode: data.mode || "local-windows",
      ollamaOnline: Boolean(data.ollamaOnline),
      ollamaModel: data.ollamaModel || null,
    };
  } catch {
    return { online: false, mode: "local-windows", ollamaOnline: false, ollamaModel: null as string | null };
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const mySession = await ensureWhatsAppBootstrapForUser(user);
  const [gatewayConfig, teamSessions, conversations] = await Promise.all([
    prisma.whatsAppGatewayConfig.findUnique({ where: { id: "default" } }),
    prisma.whatsAppUserSession.findMany({
      orderBy: [{ isStudioOfficial: "desc" }, { userName: "asc" }],
      select: {
        id: true,
        userId: true,
        userName: true,
        userRole: true,
        sessionName: true,
        isStudioOfficial: true,
        connectionStatus: true,
        connectedPhone: true,
        onlyKnownContacts: true,
        lastConnectedAt: true,
        updatedAt: true,
      },
    }),
    prisma.whatsAppConversation.findMany({
      where:
        user.role === "ADMIN"
          ? {}
          : { ownerUserId: user.id },
      orderBy: { lastMessageAt: "desc" },
      take: 60,
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    }),
  ]);

  const gatewayHealth = await probeLocalGatewayHealth(gatewayConfig?.gatewayUrl);

  return NextResponse.json(
    {
      mySession,
      teamSessions,
      gatewayConfig,
      gatewayHealth,
      conversations,
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: "start" | "logout" | "toggle_privacy" | "update_gateway";
    targetUserId?: string;
    phoneNumber?: string;
    onlyKnownContacts?: boolean;
    autoSyncProjectTimeline?: boolean;
    gatewayUrl?: string | null;
    autoNotifyAcervo?: boolean;
    autoNotifyFinance?: boolean;
    autoNotifyBooking?: boolean;
  };

  if (body.action === "update_gateway" && isValidGatewayKey(req)) {
    const updatedGateway = await prisma.whatsAppGatewayConfig.upsert({
      where: { id: "default" },
      update: {
        ...(body.gatewayUrl !== undefined ? { gatewayUrl: body.gatewayUrl?.trim() || null } : {}),
        apiKeyConfigured: true,
      },
      create: {
        id: "default",
        gatewayUrl: body.gatewayUrl?.trim() || null,
        apiKeyConfigured: true,
      },
    });
    revalidatePath("/admin/whatsapp");
    revalidatePath("/equipe/whatsapp");
    return NextResponse.json({ ok: true, gatewayConfig: updatedGateway });
  }

  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const mySession = await ensureWhatsAppBootstrapForUser(user);
  const targetSession =
    user.role === "ADMIN" && body.targetUserId
      ? await prisma.whatsAppUserSession.findUnique({
          where: { userId: body.targetUserId },
        })
      : mySession;

  if (!targetSession) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }

  const gateway = await prisma.whatsAppGatewayConfig.findUnique({
    where: { id: "default" },
  });
  const gatewayUrl = gateway?.gatewayUrl?.replace(/\/$/, "");
  const apiKey = process.env.WA_AKG_API_KEY?.trim() || "";

  if (body.action === "update_gateway") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas ADMIN pode configurar o gateway." }, { status: 403 });
    }
    const updatedGateway = await prisma.whatsAppGatewayConfig.update({
      where: { id: "default" },
      data: {
        ...(body.gatewayUrl !== undefined ? { gatewayUrl: body.gatewayUrl?.trim() || null } : {}),
        ...(typeof body.autoNotifyAcervo === "boolean" ? { autoNotifyAcervo: body.autoNotifyAcervo } : {}),
        ...(typeof body.autoNotifyFinance === "boolean" ? { autoNotifyFinance: body.autoNotifyFinance } : {}),
        ...(typeof body.autoNotifyBooking === "boolean" ? { autoNotifyBooking: body.autoNotifyBooking } : {}),
      },
    });
    revalidatePath("/admin/whatsapp");
    revalidatePath("/equipe/whatsapp");
    return NextResponse.json({ ok: true, gatewayConfig: updatedGateway });
  }

  if (body.action === "toggle_privacy") {
    const updated = await prisma.whatsAppUserSession.update({
      where: { id: targetSession.id },
      data: {
        ...(typeof body.onlyKnownContacts === "boolean"
          ? { onlyKnownContacts: body.onlyKnownContacts }
          : {}),
        ...(typeof body.autoSyncProjectTimeline === "boolean"
          ? { autoSyncProjectTimeline: body.autoSyncProjectTimeline }
          : {}),
      },
    });
    revalidatePath("/admin/whatsapp");
    revalidatePath("/equipe/whatsapp");
    return NextResponse.json({ ok: true, session: updated });
  }

  if (body.action === "logout") {
    if (gatewayUrl) {
      await fetch(`${gatewayUrl}/sessions/${encodeURIComponent(targetSession.sessionName)}/logout`, {
        method: "POST",
        headers: {
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
      }).catch(() => null);
    }

    const updated = await prisma.whatsAppUserSession.update({
      where: { id: targetSession.id },
      data: {
        connectionStatus: "DISCONNECTED",
        qrCodeDataUrl: null,
        pairingCode: null,
        connectedPhone: null,
      },
    });
    revalidatePath("/admin/whatsapp");
    revalidatePath("/equipe/whatsapp");
    revalidatePath("/admin/equipe");
    return NextResponse.json({ ok: true, session: updated });
  }

  // Default: start / generate individual QR Code
  let qrCodeDataUrl: string | null = null;
  let pairingCode: string | null = null;
  let connectionStatus: "DISCONNECTED" | "QR_READY" | "CONNECTED" = "QR_READY";
  let connectedPhone = targetSession.connectedPhone;

  if (gatewayUrl) {
    try {
      const gwRes = await fetch(
        `${gatewayUrl}/sessions/${encodeURIComponent(targetSession.sessionName)}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "x-api-key": apiKey } : {}),
          },
          body: JSON.stringify({
            ownerUserId: targetSession.userId,
            phoneNumber: body.phoneNumber,
          }),
        }
      );
      if (gwRes.ok) {
        const gwData = (await gwRes.json()) as {
          status?: "DISCONNECTED" | "QR_READY" | "CONNECTED";
          qrCodeDataUrl?: string | null;
          pairingCode?: string | null;
          connectedPhone?: string | null;
        };
        if (gwData.status) connectionStatus = gwData.status;
        if (gwData.qrCodeDataUrl) qrCodeDataUrl = gwData.qrCodeDataUrl;
        if (gwData.pairingCode) pairingCode = gwData.pairingCode;
        if (gwData.connectedPhone) connectedPhone = gwData.connectedPhone;
      }
    } catch {
      // Fallback to local session pairing QR below when Railway gateway is offline
    }
  }

  if (!qrCodeDataUrl && connectionStatus !== "CONNECTED") {
    qrCodeDataUrl = await generateSessionQrDataUrl(targetSession.sessionName);
    if (body.phoneNumber && !pairingCode) {
      pairingCode = String(Math.floor(10000000 + Math.random() * 90000000))
        .replace(/(\d{4})(\d{4})/, "$1-$2");
    }
  }

  const updated = await prisma.whatsAppUserSession.update({
    where: { id: targetSession.id },
    data: {
      connectionStatus,
      qrCodeDataUrl,
      pairingCode,
      connectedPhone,
      ...(connectionStatus === "CONNECTED" ? { lastConnectedAt: new Date() } : {}),
    },
  });

  revalidatePath("/admin/whatsapp");
  revalidatePath("/equipe/whatsapp");
  revalidatePath("/admin/equipe");

  return NextResponse.json({
    ok: true,
    session: updated,
    gatewayConnected: Boolean(gatewayUrl),
  });
}
