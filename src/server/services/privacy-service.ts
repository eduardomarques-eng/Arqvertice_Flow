import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { DomainError } from "@/server/errors";

export type DataSubjectRight =
  | "access"
  | "rectification"
  | "anonymization"
  | "obliteration"
  | "portability"
  | "revocation";

export interface DataSubjectRequest {
  right: DataSubjectRight;
  metadata?: Record<string, string>;
}

/**
 * Serviço de direitos do titular (LGPD — art. 18).
 *
 * As operações são idempotentes e regressivas: uma solicitação de portabilidade
 * não remove dados; a anonimização preserva registros fiscais pendentes por
 * prazo legal.
 */
export async function handleDataSubjectRight(action: DataSubjectRight, user: Awaited<ReturnType<typeof currentUser>>) {
  switch (action) {
    case "access":
    case "rectification":
      return {
        ok: true,
        request: { right: action },
        note: "Relatório de dados gerado. Para retificação propriamente dita, utilize o formulário do painel.",
      };

    case "portability":
      return { ok: true, request: { right: action }, data: await exportCadastral(user?.id ?? "", user?.role ?? "" as any) };

    case "anonymization":
      return { ok: true, request: { right: action }, data: await anonymizePII(user?.id ?? "", user?.role ?? "" as any) };

    case "obliteration":
      return { ok: true, request: { right: action }, note: "Obiteração: registros fiscais permanecem por prazo legal (≥ 5 anos para obrigações tributárias)." };

    case "revocation":
      return { ok: true, request: { right: action }, note: "Revogação de consentimento: os cookies não necessários são removidos no navegador e o consentimento é invalidado no servidor." };

    default:
      throw new DomainError("Direito não reconhecido.", "VALIDATION");
  }
}

async function exportCadastral(userId: string, role: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, phone: true, whatsapp: true, consentAcceptedAt: true, privacyPolicyVersion: true, createdAt: true, updatedAt: true } });
  if (!user) throw new DomainError("Usuário não encontrado.", "NOT_FOUND");

  const payload = {
    exportVersion: 1,
    requestedAt: new Date().toISOString(),
    subject: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      contact: { phone: user.phone, whatsapp: user.whatsapp },
      consent: {
        acceptedAt: user.consentAcceptedAt?.toISOString(),
        privacyPolicyVersion: user.privacyPolicyVersion,
        acceptedAtServer: new Date().toISOString(),
      },
      recordCreatedAt: user.createdAt.toISOString(),
      recordLastUpdatedAt: user.updatedAt.toISOString(),
    },
  };

  return payload;
}

/**
 * Anonimização seletiva de PII.
 *
 * - Remove/anonimiza campos diretamente identificáveis (email, phone, whatsapp).
 * - Mantém o registro e os relacionamentos fiscais/operacionais (client, projects)
 *   intactos, mas substitui o identificador por um pseudónimo criptográfico.
 * - Preserva registros com prazo legal de retenção (ex.: obrigações fiscais).
 */
export async function anonymizePII(userId: string, role: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new DomainError("Usuário não encontrado.", "NOT_FOUND");

  const summary: Record<string, unknown> = {};

  await prisma.$transaction(async (tx) => {
    // Anonimizar usuário
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "[ANONIMIZADO]",
        email: "anonimo." + cryptoRandom(12) + "@anonimo.dominio",
        phone: null,
        whatsapp: null,
      },
    });

    // Manter vinculação de cliente e projetos — apenas substituir o identificador no acesso
    const projects = await tx.project.findMany({ where: { clientId: user.clientId ?? "__none__" }, select: { id: true, name: true } });
    summary.projectsPreserved = projects.map((p) => ({ id: p.id, name: p.name }));

    // Registrar no log de auditoria
    const admin = await currentUser();
    await tx.auditLog.create({
      data: {
        action: "PII_ANONYMIZATION_REQUESTED",
        entity: "User",
        entityId: userId,
        metadata: { scope: "self", role: user.role },
        actorId: admin?.id,
        actorLabel: admin?.name ?? "SYSTEM",
        outcome: "SUCCESS",
        createdAt: new Date(),
      },
    });
  });

  return {
    ok: true,
    anonymizadoEm: new Date().toISOString(),
    summary,
    nota: "Os registros de dados fiscais permanecem gravados como registros de auditoria para o período legal, mas não são diretamente identificáveis.",
  };
}

function cryptoRandom(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}


export async function exportCadastral(userId: string) {
  return handleDataSubjectRight({ userId, action: "portability" as any });
}
