/**
 * ArqVértice Flow — Disparo Híbrido de WhatsApp
 * 
 * 1. Sanitização com prefixo 55 obrigatório.
 * 2. Em ambiente de nuvem (Vercel) ou sem Bridge externa configurada, aciona imediatamente o fallback de link direto.
 * 3. Em ambiente local com Bridge na porta 3001, tenta envio direto com timeout estrito de 1.5s.
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
  const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL;
  const bridgeSecret = process.env.WHATSAPP_BRIDGE_SECRET || "arqvertice-bridge-secret";
  const isVercel = process.env.VERCEL === "1";

  // Se estiver na Vercel e o bridgeUrl for localhost ou não estiver configurado, vai direto para o deep link
  const isLocalBridge = !bridgeUrl || bridgeUrl.includes("localhost") || bridgeUrl.includes("127.0.0.1");

  if (!isVercel || (!isLocalBridge && bridgeUrl)) {
    const targetUrl = bridgeUrl || "http://127.0.0.1:3001";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout estrito

      const response = await fetch(`${targetUrl}/send`, {
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
      }
    } catch {
      // Bridge offline, porta indisponível ou timeout atingido
      // Segue para a Tentativa 2 de forma 100% transparente
    }
  }

  // Tentativa 2: Fallback Transparente via Deep Link
  return {
    success: true,
    method: "WHATSAPP_DEEP_LINK",
    fallbackUrl: deepLink,
  };
}
