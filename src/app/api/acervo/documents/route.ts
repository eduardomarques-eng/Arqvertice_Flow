import { NextResponse } from "next/server";
import { canUserAccessProject, currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { uploadAcervoRevision, createAcervoGrd } from "@/server/services/acervo-cde-service";
import { parseAndValidateSheetName } from "@/lib/acervo/naming-engine";
import { normalizeAcervoFileType } from "@/lib/acervo/file-types";
import {
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
  AcervoWorkflowStatus,
} from "@prisma/client";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      code,
      title,
      discipline = "ARQUITETURA",
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
      emitAutoGrd = true,
    } = body;

    if (!projectId || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: "Dados incompletos: projectId, fileName e fileUrl são obrigatórios." },
        { status: 400 }
      );
    }

    const hasAccess = await canUserAccessProject(user, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Você não possui acesso habilitado a este empreendimento no Acervo Manager." },
        { status: 403 }
      );
    }

    if (user.role !== "ADMIN") {
      const perm = await prisma.acervoDisciplinePermission.findFirst({
        where: {
          userId: user.id,
          discipline: discipline as ProjectDiscipline,
          OR: [{ projectId }, { projectId: null }],
        },
      });
      if (perm && !perm.canUploadRevision) {
        return NextResponse.json(
          {
            error: `Permissão restrita: seu usuário não possui autorização de envio (upload) para a disciplina ${discipline}.`,
          },
          { status: 403 }
        );
      }
    }

    // Valida regra de nomenclatura CDE do projeto
    const namingParsed = parseAndValidateSheetName(fileName);
    const namingRule = await prisma.acervoNamingRule.findFirst({
      where: { projectId },
    });

    if (namingRule?.policy === "STRICT_BLOCK" && !namingParsed.isValid) {
      return NextResponse.json(
        {
          error: namingParsed.error || "Nome do arquivo fora da máscara CDE obrigatória.",
          expectedExample: namingRule.example,
        },
        { status: 422 }
      );
    }

    const finalCode = (code || namingParsed.fullCode || "DOC-001").trim().toUpperCase();
    const finalTitle = (title || fileName.replace(/\.[^/.]+$/, "")).trim();

    const result = await uploadAcervoRevision({
      projectId,
      code: finalCode,
      title: finalTitle,
      discipline: discipline as ProjectDiscipline,
      phase: phase as ProjectStagePhase,
      category: category as AcervoCategory,
      fileName,
      fileUrl,
      fileKey,
      fileSize,
      fileType: normalizeAcervoFileType(fileType, fileName),
      viewUrl,
      viewKey,
      viewFileName,
      viewFileType: viewUrl ? normalizeAcervoFileType(viewFileType, viewFileName) : undefined,
      description,
      uploadedById: user.id,
      performedByName: user.name,
      performedByRole: user.role,
    });

    // Move revisões anteriores para OBSOLETO
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

    // Emite GRD automática quando solicitado
    let grdCode: string | null = null;
    if (emitAutoGrd) {
      const grd = await createAcervoGrd({
        projectId,
        recipientName: user.name || "Coordenação CDE",
        recipientOrg: "Estúdio ArqVértice",
        subject: `Emissão de Revisão ${finalCode} (${result.revision.revisionNumber})`,
        notes: `GRD automática gerada no upload da revisão ${result.revision.revisionNumber}.`,
        revisionIds: [result.revision.id],
        createdById: user.id,
      });
      grdCode = grd.code;
    }

    return NextResponse.json({
      success: true,
      document: result.document,
      revision: result.revision,
      grdCode,
      namingNotice: namingParsed.isValid ? null : namingParsed.error,
    });
  } catch (err: unknown) {
    console.error("[ACERVO_DOCUMENTS_POST_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao registrar documento no Acervo Manager." },
      { status: 500 }
    );
  }
}
