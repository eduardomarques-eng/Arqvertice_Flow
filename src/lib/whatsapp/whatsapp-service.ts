/**
 * ArqVértice Flow — Disparo Híbrido de WhatsApp
 * 
 * 1. Sanitização com prefixo 55 obrigatório.
 * 2. Tentativa 1 (Automática via CLI Bridge Local na porta 3001).
 * 3. Tentativa 2 (Fallback Transparente com deep link web).
 */

export interface WhatsAppDispatchParams {
  phone: string;
  message: string;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  method: "WHATSAPP_CLI_BRIDGE" | "WHATSAPP_DEEP_LINK";
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
 * Disparo Híbrido de Mensagem de WhatsApp
 */
export async function sendArqVerticeWhatsApp({
  phone,
  message,
}: WhatsAppDispatchParams): Promise<WhatsAppDispatchResult> {
  const cleanPhone = sanitizeWhatsAppPhone(phone);

  if (!cleanPhone) {
    return {
      success: false,
      method: "WHATSAPP_DEEP_LINK",
      error: "Número de telefone inválido.",
    };
  }

  const deepLink = buildWhatsAppDeepLink(cleanPhone, message);
  const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL || "http://127.0.0.1:3001";
  const bridgeSecret = process.env.WHATSAPP_BRIDGE_SECRET || "arqvertice-bridge-secret";

  // Tentativa 1: Envio automático via Bridge Local (Baileys) com timeout curto de 3000ms
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${bridgeUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": bridgeSecret,
      },
      body: JSON.stringify({ phone: cleanPhone, message }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        method: "WHATSAPP_CLI_BRIDGE",
        messageId: data.messageId,
      };
    } else {
      const errData = await response.json().catch(() => ({}));
      console.warn(
        `[WhatsAppService] Bridge retornou status ${response.status}: ${errData.error || "Falha no envio"}`
      );
    }
  } catch (err: any) {
    // Bridge offline, porta indisponível ou timeout atingido
    // Segue para a Tentativa 2 de forma 100% transparente
  }

  // Tentativa 2: Fallback Transparente via Deep Link
  return {
    success: true,
    method: "WHATSAPP_DEEP_LINK",
    fallbackUrl: deepLink,
  };
}

