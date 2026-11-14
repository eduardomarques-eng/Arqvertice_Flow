import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { uploadAcervoRevision } from "@/server/services/acervo-cde-service";
import crypto from "crypto";
import { ProjectDiscipline, ProjectStagePhase, AcervoCategory, AcervoFileType } from "@prisma/client";

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
    const {
      projectId = apiToken.projectId,
      code,
      title,
      discipline = "ARQUITETURA",
      phase = "PROJETO_EXECUTIVO",
      fileName,
      fileUrl,
      fileKey,
      fileSize,
      fileType = "DWG",
      viewUrl,
      viewKey,
      viewFileName,
      viewFileType,
      extractedMetadata,
      softwareSource = "AutoCAD/Revit Plugin",
    } = body;

    if (!projectId || !code || !fileName || !fileUrl) {
      return NextResponse.json(
        {
          error:
            "Parâmetros incompletos. 'projectId', 'code', 'fileName' e 'fileUrl' são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const result = await uploadAcervoRevision({
      projectId,
      code: code.trim().toUpperCase(),
      title: title || code,
      discipline: discipline as ProjectDiscipline,
      phase: phase as ProjectStagePhase,
      category: AcervoCategory.PLANTA_TECNICA_PDF,
      fileName,
      fileUrl,
      fileKey,
      fileSize: fileSize || "Arquivo Nativo",
      fileType: fileType as AcervoFileType,
      viewUrl,
      viewKey,
      viewFileName,
      viewFileType: viewFileType as AcervoFileType,
      description: `Sincronizado automaticamente via plugin (${softwareSource})`,
      uploadedById: apiToken.createdById || undefined,
      performedByName: `${apiToken.name} (Plugin Sync)`,
      performedByRole: "SISTEMA_PLUGIN",
    });

    // Se houver metadados extraídos pelo Revit/AutoCAD (selos, quantitativos), salva na revisão
    if (extractedMetadata) {
      await prisma.acervoRevision.update({
        where: { id: result.revision.id },
        data: { extractedMetadata },
      });
    }

    return NextResponse.json({
      success: true,
      documentId: result.document.id,
      revisionId: result.revision.id,
      revisionNumber: result.revision.revisionNumber,
      status: result.revision.status,
      message: `Prancha ${result.document.code} revisão ${result.revision.revisionNumber} sincronizada com sucesso no Acervo Manager CDE.`,
    });
  } catch (err: unknown) {
    console.error("[ACERVO_SYNC_PLUGIN_ERROR]", err);
    return NextResponse.json(
      { error: "Falha na sincronização via plugin CAD/BIM." },
      { status: 500 }
    );
  }
}
