import { prisma } from "@/server/db";
import {
  AcervoWorkflowStatus,
  AcervoFileType,
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
  DeliverableType,
  ApprovalStatus,
} from "@prisma/client";
import { getNextRevisionNumber, parseAndValidateSheetName } from "@/lib/acervo/naming-engine";

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
  return prisma.$transaction(async (tx) => {
    const year = new Date().getFullYear();
    const countThisYear = await tx.acervoGrd.count({
      where: {
        code: { startsWith: `GRD-${year}-` },
      },
    });

    const nextSeq = (countThisYear + 1).toString().padStart(4, "0");
    const grdCode = `GRD-${year}-${nextSeq}`;
    const hashToken = `grd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Busca detalhes das revisões para o snapshot
    const revisions = await tx.acervoRevision.findMany({
      where: { id: { in: revisionIds } },
      include: { document: true },
    });

    const grd = await tx.acervoGrd.create({
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
        project: { select: { id: true, name: true } },
      },
    });

    return grd;
  });
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
