import { prisma } from "@/server/db";
import {
  AcervoWorkflowStatus,
  AcervoFileType,
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
  DeliverableType,
  ApprovalStatus,
  Prisma,
} from "@prisma/client";
import { getNextRevisionNumber, parseAndValidateSheetName } from "@/lib/acervo/naming-engine";
import { appUrl } from "@/lib/email";
import { sendEmail } from "@/server/services/email-service";
import { buildArqVerticeEmailTemplate } from "@/lib/email/resend-service";
import {
  resolveOfficialGatewayConfig,
  sendViaOfficialGateway,
} from "@/lib/whatsapp/gateway-client";

/**
 * Cria ou registra nova versão de prancha/documento no CDE
 */
export async function uploadAcervoRevision({
  projectId,
  code,
  title,
  discipline,
  phase = "PROJETO_EXECUTIVO",
  category = "PLANTA_TECNICA_PDF",
  fileName,
  fileUrl,
  fileKey,
  fileSize,
  fileType = "PDF",
  viewUrl,
  viewKey,
  viewFileName,
  viewFileType,
  description,
  uploadedById,
  performedByName,
  performedByRole,
}: {
  projectId: string;
  code: string;
  title: string;
  discipline: ProjectDiscipline;
  phase?: ProjectStagePhase;
  category?: AcervoCategory;
  fileName: string;
  fileUrl: string;
  fileKey?: string;
  fileSize?: string;
  fileType?: AcervoFileType;
  viewUrl?: string;
  viewKey?: string;
  viewFileName?: string;
  viewFileType?: AcervoFileType;
  description?: string;
  uploadedById?: string;
  performedByName: string;
  performedByRole: string;
}) {
  return prisma.$transaction(async (tx) => {
    // 1. Busca documento existente ou cria novo
    let doc = await tx.acervoDocument.findUnique({
      where: {
        projectId_code: {
          projectId,
          code: code.trim().toUpperCase(),
        },
      },
      include: {
        revisions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    let nextRev = "R00";

    if (!doc) {
      doc = await tx.acervoDocument.create({
        data: {
          projectId,
          code: code.trim().toUpperCase(),
          title,
          discipline,
          phase,
          category,
        },
        include: {
          revisions: true,
        },
      });
    } else if (doc.revisions.length > 0) {
      // Já existe documento: calcula próxima revisão e marca anterior como não corrente
      nextRev = getNextRevisionNumber(doc.revisions[0].revisionNumber);

      // Marca todas as revisões anteriores como não vigentes e obsoletas se necessário
      await tx.acervoRevision.updateMany({
        where: { documentId: doc.id },
        data: { isCurrent: false },
      });
    }

    // 2. Cria nova revisão vigente (por padrão inicia como EM_ELABORACAO ou EM_REVISAO_TECNICA)
    const newRevision = await tx.acervoRevision.create({
      data: {
        documentId: doc.id,
        revisionNumber: nextRev,
        isCurrent: true,
        status: AcervoWorkflowStatus.EM_REVISAO_TECNICA,
        fileName,
        fileUrl,
        fileKey,
        fileSize,
        fileType,
        viewUrl,
        viewKey,
        viewFileName,
        viewFileType,
        description,
        uploadedById,
      },
    });

    // 3. Atualiza ponteiro de revisão vigente no documento
    await tx.acervoDocument.update({
      where: { id: doc.id },
      data: { currentRevisionId: newRevision.id, updatedAt: new Date() },
    });

    // 4. Grava log de auditoria do workflow
    await tx.acervoWorkflowLog.create({
      data: {
        revisionId: newRevision.id,
        fromStatus: null,
        toStatus: AcervoWorkflowStatus.EM_REVISAO_TECNICA,
        action: "UPLOAD_NOVA_REVISAO",
        notes: `Upload da revisão ${nextRev} por ${performedByName}.`,
        performedById: uploadedById,
        performedByName,
        performedByRole,
      },
    });

    return { document: doc, revision: newRevision };
  });
}

/**
 * Transição de status da revisão (Workflow CDE)
 * Quando atinge BOM_PARA_OBRA:
 * 1. Marca versões anteriores do documento como OBSOLETO
 * 2. Sincroniza automaticamente com o ProjectDeliverable (Portal do Cliente)
 */
export async function transitionAcervoWorkflow({
  revisionId,
  toStatus,
  action,
  notes,
  performedById,
  performedByName,
  performedByRole,
}: {
  revisionId: string;
  toStatus: AcervoWorkflowStatus;
  action: string;
  notes?: string;
  performedById?: string;
  performedByName: string;
  performedByRole: string;
}) {
  return prisma.$transaction(async (tx) => {
    const revision = await tx.acervoRevision.findUniqueOrThrow({
      where: { id: revisionId },
      include: {
        document: {
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    const fromStatus = revision.status;

    // Atualiza status da revisão
    const updatedRevision = await tx.acervoRevision.update({
      where: { id: revisionId },
      data: {
        status: toStatus,
        updatedAt: new Date(),
      },
    });

    // Registra trilha de auditoria
    await tx.acervoWorkflowLog.create({
      data: {
        revisionId,
        fromStatus,
        toStatus,
        action,
        notes: notes || `Transição de ${fromStatus} para ${toStatus}`,
        performedById,
        performedByName,
        performedByRole,
      },
    });

    // Se promovido a BOM_PARA_OBRA:
    if (toStatus === AcervoWorkflowStatus.BOM_PARA_OBRA) {
      // 1. Marca revisões anteriores como OBSOLETO
      await tx.acervoRevision.updateMany({
        where: {
          documentId: revision.documentId,
          id: { not: revisionId },
        },
        data: {
          status: AcervoWorkflowStatus.OBSOLETO,
          isCurrent: false,
        },
      });

      // 2. Sincroniza automaticamente com ProjectDeliverable (Portal do Cliente)
      const existingDeliverable = await tx.projectDeliverable.findFirst({
        where: {
          projectId: revision.document.projectId,
          sheetCode: revision.document.code,
        },
      });

      if (existingDeliverable) {
        await tx.projectDeliverable.update({
          where: { id: existingDeliverable.id },
          data: {
            title: revision.document.title,
            fileUrl: revision.fileUrl,
            fileSize: revision.fileSize,
            version: revision.revisionNumber,
            discipline: revision.document.discipline,
            phaseFolder: revision.document.phase,
            status: ApprovalStatus.APROVADO_INTERNO,
            isClientView: true,
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.projectDeliverable.create({
          data: {
            projectId: revision.document.projectId,
            sheetCode: revision.document.code,
            title: revision.document.title,
            subject: revision.document.title,
            fileUrl: revision.fileUrl,
            fileSize: revision.fileSize,
            version: revision.revisionNumber,
            discipline: revision.document.discipline,
            phaseFolder: revision.document.phase,
            type: DeliverableType.PRANCHA_EXECUTIVA,
            category: revision.document.category,
            status: ApprovalStatus.APROVADO_INTERNO,
            isClientView: true,
            isRequired: true,
          },
        });
      }
    }

    return updatedRevision;
  });
}

/**
 * Emissão de Guia de Remessa de Documentos (GRD) com protocolo rastreável
 */
export async function createAcervoGrd({
  projectId,
  recipientName,
  recipientEmail,
  recipientOrg,
  subject,
  notes,
  revisionIds,
  createdById,
}: {
  projectId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientOrg?: string;
  subject: string;
  notes?: string;
  revisionIds: string[];
  createdById?: string;
}) {
  const grd = await prisma.$transaction(async (tx) => {
    const year = new Date().getFullYear();
    const countThisYear = await tx.acervoGrd.count({
      where: {
        code: { startsWith: `GRD-${year}-` },
      },
    });

    const nextSeq = (countThisYear + 1).toString().padStart(4, "0");
    const grdCode = `GRD-${year}-${nextSeq}`;
    const hashToken = `grd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Busca detalhes das revisões estritamente do projeto selecionado (anti-BOLA)
    const revisions = await tx.acervoRevision.findMany({
      where: {
        id: { in: revisionIds },
        document: { projectId },
      },
      include: { document: true },
    });

    if (revisions.length === 0 || revisions.length !== revisionIds.length) {
      throw new Error("Uma ou mais revisões informadas não pertencem ao empreendimento selecionado.");
    }

    return tx.acervoGrd.create({
      data: {
        code: grdCode,
        projectId,
        recipientName,
        recipientEmail,
        recipientOrg,
        subject,
        notes,
        hashToken,
        createdById,
        items: {
          create: revisions.map((rev) => ({
            revisionId: rev.id,
            documentCode: rev.document.code,
            documentTitle: rev.document.title,
            revisionNumber: rev.revisionNumber,
            statusAtIssue: rev.status,
            fileUrl: rev.fileUrl,
          })),
        },
      },
      include: {
        items: true,
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
  });

  const cleanEmail = recipientEmail?.trim();
  const basePortalUrl = `${appUrl()}/equipe/acervo/${projectId}`;
  const itemsLines = grd.items.map(
    (it) =>
      `• ${it.documentCode} (${it.revisionNumber} · ${it.statusAtIssue}) — ${it.documentTitle}${it.fileUrl ? ` | Arquivo: ${it.fileUrl}` : ""}`
  );
  const grdSummaryBody = [
    `Foi emitida a Guia de Remessa de Documentos ${grd.code} para o empreendimento ${grd.project.name}.`,
    `Assunto: ${subject}`,
    ...(recipientOrg ? [`Organização: ${recipientOrg}`] : []),
    ...(notes ? [`Observações: ${notes}`] : []),
    "",
    `Pranchas e documentos incluídos (${grd.items.length}):`,
    ...itemsLines,
    "",
    `Acesse o Acervo CDE: ${basePortalUrl}`,
  ].join("\n");

  if (cleanEmail) {
    await sendEmail({
      to: cleanEmail,
      subject: `[${grd.code}] ${subject} — ${grd.project.name}`,
      text: grdSummaryBody,
      html: buildArqVerticeEmailTemplate({
        recipientName,
        category: "Acervo Técnico · GRD",
        projectName: grd.project.name,
        messageBody: grdSummaryBody,
      }),
      eventType: "message.sent",
      entityType: "AcervoGrd",
      entityId: grd.id,
    }).catch(() => undefined);
  }

  const gwCfg = await resolveOfficialGatewayConfig().catch(() => null);
  const clientPhone = grd.project.client?.phone?.trim();
  if (gwCfg?.autoNotifyAcervo && clientPhone) {
    await sendViaOfficialGateway({
      phone: clientPhone,
      message: `Olá, ${grd.project.client?.name || recipientName}! Emitimos a ${grd.code} com ${grd.items.length} documento(s) técnicos do projeto ${grd.project.name}.`,
    }).catch(() => undefined);
  }

  return grd;
}

/**
 * Calcula indicadores executivos (KPIs) do CDE para o painel gerencial
 */
export async function getAcervoExecutiveKpis() {
  const [openRfis, overdueRfis, approvedRevisions] = await Promise.all([
    prisma.acervoRfiMarkup.count({
      where: { status: "ABERTA" },
    }),
    prisma.acervoRfiMarkup.count({
      where: {
        status: "ABERTA",
        createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    }),
    prisma.acervoRevision.findMany({
      where: {
        status: { in: [AcervoWorkflowStatus.BOM_PARA_OBRA, AcervoWorkflowStatus.APROVADO_OBRA] },
      },
      select: { createdAt: true, updatedAt: true },
      take: 100,
    }),
  ]);

  let avgSlaHours = 0;
  if (approvedRevisions.length > 0) {
    const totalMs = approvedRevisions.reduce(
      (acc, r) => acc + Math.max(0, r.updatedAt.getTime() - r.createdAt.getTime()),
      0
    );
    avgSlaHours = Math.round(totalMs / approvedRevisions.length / (1000 * 60 * 60));
  }

  const slaFormatted =
    avgSlaHours >= 24
      ? `${(avgSlaHours / 24).toFixed(1)} dias`
      : `${avgSlaHours || 12} horas`;

  return {
    openRfis,
    overdueRfis,
    slaFormatted,
  };
}

/**
 * Carrega dados completos do Workspace 3 Zonas para /admin/acervo/[projectId] e /equipe/acervo/[projectId]
 */
export async function getAcervoProjectWorkspaceData(projectId: string) {
  const [rawProject, activeTokensCount] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { name: true } },
        acervoNamingRules: true,
        acervoDocuments: {
          include: {
            revisions: {
              orderBy: { createdAt: "desc" },
              include: {
                workflowLogs: { orderBy: { createdAt: "desc" } },
                rfis: {
                  orderBy: { createdAt: "asc" },
                  include: {
                    createdBy: { select: { name: true, role: true } },
                  },
                },
              },
            },
          },
          orderBy: [{ discipline: "asc" }, { code: "asc" }],
        },
        acervoGrds: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
      },
    }),
    prisma.acervoApiToken.count({
      where: { projectId, revokedAt: null },
    }),
  ]);

  if (!rawProject) return null;

  return {
    id: rawProject.id,
    name: rawProject.name,
    clientName: rawProject.client?.name || "Geral",
    activeTokensCount,
    namingRules: rawProject.acervoNamingRules.map((r) => ({
      id: r.id,
      mask: r.mask,
      example: r.example,
      policy: r.policy,
    })),
    documents: rawProject.acervoDocuments.map((doc) => ({
      id: doc.id,
      code: doc.code,
      title: doc.title,
      discipline: doc.discipline,
      phase: doc.phase,
      revisions: doc.revisions.map((rev) => ({
        id: rev.id,
        revisionNumber: rev.revisionNumber,
        status: rev.status,
        fileName: rev.fileName,
        fileUrl: rev.fileUrl,
        fileSize: rev.fileSize,
        fileType: rev.fileType,
        viewUrl: rev.viewUrl,
        viewFileName: rev.viewFileName,
        viewFileType: rev.viewFileType,
        digitalStampHash: rev.digitalStampHash,
        qrVerificationToken: rev.qrVerificationToken,
        extractedMetadata: rev.extractedMetadata,
        isCurrent: rev.isCurrent,
        createdAt: rev.createdAt.toISOString(),
        workflowLogs: rev.workflowLogs.map((log) => ({
          id: log.id,
          action: log.action,
          fromStatus: log.fromStatus,
          toStatus: log.toStatus,
          performedByName: log.performedByName,
          performedByRole: log.performedByRole,
          createdAt: log.createdAt.toISOString(),
        })),
        rfis: rev.rfis.map((rfi) => ({
          id: rfi.id,
          code: rfi.code,
          title: rfi.title,
          description: rfi.description,
          status: rfi.status,
          markupType: rfi.markupType,
          coordX: rfi.coordX,
          coordY: rfi.coordY,
          pageNumber: rfi.pageNumber,
          geometryJson: typeof rfi.geometryJson === "string" ? rfi.geometryJson : rfi.geometryJson ? JSON.stringify(rfi.geometryJson) : null,
          cameraState: (rfi.cameraState as {
            position: [number, number, number];
            target: [number, number, number];
            pinPosition?: [number, number, number];
          } | null) ?? null,
          answer: rfi.answer,
          createdAt: rfi.createdAt.toISOString(),
          createdBy: rfi.createdBy,
        })),
      })),
    })),
    grds: rawProject.acervoGrds.map((g) => ({
      id: g.id,
      code: g.code,
      recipientName: g.recipientName,
      recipientOrg: g.recipientOrg,
      createdAt: g.createdAt.toISOString(),
      itemsCount: g.items.length,
    })),
  };
}
