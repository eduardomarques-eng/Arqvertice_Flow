import { generateWhatsAppLink, sanitizePhoneNumber, sendWhatsAppMessage } from "@/lib/whatsapp";

export type WhatsAppProviderName = "wa.me" | "api";

export type WhatsAppDispatchResult = {
  provider: WhatsAppProviderName;
  status: "SENT" | "SKIPPED";
  deepLink?: string;
  externalId?: string;
};

export function getWhatsAppProvider(): WhatsAppProviderName {
  return (process.env.WHATSAPP_PROVIDER ?? "wa.me").toLowerCase() === "api" ? "api" : "wa.me";
}

export function isWhatsAppApiConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
}

export async function dispatchWhatsAppMessage(phone: string, message: string): Promise<WhatsAppDispatchResult> {
  const digits = sanitizePhoneNumber(phone);

  if (getWhatsAppProvider() === "wa.me") {
    return { provider: "wa.me", status: "SKIPPED", deepLink: generateWhatsAppLink(digits, message) };
  }

  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!url || !token) {
    return {
      provider: "wa.me",
      status: "SKIPPED",
      deepLink: generateWhatsAppLink(digits, message),
    };
  }

  const result = await sendWhatsAppMessage({ phone: digits, message });
  return {
    provider: "api",
    status: result.success ? "SENT" : "SKIPPED",
    deepLink: result.url,
    externalId: result.externalId,
  };
}
