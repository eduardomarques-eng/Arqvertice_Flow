import QRCode from "qrcode";
import { prisma } from "@/server/db";

export function mapAppRoleToWaRole(role: string): string {
  if (role === "ADMIN") return "ADMIN";
  if (role === "ENGENHEIRO") return "ENGINEER";
  if (role === "PARTNER") return "PARTNER";
  return "ARCHITECT";
}

export function buildSessionName(userId: string): string {
  return `wa_user_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
}

export function shouldIndexInboundMessage(params: {
  onlyKnownContacts: boolean;
  remoteJid: string;
  matchedClientId: string | null;
}): boolean {
  if (!params.onlyKnownContacts) return true;
  if (params.remoteJid.endsWith("@g.us")) return false;
  return Boolean(params.matchedClientId);
}

export function getHumanizedDelayMs(): number {
  return 3000 + Math.floor(Math.random() * 3000);
}

export function buildWhatsAppTemplates(pixKey = "021.502.003-09", pixKeyType = "CPF") {
  return [
    {
      id: "pix",
      label: `Cobrança Pix ${pixKeyType}`,
      text: `Olá! Seguem os dados para pagamento da parcela do seu projeto no ArqVértice Studio:\n\n• Chave Pix (${pixKeyType}): ${pixKey}\n• Favorecido: Eduardo César Costa Marques / ArqVértice Studio\n\nApós o pagamento, envie o comprovante por aqui ou no Portal do Cliente.`,
    },
    {
      id: "acervo",
      label: "Prancha Bom para Obra",
      text: `Olá! Acabamos de liberar uma nova revisão de pranchas técnicas com status *Bom para Obra* no Acervo Manager CDE.\n\nAcesse seu Portal do Cliente para visualizar e validar via QR Code.`,
    },
    {
      id: "bim",
      label: "Compatibilização BIM",
      text: `Olá! Precisamos alinhar um ponto de compatibilização estrutural / arquitetônica referente ao modelo BIM vigente. Podemos revisar os detalhes hoje?`,
    },
    {
      id: "proposta",
      label: "Envio de Proposta",
      text: `Olá! Sua Proposta Comercial interativa do ArqVértice Studio já está disponível para análise e aprovação digital.`,
    },
    {
      id: "agendar",
      label: "Confirmação Reunião",
      text: `Olá! Para confirmar ou remarcar nossa reunião de alinhamento, acesse nossa agenda executiva:\nhttps://arqvertice-flow.vercel.app/agendar`,
    },
  ];
}

export async function generateSessionQrDataUrl(sessionName: string, pairingHint?: string): Promise<string> {
  const payload = pairingHint || `arqvertice-wa://pair/${sessionName}?ts=${Date.now()}`;
  return QRCode.toDataURL(payload, {
    width: 240,
    margin: 2,
    color: { dark: "#18181B", light: "#FFFFFF" },
  });
}

export async function ensureWhatsAppBootstrapForUser(user: {
  id: string;
  name: string;
  role: string;
}) {
  const envGatewayUrl = process.env.WA_AKG_GATEWAY_URL?.trim() || null;
  const apiKeyConfigured = Boolean(process.env.WA_AKG_API_KEY?.trim());

  await prisma.whatsAppGatewayConfig.upsert({
    where: { id: "default" },
    update: {
      ...(envGatewayUrl ? { gatewayUrl: envGatewayUrl } : {}),
      ...(apiKeyConfigured ? { apiKeyConfigured: true } : {}),
    },
    create: {
      id: "default",
      gatewayUrl: envGatewayUrl,
      apiKeyConfigured,
    },
  });

  const existingCount = await prisma.whatsAppUserSession.count();
  if (existingCount === 0) {
    const staffUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "EQUIPE"] },
      },
      select: { id: true, name: true, role: true },
    });

    for (const staff of staffUsers) {
      await prisma.whatsAppUserSession.upsert({
        where: { userId: staff.id },
        update: {},
        create: {
          userId: staff.id,
          userName: staff.name,
          userRole: mapAppRoleToWaRole(staff.role),
          sessionName: buildSessionName(staff.id),
          isStudioOfficial: staff.role === "ADMIN",
        },
      });
    }
  }

  return prisma.whatsAppUserSession.upsert({
    where: { userId: user.id },
    update: {
      userName: user.name,
      userRole: mapAppRoleToWaRole(user.role),
    },
    create: {
      userId: user.id,
      userName: user.name,
      userRole: mapAppRoleToWaRole(user.role),
      sessionName: buildSessionName(user.id),
      isStudioOfficial: user.role === "ADMIN",
    },
  });
}
