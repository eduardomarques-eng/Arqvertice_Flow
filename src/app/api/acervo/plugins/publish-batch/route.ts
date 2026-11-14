import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { authenticatePluginRequest } from "@/lib/acervo/plugin-auth";
import { parseAndValidateSheetName } from "@/lib/acervo/naming-engine";
import { normalizeAcervoFileType } from "@/lib/acervo/file-types";
import { uploadAcervoRevision, createAcervoGrd } from "@/server/services/acervo-cde-service";
import {
  AcervoCategory,
  AcervoWorkflowStatus,
  ProjectDiscipline,
  ProjectStagePhase,
  Prisma,
} from "@prisma/client";

interface BatchFileRef {
  fileName: string;
  fileUrl: string;
  fileKey?: string;
  fileSize?: string;
  fileType?: string;
}

interface BatchSheetPayload {
  code: string;
  title?: string;
  discipline?: string;
  phase?: string;
  folderId?: string;
  revisionNotes?: string;
  metadata?: Record<string, unknown>;
  sourceFile: BatchFileRef;
  previewFile?: BatchFileRef;
  attachments?: BatchFileRef[];
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatePluginRequest(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const projectId = (body.projectId as string | undefined) || auth.ctx.tokenProjectId;
    const softwareSource = String(body.softwareSource || auth.ctx.pluginName || "Plugin CAD/BIM");
    const sheets = Array.isArray(body.sheets) ? (body.sheets as BatchSheetPayload[]) : [];

    if (!projectId) {
      return NextResponse.json({ error: "projectId obrigatório." }, { status: 400 });
    }
    if (sheets.length === 0) {
      return NextResponse.json({ error: "Nenhuma prancha informada no lote." }, { status: 400 });
    }

    const namingRule = await prisma.acervoNamingRule.findFirst({
      where: { OR: [{ projectId }, { projectId: null }] },
      orderBy: { createdAt: "desc" },
    });

    const results: Array<{
      code: string;
      status: "PUBLISHED" | "REJECTED";
      revisionId?: string;
      revisionNumber?: string;
      qrVerificationToken?: string;
      error?: string;
    }> = [];

    const publishedRevisionIds: string[] = [];

    for (const sheet of sheets) {
      const rawCode = String(sheet.code || "").trim().toUpperCase();
      if (!rawCode || !sheet.sourceFile?.fileName || !sheet.sourceFile?.fileUrl) {
        results.push({
          code: rawCode || "SEM_CODIGO",
          status: "REJECTED",
          error: "Código da prancha ou sourceFile ausente.",
        });
        continue;
      }

      // Valida máscara de nomenclatura
      const namingValidation = parseAndValidateSheetName(
        sheet.sourceFile.fileName.includes("-") ? sheet.sourceFile.fileName : `${rawCode}-R00`
      );
      if (namingRule?.policy === "STRICT_BLOCK" && !namingValidation.isValid) {
        results.push({
          code: rawCode,
          status: "REJECTED",
          error: `Fora do padrão (${namingRule.mask}): ${namingValidation.error || "Formato inválido"}`,
        });
        continue;
      }

      const fileType = normalizeAcervoFileType(sheet.sourceFile.fileType, sheet.sourceFile.fileName);
      const viewFileType = sheet.previewFile?.fileUrl
        ? normalizeAcervoFileType(sheet.previewFile.fileType, sheet.previewFile.fileName)
        : undefined;

      try {
        const res = await uploadAcervoRevision({
          projectId,
          code: rawCode,
          title: sheet.title || rawCode,
          category: AcervoCategory.PLANTA_TECNICA_PDF,
          discipline: (sheet.discipline as ProjectDiscipline) || ProjectDiscipline.ARQUITETURA,
          phase: (sheet.phase as ProjectStagePhase) || ProjectStagePhase.PROJETO_EXECUTIVO,
          fileName: sheet.sourceFile.fileName,
          fileUrl: sheet.sourceFile.fileUrl,
          fileKey: sheet.sourceFile.fileKey || `plugin/${Date.now()}_${sheet.sourceFile.fileName}`,
          fileSize: sheet.sourceFile.fileSize || "Lote Plugin",
          fileType,
          viewUrl: sheet.previewFile?.fileUrl,
          viewKey: sheet.previewFile?.fileKey,
          viewFileName: sheet.previewFile?.fileName,
          viewFileType,
          description:
            sheet.revisionNotes ||
            `Publicado em lote via ${softwareSource}${sheet.attachments?.length ? ` (+${sheet.attachments.length} anexos)` : ""}`,
          uploadedById: auth.ctx.userId,
          performedByName: `${auth.ctx.userName} (${softwareSource})`,
          performedByRole: auth.ctx.userRole,
        });

        // Marca revisões anteriores como OBSOLETO
        await prisma.acervoRevision.updateMany({
          where: {
            documentId: res.document.id,
            id: { not: res.revision.id },
          },
          data: {
            status: AcervoWorkflowStatus.OBSOLETO,
            isCurrent: false,
          },
        });

        // Armazena anexos multi-formato e metadados no extractedMetadata da revisão
        if (sheet.attachments || sheet.metadata || softwareSource) {
          const metadataPayload: Prisma.InputJsonValue = {
            publishedVia: softwareSource,
            attachments: (sheet.attachments || []) as unknown as Prisma.InputJsonValue,
            metadata: (sheet.metadata || {}) as unknown as Prisma.InputJsonValue,
            publishedAt: new Date().toISOString(),
          };

          await prisma.acervoRevision.update({
            where: { id: res.revision.id },
            data: {
              extractedMetadata: metadataPayload,
            },
          });
        }

        publishedRevisionIds.push(res.revision.id);
        results.push({
          code: rawCode,
          status: "PUBLISHED",
          revisionId: res.revision.id,
          revisionNumber: res.revision.revisionNumber,
          qrVerificationToken: res.revision.qrVerificationToken || undefined,
        });
      } catch (err) {
        results.push({
          code: rawCode,
          status: "REJECTED",
          error: err instanceof Error ? err.message : "Erro ao gravar revisão.",
        });
      }
    }

    // Emite GRD consolidando todo o lote enviado
    let grd: { id: string; code: string } | null = null;
    if (publishedRevisionIds.length > 0) {
      const issuedGrd = await createAcervoGrd({
        projectId,
        revisionIds: publishedRevisionIds,
        recipientName: "Coordenação Técnica (Esteira CDE)",
        recipientOrg: softwareSource,
        subject: `Publicação em Lote (${publishedRevisionIds.length} pranchas) — ${softwareSource}`,
        notes: `GRD emitida automaticamente via publicação em lote (${softwareSource})`,
        createdById: auth.ctx.userId,
      });
      grd = { id: issuedGrd.id, code: issuedGrd.code };
    }

    return NextResponse.json({
      success: true,
      softwareSource,
      publishedCount: publishedRevisionIds.length,
      rejectedCount: results.filter((r) => r.status === "REJECTED").length,
      grdCode: grd?.code || null,
      grdId: grd?.id || null,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha na publicação em lote do plugin." },
      { status: 500 }
    );
  }
}
