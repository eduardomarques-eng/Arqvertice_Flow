import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { hashPassword, verifyPassword } from "@/lib/password";

const SESSION_COOKIE = "arqvertice_session";
const SESSION_EXPIRES_MS = 1000 * 60 * 60 * 2;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface StudioSettingDTO {
  id: string;
  studioName: string;
  technicalLeadName: string;
  technicalLeadReg: string;
  studioCnpj: string;
  pixKey: string;
  pixKeyType: string;
  bankInstructions: string;
  structuralPartner: string;
  commercialAddress: string;
  cityState: string;
  institutionalEmail: string;
  documentSignature: string;
  proposalValidityDays: number;
  lateFeePercent: number;
  lateInterestPercent: number;
  defaultProposalScope: string;
  refundPolicyText: string;
  scheduleAlertDays: number;
  inactivityTimeoutMin: number;
  privacyPolicyVersion: string;
  forceLgpdReacceptAt: string | null;
  updatedAt: string;
}

export interface InfrastructureHealthDTO {
  dbConnected: boolean;
  dbLatencyMs: number;
  activeSessionsCount: number;
  pendingEventsCount: number;
  deadLetterCount: number;
  cronJobs: Array<{ path: string; schedule: string; description: string }>;
}

const DEFAULT_CRON_JOBS = [
  { path: "/api/cron/housekeeping", schedule: "0 3 * * *", description: "Limpeza diária de sessões expiradas e tokens" },
  { path: "/api/cron/process-events", schedule: "0 4 * * *", description: "Processamento da fila de eventos de domínio e DLQ" },
];

export async function getStudioSettings(): Promise<StudioSettingDTO> {
  const record = await prisma.studioSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  return {
    id: record.id,
    studioName: record.studioName,
    technicalLeadName: record.technicalLeadName,
    technicalLeadReg: record.technicalLeadReg,
    studioCnpj: record.studioCnpj,
    pixKey: record.pixKey,
    pixKeyType: record.pixKeyType,
    bankInstructions: record.bankInstructions,
    structuralPartner: record.structuralPartner,
    commercialAddress: record.commercialAddress,
    cityState: record.cityState,
    institutionalEmail: record.institutionalEmail,
    documentSignature: record.documentSignature,
    proposalValidityDays: record.proposalValidityDays,
    lateFeePercent: record.lateFeePercent,
    lateInterestPercent: record.lateInterestPercent,
    defaultProposalScope: record.defaultProposalScope,
    refundPolicyText: record.refundPolicyText,
    scheduleAlertDays: record.scheduleAlertDays,
    inactivityTimeoutMin: record.inactivityTimeoutMin,
    privacyPolicyVersion: record.privacyPolicyVersion,
    forceLgpdReacceptAt: record.forceLgpdReacceptAt ? record.forceLgpdReacceptAt.toISOString() : null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function updateStudioSettings(
  adminId: string,
  input: Partial<{
    studioName: string;
    technicalLeadName: string;
    technicalLeadReg: string;
    studioCnpj: string;
    pixKey: string;
    pixKeyType: string;
    bankInstructions: string;
    structuralPartner: string;
    commercialAddress: string;
    cityState: string;
    institutionalEmail: string;
    documentSignature: string;
    proposalValidityDays: number;
    lateFeePercent: number;
    lateInterestPercent: number;
    defaultProposalScope: string;
    refundPolicyText: string;
    scheduleAlertDays: number;
    inactivityTimeoutMin: number;
    privacyPolicyVersion: string;
  }>
): Promise<StudioSettingDTO> {
  const data: Record<string, unknown> = { updatedById: adminId };

  const stringFields = [
    "studioName",
    "technicalLeadName",
    "technicalLeadReg",
    "studioCnpj",
    "pixKey",
    "pixKeyType",
    "bankInstructions",
    "structuralPartner",
    "commercialAddress",
    "cityState",
    "institutionalEmail",
    "documentSignature",
    "defaultProposalScope",
    "refundPolicyText",
    "privacyPolicyVersion",
  ] as const;

  for (const field of stringFields) {
    if (typeof input[field] === "string") {
      data[field] = input[field].trim();
    }
  }

  if (input.proposalValidityDays !== undefined) {
    const val = Number(input.proposalValidityDays);
    if (!Number.isFinite(val) || val < 1 || val > 365) {
      throw new DomainError("Validade da proposta deve estar entre 1 e 365 dias.", "VALIDATION");
    }
    data.proposalValidityDays = Math.round(val);
  }

  if (input.scheduleAlertDays !== undefined) {
    const val = Number(input.scheduleAlertDays);
    if (!Number.isFinite(val) || val < 0 || val > 60) {
      throw new DomainError("Antecedência de alertas deve estar entre 0 e 60 dias.", "VALIDATION");
    }
    data.scheduleAlertDays = Math.round(val);
  }

  if (input.inactivityTimeoutMin !== undefined) {
    const val = Number(input.inactivityTimeoutMin);
    if (!Number.isFinite(val) || val < 5 || val > 480) {
      throw new DomainError("Tempo de inatividade deve estar entre 5 e 480 minutos.", "VALIDATION");
    }
    data.inactivityTimeoutMin = Math.round(val);
  }

  if (input.lateFeePercent !== undefined) {
    const val = Number(input.lateFeePercent);
    if (!Number.isFinite(val) || val < 0 || val > 20) {
      throw new DomainError("Multa por atraso deve estar entre 0% e 20%.", "VALIDATION");
    }
    data.lateFeePercent = val;
  }

  if (input.lateInterestPercent !== undefined) {
    const val = Number(input.lateInterestPercent);
    if (!Number.isFinite(val) || val < 0 || val > 10) {
      throw new DomainError("Juros mensais devem estar entre 0% e 10%.", "VALIDATION");
    }
    data.lateInterestPercent = val;
  }

  const updated = await prisma.studioSetting.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  await prisma.auditLog.create({
    data: {
      action: "STUDIO_SETTINGS_UPDATED",
      entity: "StudioSetting",
      entityId: "default",
      actorId: adminId,
      actorRole: "ADMIN",
      metadata: { updatedFields: Object.keys(data) },
    },
  }).catch(() => null);

  return {
    id: updated.id,
    studioName: updated.studioName,
    technicalLeadName: updated.technicalLeadName,
    technicalLeadReg: updated.technicalLeadReg,
    studioCnpj: updated.studioCnpj,
    pixKey: updated.pixKey,
    pixKeyType: updated.pixKeyType,
    bankInstructions: updated.bankInstructions,
    structuralPartner: updated.structuralPartner,
    commercialAddress: updated.commercialAddress,
    cityState: updated.cityState,
    institutionalEmail: updated.institutionalEmail,
    documentSignature: updated.documentSignature,
    proposalValidityDays: updated.proposalValidityDays,
    lateFeePercent: updated.lateFeePercent,
    lateInterestPercent: updated.lateInterestPercent,
    defaultProposalScope: updated.defaultProposalScope,
    refundPolicyText: updated.refundPolicyText,
    scheduleAlertDays: updated.scheduleAlertDays,
    inactivityTimeoutMin: updated.inactivityTimeoutMin,
    privacyPolicyVersion: updated.privacyPolicyVersion,
    forceLgpdReacceptAt: updated.forceLgpdReacceptAt ? updated.forceLgpdReacceptAt.toISOString() : null,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function updateAdminProfile(
  adminId: string,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    professionalReg?: string;
  }
) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name || name.length < 2) {
    throw new DomainError("Nome de exibição inválido.", "VALIDATION");
  }
  if (!email || !email.includes("@")) {
    throw new DomainError("E-mail institucional inválido.", "VALIDATION");
  }

  const existingEmail = await prisma.user.findFirst({
    where: { email, id: { not: adminId } },
    select: { id: true },
  });
  if (existingEmail) {
    throw new DomainError("Este e-mail já está em uso por outro usuário.", "INTEGRITY");
  }

  const updated = await prisma.user.update({
    where: { id: adminId },
    data: {
      name,
      email,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      professionalReg: input.professionalReg?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      professionalReg: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "ADMIN_PROFILE_UPDATED",
      entity: "User",
      entityId: adminId,
      actorId: adminId,
      actorRole: "ADMIN",
    },
  }).catch(() => null);

  return updated;
}

async function rotateCurrentAdminSessionCookie(adminId: string, newSessionVersion: number) {
  const store = await cookies();
  const currentRawToken = store.get(SESSION_COOKIE)?.value;
  if (currentRawToken) {
    await prisma.session.deleteMany({
      where: { userId: adminId, tokenHash: { not: tokenHash(currentRawToken) } },
    });
    await prisma.session.updateMany({
      where: { userId: adminId, tokenHash: tokenHash(currentRawToken) },
      data: { sessionVersion: newSessionVersion, expiresAt: new Date(Date.now() + SESSION_EXPIRES_MS) },
    });
  } else {
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: tokenHash(token),
        userId: adminId,
        sessionVersion: newSessionVersion,
        expiresAt: new Date(Date.now() + SESSION_EXPIRES_MS),
      },
    });
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
}

export async function changeAdminPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: adminId } });
  if (!user) throw new DomainError("Usuário não encontrado.", "NOT_FOUND");
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw new DomainError("A senha atual informada está incorreta.", "VALIDATION");
  }
  if (newPassword.length < 8) {
    throw new DomainError("A nova senha deve ter pelo menos 8 caracteres.", "VALIDATION");
  }

  const nextVersion = user.sessionVersion + 1;
  await prisma.user.update({
    where: { id: adminId },
    data: {
      passwordHash: hashPassword(newPassword),
      sessionVersion: nextVersion,
      permissionsUpdatedAt: new Date(),
    },
  });

  await rotateCurrentAdminSessionCookie(adminId, nextVersion);

  await prisma.auditLog.create({
    data: {
      action: "ADMIN_PASSWORD_CHANGED",
      entity: "User",
      entityId: adminId,
      actorId: adminId,
      actorRole: "ADMIN",
    },
  }).catch(() => null);

  return { ok: true };
}

export async function revokeOtherSessions(adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: adminId } });
  if (!user) throw new DomainError("Usuário não encontrado.", "NOT_FOUND");

  const nextVersion = user.sessionVersion + 1;
  await prisma.user.update({
    where: { id: adminId },
    data: { sessionVersion: nextVersion, permissionsUpdatedAt: new Date() },
  });

  await rotateCurrentAdminSessionCookie(adminId, nextVersion);

  await prisma.auditLog.create({
    data: {
      action: "ADMIN_OTHER_SESSIONS_REVOKED",
      entity: "User",
      entityId: adminId,
      actorId: adminId,
      actorRole: "ADMIN",
    },
  }).catch(() => null);

  return { ok: true };
}

export async function forceGlobalLgpdReaccept(adminId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.studioSetting.upsert({
      where: { id: "default" },
      create: { id: "default", forceLgpdReacceptAt: now, updatedById: adminId },
      update: { forceLgpdReacceptAt: now, updatedById: adminId },
    }),
    prisma.user.updateMany({
      where: { role: { not: "ADMIN" } },
      data: { consentAcceptedAt: null },
    }),
    prisma.auditLog.create({
      data: {
        action: "GLOBAL_LGPD_REACCEPT_FORCED",
        entity: "StudioSetting",
        entityId: "default",
        actorId: adminId,
        actorRole: "ADMIN",
      },
    }),
  ]);

  return { ok: true, forceLgpdReacceptAt: now.toISOString() };
}

export async function getInfrastructureHealth(): Promise<InfrastructureHealthDTO> {
  const startedAt = Date.now();
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    dbConnected = false;
  }
  const dbLatencyMs = Date.now() - startedAt;

  const [activeSessionsCount, pendingEventsCount, deadLetterCount] = await Promise.all([
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }).catch(() => 0),
    prisma.domainEvent.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.deadLetterEvent.count().catch(() => 0),
  ]);

  return {
    dbConnected,
    dbLatencyMs,
    activeSessionsCount,
    pendingEventsCount,
    deadLetterCount,
    cronJobs: DEFAULT_CRON_JOBS,
  };
}

export async function exportStudioBackup(adminId: string) {
  const [settings, users, clients, projects, stages, deliverables, proposals] = await Promise.all([
    getStudioSettings(),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
        professionalReg: true,
        createdAt: true,
      },
    }),
    prisma.client.findMany(),
    prisma.project.findMany(),
    prisma.scheduleStage.findMany(),
    prisma.projectDeliverable.findMany(),
    prisma.proposal.findMany({ include: { versions: true } }),
  ]);

  await prisma.auditLog.create({
    data: {
      action: "STUDIO_BACKUP_EXPORTED",
      entity: "StudioSetting",
      entityId: "default",
      actorId: adminId,
      actorRole: "ADMIN",
    },
  }).catch(() => null);

  return {
    exportedAt: new Date().toISOString(),
    studio: settings,
    counts: {
      users: users.length,
      clients: clients.length,
      projects: projects.length,
      stages: stages.length,
      deliverables: deliverables.length,
      proposals: proposals.length,
    },
    data: { users, clients, projects, stages, deliverables, proposals },
  };
}
