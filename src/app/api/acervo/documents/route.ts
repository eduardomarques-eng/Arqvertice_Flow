import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { uploadAcervoRevision } from "@/server/services/acervo-cde-service";
import { parseAndValidateSheetName } from "@/lib/acervo/naming-engine";
import { ProjectDiscipline, ProjectStagePhase, AcervoCategory } from "@prisma/client";

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
    } = body;

    if (!projectId || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: "Dados incompletos: projectId, fileName e fileUrl são obrigatórios." },
        { status: 400 }
      );
    }

    // Validação de Nomenclatura CDE
    const namingParsed = parseAndValidateSheetName(fileName);
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
      fileType,
      viewUrl,
      viewKey,
      viewFileName,
      viewFileType,
      description,
      uploadedById: user.id,
      performedByName: user.name,
      performedByRole: user.role,
    });

    return NextResponse.json({
      success: true,
      document: result.document,
      revision: result.revision,
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
