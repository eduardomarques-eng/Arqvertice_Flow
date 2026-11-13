import { missingRequiredVariables, renderTemplate } from "./template-engine";

export interface WhatsAppMessagePayload {
  phone: string;
  message: string;
}

/**
 * Variáveis disponíveis nos templates de WhatsApp. A mensagem é editável pelo
 * ADMIN e fica no banco; nada de credenciais ou texto fixo no frontend.
 */
export const WHATSAPP_VARIABLES = [
  { key: "CLIENTE", label: "Nome do cliente", required: true },
  { key: "PROJETO", label: "Nome do projeto", required: false },
  { key: "PROPOSTA", label: "Título da proposta", required: false },
  { key: "VALOR", label: "Valor total", required: false },
  { key: "VALIDADE", label: "Validade", required: false },
  { key: "LINK", label: "Link da proposta", required: true },
] as const;

export const REQUIRED_WHATSAPP_VARIABLES = WHATSAPP_VARIABLES.filter((variable) => variable.required).map(
  (variable) => variable.key,
);

export function buildWhatsAppMessage(
  body: string,
  values: Record<string, string | number | null | undefined>,
) {
  const rendered = renderTemplate(body, values);
  return { ...rendered, missingRequired: missingRequiredVariables(REQUIRED_WHATSAPP_VARIABLES, rendered.missing) };
}

/** Converte um telefone livre em dígitos para o wa.me, sem lançar erro. */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

/** Normaliza um telefone brasileiro para o formato internacional exigido pelo gateway. */
export function sanitizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55") && (cleaned.length === 10 || cleaned.length === 11)) {
    cleaned = `55${cleaned}`;
  }
  if (cleaned.length < 12 || cleaned.length > 13) {
    throw new Error("Telefone inválido para o WhatsApp.");
  }
  return cleaned;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${sanitizePhoneNumber(phone)}?text=${encodeURIComponent(message.trim())}`;
}

export const WhatsAppTemplates = {
  briefingInvite: (params: { clientName: string; projectName: string; briefingUrl: string }) =>
    `Olá, *${params.clientName}*! Tudo bem?\n\nAqui é o Arquiteto *Eduardo Marques*, da *ArqVértice*.\n\nPreparamos um quiz exclusivo para o projeto *${params.projectName}*:\n👉 ${params.briefingUrl}\n\nEquipe ArqVértice`,
  adminBriefingCompleted: (params: { clientName: string; projectName: string; reportUrl: string }) =>
    `🔔 *NOVO BRIEFING RESPONDIDO!*\n\n*Cliente:* ${params.clientName}\n*Projeto:* ${params.projectName}\n*Dossiê:* ${params.reportUrl}\n\nO briefing está disponível no painel administrativo.`,
  stageCompleted: (params: { clientName: string; stageName: string; projectName: string; portalUrl: string }) =>
    `Olá, *${params.clientName}*!\n\nA etapa *${params.stageName}* do projeto *${params.projectName}* foi concluída com sucesso (100%).\n\n👉 ${params.portalUrl}\n\nEquipe ArqVértice`,
  proposalReady: (params: { clientName: string; projectName: string; proposalUrl: string }) =>
    `Olá, *${params.clientName}*!\n\nA proposta para *${params.projectName}* está pronta para análise:\n👉 ${params.proposalUrl}\n\nEquipe ArqVértice`,
} as const;

export async function sendWhatsAppMessage({
  phone,
  message,
}: WhatsAppMessagePayload): Promise<{
  success: boolean;
  url: string;
  externalId?: string;
  deliveryMethod: "WHATSAPP_CLI_BRIDGE" | "WHATSAPP_API" | "WHATSAPP_DEEP_LINK";
}> {
  const directUrl = generateWhatsAppLink(phone, message);
  const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL?.trim();
  const bridgeSecret = process.env.WHATSAPP_BRIDGE_SECRET?.trim() || "arqvertice-local-bridge-2026";

  // 1. Tenta envio pelo micro-serviço local CLI/HTTP Bridge (Baileys Gratuito)
  if (bridgeUrl) {
    try {
      const response = await fetch(`${bridgeUrl}/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bridge-secret": bridgeSecret,
        },
        body: JSON.stringify({
          phone: sanitizePhoneNumber(phone),
          message: message.trim(),
        }),
        signal: AbortSignal.timeout(4000), // Timeout curto para não prender a UI
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          url: directUrl,
          externalId: data.id,
          deliveryMethod: "WHATSAPP_CLI_BRIDGE",
        };
      }
    } catch {
      // Bridge indisponível ou offline: continua para próximo fallback
    }
  }

  // 2. Gateway API legado se configurado
  const provider = (process.env.WHATSAPP_PROVIDER ?? "wa.me").toLowerCase();
  const apiUrl = process.env.WHATSAPP_API_URL?.trim();
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim();

  if (provider === "api" && apiUrl && apiToken) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiToken}` },
        body: JSON.stringify({
          number: sanitizePhoneNumber(phone),
          text: message.trim(),
          instanceId: process.env.WHATSAPP_INSTANCE_ID?.trim() || undefined,
        }),
      });
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as { id?: string; messageId?: string };
        return {
          success: true,
          url: directUrl,
          externalId: data.id ?? data.messageId,
          deliveryMethod: "WHATSAPP_API",
        };
      }
    } catch (error) {
      console.error("[WHATSAPP] Erro no gateway.", error instanceof Error ? error.message : error);
    }
  }

  // 3. Fallback automático e imediato para Deep Link (wa.me / api.whatsapp.com)
  return {
    success: true,
    url: directUrl,
    deliveryMethod: "WHATSAPP_DEEP_LINK",
  };
}

/** Deep link `wa.me`, usado quando não há provedor de API configurado. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) throw new Error("Telefone inválido para o WhatsApp.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
