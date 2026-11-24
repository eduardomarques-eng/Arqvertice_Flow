import { sendViaOfficialGateway } from "@/lib/whatsapp/gateway-client";

/**
 * ArqVértice OS — Disparo Unificado via Gateway Oficial WA-AKG
 *
 * 1. Sanitização com prefixo 55 obrigatório.
 * 2. Roteia exclusivamente pelo gateway multi-sessão oficial (`wa-akg-service`).
 * 3. Quando offline ou sem sessão conectada, retorna fallback de Deep Link oficial.
 */

export interface WhatsAppDispatchParams {
  phone: string;
  message: string;
  sessionName?: string;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  method: "WA_AKG_GATEWAY" | "WHATSAPP_DEEP_LINK";
  messageId?: string;
  fallbackUrl?: string;
  error?: string;
}

/**
 * Sanitiza telefone removendo caracteres não numéricos e garantindo prefixo 55
 * Exemplo: (85) 98590-2642 -> 5585985902642
 */
export function sanitizeWhatsAppPhone(rawPhone: string): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11 && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits;
}

/**
 * Gera deep link para abertura do WhatsApp Web ou aplicativo
 */
export function buildWhatsAppDeepLink(phone: string, message: string): string {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
}

/**
 * Disparo Unificado via Gateway WA-AKG com fallback transparente para Deep Link
 */
export async function sendArqVerticeWhatsApp({
  phone,
  message,
  sessionName,
}: WhatsAppDispatchParams): Promise<WhatsAppDispatchResult> {
  const cleanPhone = sanitizeWhatsAppPhone(phone);

  if (!cleanPhone) {
    return {
      success: false,
      method: "WHATSAPP_DEEP_LINK",
      error: "Número de telefone inválido.",
    };
  }

  try {
    const gwResult = await sendViaOfficialGateway({
      phone: cleanPhone,
      message,
      sessionName,
    });

    if (gwResult.ok) {
      return {
        success: true,
        method: "WA_AKG_GATEWAY",
        messageId: gwResult.messageId,
      };
    }

    return {
      success: true,
      method: "WHATSAPP_DEEP_LINK",
      fallbackUrl: gwResult.deepLink,
      error: gwResult.error,
    };
  } catch (err) {
    return {
      success: true,
      method: "WHATSAPP_DEEP_LINK",
      fallbackUrl: buildWhatsAppDeepLink(cleanPhone, message),
      error: err instanceof Error ? err.message : undefined,
    };
  }
}
