import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { uploadAcervoRevisionWithGrd } from "@/server/services/acervo-stamp-service";
import { parseAndValidateSheetName } from "@/lib/acervo/naming-engine";
import { ProjectDiscipline, ProjectStagePhase, AcervoCategory, AcervoFileType } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      folderId,
      code,
      title,
      discipline = "ARQUITETURA",
      phase = "PROJETO_EXECUTIVO",
      fileName,
      fileUrl,
      fileKey,
      fileSize,
      fileType = "PDF",
      viewUrl,
      viewKey,
      viewFileName,
      viewFileType,
      recipientName,
      recipientOrg,
    } = body;

    if (!projectId || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: "Dados incompletos: projectId, fileName e fileUrl são obrigatórios." },
        { status: 400 }
      );
    }

    // Validação estrita de Nomenclatura CDE
    const namingParsed = parseAndValidateSheetName(fileName);
    const finalCode = (code || namingParsed.fullCode || "DOC-001").trim().toUpperCase();
    const finalTitle = (title || fileName.replace(/\.[^/.]+$/, "")).trim();

    const result = await uploadAcervoRevisionWithGrd({
      projectId,
      folderId,
      code: finalCode,
      title: finalTitle,
      discipline: discipline as ProjectDiscipline,
      phase: phase as ProjectStagePhase,
      category: AcervoCategory.PLANTA_TECNICA_PDF,
      fileName,
      fileUrl,
      fileKey,
      fileSize,
      fileType: fileType as AcervoFileType,
      viewUrl,
      viewKey,
      viewFileName,
      viewFileType: viewFileType as AcervoFileType,
      description: `Remessa técnica CDE com validação de máscara e emissão automática de GRD`,
      uploadedById: user.id,
      performedByName: user.name,
      performedByRole: user.role,
      recipientName,
      recipientOrg,
    });

    return NextResponse.json({
      success: true,
      document: result.document,
      revision: result.revision,
      grd: result.grd,
      namingNotice: namingParsed.isValid ? null : namingParsed.error,
    });
  } catch (err: unknown) {
    console.error("[ACERVO_UPLOAD_GRD_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao processar upload e remessa CDE." },
      { status: 500 }
    );
  }
}
