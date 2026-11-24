import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { ensureWhatsAppBootstrapForUser } from "@/lib/whatsapp/multi-session";
import {
  resolveOfficialGatewayConfig,
  validateGatewayUrl,
} from "@/lib/whatsapp/gateway-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

async function probeLocalGatewayHealth(gatewayUrl: string | null | undefined) {
  if (!gatewayUrl) {
    return { online: false, mode: "wa-akg-service", ollamaOnline: false, ollamaModel: null as string | null };
  }
  const validated = validateGatewayUrl(gatewayUrl);
  if (!validated.ok) {
    return { online: false, mode: "wa-akg-service", ollamaOnline: false, ollamaModel: null as string | null };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${validated.normalizedUrl}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { online: false, mode: "wa-akg-service", ollamaOnline: false, ollamaModel: null as string | null };
    }
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      mode?: string;
      ollamaOnline?: boolean;
      ollamaModel?: string | null;
    };
    return {
      online: Boolean(data.ok),
      mode: data.mode || "wa-akg-service",
      ollamaOnline: Boolean(data.ollamaOnline),
      ollamaModel: data.ollamaModel || null,
    };
  } catch {
    return { online: false, mode: "wa-akg-service", ollamaOnline: false, ollamaModel: null as string | null };
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const mySessionRaw = await ensureWhatsAppBootstrapForUser(user);
  const mySession =
    mySessionRaw.connectionStatus === "QR_READY"
      ? mySessionRaw
      : { ...mySessionRaw, qrCodeDataUrl: null, pairingCode: null };

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
        autoSyncProjectTimeline: true,
        lastConnectedAt: true,
        updatedAt: true,
      },
    }),
    prisma.whatsAppConversation.findMany({
      where: user.role === "ADMIN" ? {} : { ownerUserId: user.id },
      orderBy: { lastMessageAt: "desc" },
      take: 60,
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    }),
  ]);

  const resolvedCfg = await resolveOfficialGatewayConfig();
  const gatewayHealth = await probeLocalGatewayHealth(resolvedCfg.gatewayUrl);

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
  const user = await currentUser();
  if (!user || user.role === "CLIENTE" || user.role === "CLIENT") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

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

  if (body.action === "update_gateway") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas ADMIN pode configurar o gateway." }, { status: 403 });
    }

    let nextGatewayUrl: string | null | undefined = undefined;
    if (body.gatewayUrl !== undefined) {
      const trimmed = body.gatewayUrl?.trim() || "";
      if (!trimmed) {
        nextGatewayUrl = null;
      } else {
        const validation = validateGatewayUrl(trimmed);
        if (!validation.ok) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        nextGatewayUrl = validation.normalizedUrl;
      }
    }

    const updatedGateway = await prisma.whatsAppGatewayConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        gatewayUrl: nextGatewayUrl ?? null,
        apiKeyConfigured: Boolean(process.env.WA_AKG_API_KEY?.trim()),
        ...(typeof body.autoNotifyAcervo === "boolean" ? { autoNotifyAcervo: body.autoNotifyAcervo } : {}),
        ...(typeof body.autoNotifyFinance === "boolean" ? { autoNotifyFinance: body.autoNotifyFinance } : {}),
        ...(typeof body.autoNotifyBooking === "boolean" ? { autoNotifyBooking: body.autoNotifyBooking } : {}),
      },
      update: {
        ...(nextGatewayUrl !== undefined ? { gatewayUrl: nextGatewayUrl } : {}),
        ...(typeof body.autoNotifyAcervo === "boolean" ? { autoNotifyAcervo: body.autoNotifyAcervo } : {}),
        ...(typeof body.autoNotifyFinance === "boolean" ? { autoNotifyFinance: body.autoNotifyFinance } : {}),
        ...(typeof body.autoNotifyBooking === "boolean" ? { autoNotifyBooking: body.autoNotifyBooking } : {}),
      },
    });
    revalidatePath("/admin/whatsapp");
    revalidatePath("/equipe/whatsapp");
    return NextResponse.json({ ok: true, gatewayConfig: updatedGateway });
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

  const { gatewayUrl, apiKey } = await resolveOfficialGatewayConfig();

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
    if (gatewayUrl && apiKey) {
      await fetch(`${gatewayUrl}/sessions/${encodeURIComponent(targetSession.sessionName)}/logout`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
        },
        signal: AbortSignal.timeout(4000),
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

  // Default: start session via official wa-akg-service gateway (sem QR sintético offline)
  if (!gatewayUrl || !apiKey) {
    return NextResponse.json(
      {
        ok: false,
        status: "GATEWAY_OFFLINE",
        error: "Gateway WA-AKG offline ou não configurado. Inicie o serviço local e configure a URL HTTPS.",
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  let qrCodeDataUrl: string | null = null;
  let pairingCode: string | null = null;
  let connectionStatus: "DISCONNECTED" | "QR_READY" | "CONNECTED" = "DISCONNECTED";
  let connectedPhone = targetSession.connectedPhone;

  try {
    const gwRes = await fetch(
      `${gatewayUrl}/sessions/${encodeURIComponent(targetSession.sessionName)}/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          ownerUserId: targetSession.userId,
          phoneNumber: body.phoneNumber,
        }),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!gwRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: "GATEWAY_OFFLINE",
          error: `Gateway WA-AKG indisponível (HTTP ${gwRes.status}).`,
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

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
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "GATEWAY_OFFLINE",
        error: "Gateway WA-AKG offline. Verifique se o processo local e o túnel HTTPS estão ativos.",
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const updated = await prisma.whatsAppUserSession.update({
    where: { id: targetSession.id },
    data: {
      connectionStatus,
      qrCodeDataUrl: connectionStatus === "QR_READY" ? qrCodeDataUrl : null,
      pairingCode: connectionStatus === "QR_READY" ? pairingCode : null,
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
    gatewayConnected: true,
  });
}
