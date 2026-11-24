import { generateWhatsAppLink, sanitizePhoneNumber } from "@/lib/whatsapp";
import {
  resolveOfficialGatewayConfig,
  sendViaOfficialGateway,
} from "@/lib/whatsapp/gateway-client";

export type WhatsAppProviderName = "wa.me" | "api";

export type WhatsAppDispatchResult = {
  provider: WhatsAppProviderName;
  status: "SENT" | "SKIPPED";
  deepLink?: string;
  externalId?: string;
};

export function getWhatsAppProvider(): WhatsAppProviderName {
  if ((process.env.WHATSAPP_PROVIDER ?? "").toLowerCase() === "wa.me") {
    return "wa.me";
  }
  return process.env.WA_AKG_GATEWAY_URL || process.env.WA_AKG_URL || (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase() === "api"
    ? "api"
    : "wa.me";
}

export async function isWhatsAppApiConfigured(): Promise<boolean> {
  const cfg = await resolveOfficialGatewayConfig();
  return Boolean(cfg.gatewayUrl && cfg.apiKey);
}

export async function dispatchWhatsAppMessage(phone: string, message: string): Promise<WhatsAppDispatchResult> {
  const digits = sanitizePhoneNumber(phone);
  const deepLink = generateWhatsAppLink(digits, message);

  const result = await sendViaOfficialGateway({ phone: digits, message });
  if (result.ok && result.method === "WA_AKG_GATEWAY") {
    return {
      provider: "api",
      status: "SENT",
      deepLink: result.deepLink || deepLink,
      externalId: result.messageId,
    };
  }

  return {
    provider: "wa.me",
    status: "SKIPPED",
    deepLink: result.deepLink || deepLink,
  };
}
