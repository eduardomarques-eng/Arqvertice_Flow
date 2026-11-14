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
import { getNextRevisionNumber } from "@/lib/acervo/naming-engine";
import crypto from "crypto";

/**
 * Upload de nova prancha/revisão com geração de GRD automática e QR code de rastreabilidade
 */
export async function uploadAcervoRevisionWithGrd({
  projectId,
  folderId,
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
  recipientName = "Coordenação de Projetos",
  recipientOrg = "ArqVértice Studio",
}: {
  projectId: string;
  folderId?: string;
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
  recipientName?: string;
  recipientOrg?: string;
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
          folderId,
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
      nextRev = getNextRevisionNumber(doc.revisions[0].revisionNumber);

      // Marca revisão anterior como não vigente
      await tx.acervoRevision.updateMany({
        where: { documentId: doc.id },
        data: { isCurrent: false },
      });
    }

    // Token único de verificação (QR Code)
    const qrVerificationToken = `cde_qr_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    // 2. Cria nova revisão em status EM_ANALISE
    const newRevision = await tx.acervoRevision.create({
      data: {
        documentId: doc.id,
        revisionNumber: nextRev,
        isCurrent: true,
        status: AcervoWorkflowStatus.EM_ANALISE,
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
        qrVerificationToken,
        uploadedById,
      },
    });

    // 3. Atualiza ponteiro de revisão no documento
    await tx.acervoDocument.update({
      where: { id: doc.id },
      data: { currentRevisionId: newRevision.id, updatedAt: new Date() },
    });

    // 4. Log de auditoria
    await tx.acervoWorkflowLog.create({
      data: {
        revisionId: newRevision.id,
        fromStatus: null,
        toStatus: AcervoWorkflowStatus.EM_ANALISE,
        action: "EMISSAO_REMESSA_GRD",
        notes: `Upload da revisão ${nextRev} por ${performedByName}. Arquivo em análise de conformidade técnica.`,
        performedById: uploadedById,
        performedByName,
        performedByRole,
      },
    });

    // 5. Geração automática de GRD numerada (GRD-YYYY-NNNN)
    const year = new Date().getFullYear();
    const countThisYear = await tx.acervoGrd.count({
      where: { code: { startsWith: `GRD-${year}-` } },
    });
    const grdSeq = (countThisYear + 1).toString().padStart(4, "0");
    const grdCode = `GRD-${year}-${grdSeq}`;
    const hashToken = `grd_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    const grd = await tx.acervoGrd.create({
      data: {
        code: grdCode,
        projectId,
        recipientName,
        recipientOrg,
        subject: `Emissão de Remessa CDE — Prancha ${doc.code} ${nextRev}`,
        notes: `Remessa gerada automaticamente no ato do upload pelo projetista ${performedByName}.`,
        hashToken,
        createdById: uploadedById,
        items: {
          create: [
            {
              revisionId: newRevision.id,
              documentCode: doc.code,
              documentTitle: doc.title,
              revisionNumber: nextRev,
              statusAtIssue: "EM_ANALISE",
              fileUrl: newRevision.fileUrl,
            },
          ],
        },
      },
    });

    return { document: doc, revision: newRevision, grd };
  });
}

/**
 * Esteira de Parecer & Carimbo Digital de Liberação para Obra
 */
export async function applyDigitalStampAndApprove({
  revisionId,
  decision, // APROVADO_OBRA | APROVADO_RESSALVAS | REPROVADO
  notes,
  performedById,
  performedByName,
  performedByRole,
}: {
  revisionId: string;
  decision: "APROVADO_OBRA" | "APROVADO_RESSALVAS" | "REPROVADO";
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

    const now = new Date();
    const targetStatus =
      decision === "APROVADO_OBRA"
        ? AcervoWorkflowStatus.BOM_PARA_OBRA
        : decision === "APROVADO_RESSALVAS"
        ? AcervoWorkflowStatus.APROVADO_RESSALVAS
        : AcervoWorkflowStatus.REPROVADO;

    // Gera hash digital do carimbo criptográfico
    const stampPayload = `${revision.document.code}-${revision.revisionNumber}-${targetStatus}-${performedByName}-${now.toISOString()}`;
    const digitalStampHash = crypto.createHash("sha256").update(stampPayload).digest("hex");

    const updated = await tx.acervoRevision.update({
      where: { id: revisionId },
      data: {
        status: targetStatus,
        digitalStampHash,
        approvedForWorkAt: decision === "APROVADO_OBRA" ? now : undefined,
        approvedForWorkById: decision === "APROVADO_OBRA" ? performedById : undefined,
        updatedAt: now,
      },
    });

    // Trilha de auditoria
    await tx.acervoWorkflowLog.create({
      data: {
        revisionId,
        fromStatus: revision.status,
        toStatus: targetStatus,
        action: `PARECER_CARIMBO_${decision}`,
        notes: notes || `Parecer técnico: ${decision}. Hash do Carimbo: ${digitalStampHash.slice(0, 16)}...`,
        performedById,
        performedByName,
        performedByRole,
      },
    });

    // Se aprovado para obra:
    if (decision === "APROVADO_OBRA") {
      // 1. Marca anteriores como OBSOLETO
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

      // 2. Sincroniza com o Portal do Cliente (ProjectDeliverable)
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
            updatedAt: now,
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

    return updated;
  });
}
