import { prisma } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { requireRole } from "@/server/auth";
import { createBriefingToken, hashBriefingToken } from "@/lib/briefing-token";
import { notifyBriefingLink } from "@/server/services/notification-dispatch-service";
import { appUrl } from "@/lib/email";

async function ensureBriefing(idOrProjectId: string) {
  // Procura tanto por briefing.id quanto por briefing.projectId
  const existing = await prisma.briefing.findFirst({
    where: {
      OR: [{ id: idOrProjectId }, { projectId: idOrProjectId }],
    },
    select: { id: true, projectId: true },
  });

  if (existing) return existing;

  const briefing = await prisma.briefing.upsert({
    where: { projectId: idOrProjectId },
    create: { projectId: idOrProjectId, responses: {} },
    update: {},
    select: { id: true, projectId: true },
  });
  return briefing;
}

export async function generateSecureToken(briefingIdOrProjectId: string, originHeader?: string | null) {
  const briefing = await ensureBriefing(briefingIdOrProjectId);
  const token = createBriefingToken();

  await prisma.briefing.update({
    where: { id: briefing.id },
    data: { token },
  });

  await prisma.briefingAccessLink.updateMany({
    where: { briefingId: briefing.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.briefingAccessLink.create({
    data: {
      briefingId: briefing.id,
      tokenHash: hashBriefingToken(token),
      token,
    },
  });

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    originHeader ||
    "https://arqvertice-flow.vercel.app";

  const publicUrl = `${appBaseUrl.replace(/\/+$/, "")}/briefing/${token}`;

  return { token, publicUrl, briefing };
}

export async function createBriefingLink(projectId: string) {
  await requireRole("ADMIN");
  const result = await generateSecureToken(projectId);

  let notification: { url: string | null; whatsapp: string | null } = { url: null, whatsapp: null };
  try {
    notification = await notifyBriefingLink(result.briefing.projectId, result.token);
  } catch (error) {
    console.warn("[briefing-link] Falha não impeditiva no disparo da notificação:", error);
  }

  return {
    token: result.token,
    projectId: result.briefing.projectId,
    url: notification.url ?? result.publicUrl,
    whatsapp: notification.whatsapp,
  };
}

export async function revokeBriefingLink(projectId: string) {
  await requireRole("ADMIN");
  const briefing = await prisma.briefing.findUnique({ where: { projectId }, select: { id: true } });
  if (!briefing) return notFound("Briefing");
  return prisma.briefingAccessLink.updateMany({ where: { briefingId: briefing.id, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getBriefingLinkStatus(projectId: string) {
  await requireRole("ADMIN");
  const briefing = await prisma.briefing.findUnique({
    where: { projectId },
    include: { accessLinks: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!briefing) return { linkStatus: "NOT_STARTED" as const, briefingStatus: "NOT_STARTED" as const, lastAccessAt: null, createdAt: null };
  const link = briefing.accessLinks[0];
  return {
    linkStatus: !link || link.revokedAt ? "REVOKED" as const : "ACTIVE" as const,
    briefingStatus: briefing.status === "FINALIZED" ? "SUBMITTED" as const : Object.keys(briefing.responses as object).length ? "IN_PROGRESS" as const : "NOT_STARTED" as const,
    lastAccessAt: link?.lastAccessAt ?? null,
    createdAt: link?.createdAt ?? null,
  };
}

export async function resolveBriefingToken(token: string) {
  // Limite superior pelo mesmo motivo do token da proposta (Prompt 19, item 51):
  // sem ele, um token gigante era aceite e ainda era hasheado.
  if (!/^[A-Za-z0-9_-]{30,128}$/.test(token)) throw new DomainError("Link de briefing inválido.", "NOT_FOUND");
  const link = await prisma.briefingAccessLink.findFirst({
    where: {
      OR: [
        { tokenHash: hashBriefingToken(token) },
        { token },
      ],
    },
    include: { briefing: { include: { project: { select: { id: true, name: true, address: true, client: { select: { name: true, email: true, phone: true } } } } } } },
  });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= new Date())) throw new DomainError("Este link de briefing foi revogado, expirou ou não existe.", "NOT_FOUND");
  const now = new Date();
  await prisma.briefingAccessLink.update({
    where: { id: link.id },
    data: { lastAccessAt: now, firstAccessAt: link.firstAccessAt ?? now },
  });
  return link;
}
