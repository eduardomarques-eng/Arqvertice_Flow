import { headers } from "next/headers";
import { prisma } from "@/server/db";
import type { AccessEventType } from "@prisma/client";

export async function logUserTrafficEvent(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  eventType: AccessEventType;
  deviceInfo?: string | null;
}) {
  try {
    const headersList = await headers().catch(() => null);
    const forwardedFor = headersList?.get("x-forwarded-for") || "";
    const ipAddress = forwardedFor.split(",")[0].trim() || headersList?.get("x-real-ip") || "127.0.0.1";
    const userAgent = headersList?.get("user-agent") || null;

    let device = params.deviceInfo;
    if (!device && userAgent) {
      if (/mobile|android|iphone|ipad/i.test(userAgent)) {
        device = "Mobile";
      } else if (/macintosh|mac os x/i.test(userAgent)) {
        device = "Mac Desktop";
      } else if (/windows/i.test(userAgent)) {
        device = "Windows Desktop";
      } else if (/linux/i.test(userAgent)) {
        device = "Linux Desktop";
      } else {
        device = "Navegador Web";
      }
    }

    await prisma.userAccessLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        userEmail: params.userEmail,
        userRole: params.userRole,
        eventType: params.eventType,
        ipAddress,
        userAgent,
        deviceInfo: device || "Web",
      },
    });
  } catch (err) {
    console.error("[TrafficLog] Falha ao registrar log de tráfego:", err);
  }
}

