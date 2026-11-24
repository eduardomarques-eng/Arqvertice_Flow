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
  deliveryMethod: "WA_AKG_GATEWAY" | "WHATSAPP_DEEP_LINK";
}> {
  const cleanPhone = sanitizePhoneNumber(phone);
  const directUrl = generateWhatsAppLink(cleanPhone, message);
  const { sendViaOfficialGateway } = await import("@/lib/whatsapp/gateway-client");
  const result = await sendViaOfficialGateway({
    phone: cleanPhone,
    message: message.trim(),
  });

  if (result.ok && result.method === "WA_AKG_GATEWAY") {
    return {
      success: true,
      url: result.deepLink || directUrl,
      externalId: result.messageId,
      deliveryMethod: "WA_AKG_GATEWAY",
    };
  }

  return {
    success: true,
    url: result.deepLink || directUrl,
    deliveryMethod: "WHATSAPP_DEEP_LINK",
  };
}

/** Deep link `wa.me`, usado quando não há provedor de API configurado. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) throw new Error("Telefone inválido para o WhatsApp.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
