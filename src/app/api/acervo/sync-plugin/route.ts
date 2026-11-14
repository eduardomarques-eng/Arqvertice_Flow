import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { uploadAcervoRevision, createAcervoGrd } from "@/server/services/acervo-cde-service";
import { parseAndValidateSheetName } from "@/lib/acervo/naming-engine";
import { normalizeAcervoFileType } from "@/lib/acervo/file-types";
import crypto from "crypto";
import {
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
  AcervoWorkflowStatus,
} from "@prisma/client";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Autenticação requerida via Bearer Token." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Valida Token CDE
    const apiToken = await prisma.acervoApiToken.findUnique({
      where: { tokenHash },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!apiToken || apiToken.revokedAt) {
      return NextResponse.json(
        { error: "Token de API inválido ou revogado." },
        { status: 403 }
      );
    }

    if (apiToken.expiresAt && new Date() > apiToken.expiresAt) {
      return NextResponse.json(
        { error: "Token de API expirado." },
        { status: 403 }
      );
    }

    // Atualiza lastUsedAt do token
    await prisma.acervoApiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    });

    const body = await request.json();

    // Suporta tanto payload estruturado (sourceFile/previewFile/metadata) quanto payload plano
    const sourceFile = body.sourceFile as
      | { fileName?: string; fileUrl?: string; fileKey?: string; fileSize?: string; fileType?: string }
      | undefined;
    const previewFile = body.previewFile as
      | { fileName?: string; fileUrl?: string; fileKey?: string; fileType?: string }
      | undefined;

    const projectCodeInput = (body.projectCode as string | undefined)?.trim();
    let resolvedProjectId = (body.projectId as string | undefined) || apiToken.projectId;

    if (!resolvedProjectId && projectCodeInput) {
      const foundProject = await prisma.project.findFirst({
        where: {
          OR: [
            { id: projectCodeInput },
            { name: { contains: projectCodeInput, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (foundProject) {
        resolvedProjectId = foundProject.id;
      }
    }

    const fileName = sourceFile?.fileName || (body.fileName as string | undefined);
    const fileUrl = sourceFile?.fileUrl || (body.fileUrl as string | undefined);
    const fileKey = sourceFile?.fileKey || (body.fileKey as string | undefined);
    const fileSize = sourceFile?.fileSize || (body.fileSize as string | undefined);
    const fileType = normalizeAcervoFileType(sourceFile?.fileType || (body.fileType as string | undefined) || "DWG", fileName);

    const viewUrl = previewFile?.fileUrl || (body.viewUrl as string | undefined);
    const viewKey = previewFile?.fileKey || (body.viewKey as string | undefined);
    const viewFileName = previewFile?.fileName || (body.viewFileName as string | undefined);
    const viewFileType = viewUrl
      ? normalizeAcervoFileType(previewFile?.fileType || (body.viewFileType as string | undefined), viewFileName)
      : undefined;

    const rawCode = (body.code as string | undefined) || (fileName ? fileName.replace(/\.[^/.]+$/, "") : undefined);
    const discipline = (body.discipline || "ARQUITETURA") as ProjectDiscipline;
    const phase = (body.phase || "PROJETO_EXECUTIVO") as ProjectStagePhase;
    const softwareSource = (body.softwareSource as string | undefined) || "AutoCAD/Revit Plugin";
    const metadata = body.metadata ?? body.extractedMetadata;
    const title = (body.title as string | undefined) || (metadata?.title as string | undefined) || rawCode;

    if (!resolvedProjectId || !rawCode || !fileName || !fileUrl) {
      return NextResponse.json(
        {
          error:
            "Parâmetros incompletos. 'projectId'/'projectCode', 'code' (ou 'fileName') e 'sourceFile.fileUrl' são obrigatórios.",
        },
        { status: 400 }
      );
    }

    // Valida regra de nomenclatura caso o projeto possua bloqueio configurado
    const namingRule = await prisma.acervoNamingRule.findFirst({
      where: { projectId: resolvedProjectId },
    });

    if (namingRule?.policy === "STRICT_BLOCK") {
      const parsed = parseAndValidateSheetName(fileName, projectCodeInput);
      if (!parsed.isValid) {
        return NextResponse.json(
          {
            error: parsed.error || "Nome do arquivo fora da máscara CDE obrigatória do empreendimento.",
            expectedExample: namingRule.example,
          },
          { status: 422 }
        );
      }
    }

    const normalizedCode = rawCode.trim().toUpperCase();

    const result = await uploadAcervoRevision({
      projectId: resolvedProjectId,
      code: normalizedCode,
      title: title || normalizedCode,
      discipline,
      phase,
      category: AcervoCategory.PLANTA_TECNICA_PDF,
      fileName,
      fileUrl,
      fileKey,
      fileSize: fileSize || "Arquivo Nativo",
      fileType,
      viewUrl,
      viewKey,
      viewFileName,
      viewFileType,
      description: `Sincronizado automaticamente via plugin (${softwareSource})`,
      uploadedById: apiToken.createdById || undefined,
      performedByName: `${apiToken.name} (Plugin Sync)`,
      performedByRole: "SISTEMA_PLUGIN",
    });

    // Marca revisões anteriores deste documento como OBSOLETO
    await prisma.acervoRevision.updateMany({
      where: {
        documentId: result.document.id,
        id: { not: result.revision.id },
      },
      data: {
        status: AcervoWorkflowStatus.OBSOLETO,
        isCurrent: false,
      },
    });

    // Se houver metadados do carimbo extraídos pelo Revit/AutoCAD, salva na revisão
    if (metadata) {
      const serialized = typeof metadata === "string" ? metadata : JSON.stringify(metadata);
      await prisma.acervoRevision.update({
        where: { id: result.revision.id },
        data: { extractedMetadata: serialized },
      });
    }

    // Emite Guia de Remessa (GRD) automática para a sincronização
    const grd = await createAcervoGrd({
      projectId: resolvedProjectId,
      recipientName: apiToken.createdBy?.name || "Coordenação CDE",
      recipientOrg: softwareSource,
      subject: `Sincronização Automática ${normalizedCode} (${result.revision.revisionNumber})`,
      notes: `GRD emitida automaticamente via ${softwareSource} (Token: ${apiToken.name}).`,
      revisionIds: [result.revision.id],
      createdById: apiToken.createdById || undefined,
    });

    return NextResponse.json({
      success: true,
      documentId: result.document.id,
      revisionId: result.revision.id,
      revisionNumber: result.revision.revisionNumber,
      status: result.revision.status,
      grdCode: grd.code,
      message: `Prancha ${result.document.code} revisão ${result.revision.revisionNumber} sincronizada com GRD ${grd.code} no Acervo Manager CDE.`,
    });
  } catch (err: unknown) {
    console.error("[ACERVO_SYNC_PLUGIN_ERROR]", err);
    return NextResponse.json(
      { error: "Falha na sincronização via plugin CAD/BIM." },
      { status: 500 }
    );
  }
}
