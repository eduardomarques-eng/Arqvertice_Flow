import { headers } from "next/headers";
import { prisma } from "@/server/db";
import type { AccessEventType } from "@prisma/client";

/**
 * Extrai um resumo legível e amigável do dispositivo a partir do User-Agent:
 * Windows · Chrome, iPhone · Safari, Android · Chrome, macOS · Safari, etc.
 */
export function parseDeviceReadable(userAgent: string | null | undefined): string {
  if (!userAgent) return "Web · Navegador";

  let os = "Desktop";
  if (/iphone/i.test(userAgent)) os = "iPhone";
  else if (/ipad/i.test(userAgent)) os = "iPad";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "macOS";
  else if (/linux/i.test(userAgent)) os = "Linux";

  let browser = "Navegador";
  if (/edg\//i.test(userAgent)) browser = "Edge";
  else if (/chrome|crios/i.test(userAgent) && !/edg\//i.test(userAgent)) browser = "Chrome";
  else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = "Safari";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/opera|opr/i.test(userAgent)) browser = "Opera";

  return `${os} · ${browser}`;
}

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
    const ipAddress =
      forwardedFor.split(",")[0].trim() || headersList?.get("x-real-ip") || "127.0.0.1";
    const userAgent = headersList?.get("user-agent") || null;

    const device = params.deviceInfo || parseDeviceReadable(userAgent);

    await prisma.userAccessLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        userEmail: params.userEmail,
        userRole: params.userRole,
        eventType: params.eventType,
        ipAddress,
        userAgent,
        deviceInfo: device,
      },
    });
  } catch (err) {
    console.error("[TrafficLog] Falha ao registrar log de tráfego:", err);
  }
}
