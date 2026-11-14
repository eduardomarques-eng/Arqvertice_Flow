import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { AcervoWorkflowStatus } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason");

    const revision = await prisma.acervoRevision.findUnique({
      where: { id },
      include: {
        document: {
          select: {
            code: true,
            title: true,
            projectId: true,
          },
        },
      },
    });

    if (!revision) {
      return NextResponse.json(
        { error: "Revisão não encontrada." },
        { status: 404 }
      );
    }

    // Regra CDE Estrita de Obsolescência:
    // Se o arquivo for OBSOLETO:
    // - Usuários comuns não podem baixar.
    // - Administrador pode baixar mediante registro de justificativa em log.
    if (revision.status === AcervoWorkflowStatus.OBSOLETO) {
      if (user.role !== "ADMIN") {
        return NextResponse.json(
          {
            error:
              "Bloqueio CDE: Esta prancha está OBSOLETA e foi substituída por uma revisão vigente. Baixa não permitida.",
          },
          { status: 403 }
        );
      }

      // Se for ADMIN, exige justificativa e audita
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          {
            error:
              "Esta revisão está OBSOLETA. Para prosseguir com o download de arquivo histórico, forneça a justificativa técnica.",
            requiresAuditReason: true,
          },
          { status: 428 }
        );
      }

      // Grava log de auditoria
      await prisma.acervoWorkflowLog.create({
        data: {
          revisionId: revision.id,
          fromStatus: AcervoWorkflowStatus.OBSOLETO,
          toStatus: AcervoWorkflowStatus.OBSOLETO,
          action: "DOWNLOAD_REVISAO_OBSOLETA",
          notes: `Download de arquivo obsoleto liberado para ADMIN: "${reason.trim()}".`,
          performedById: user.id,
          performedByName: user.name,
          performedByRole: user.role,
        },
      });
    }

    // Redireciona para o arquivo na nuvem ou retorna URL assinada
    return NextResponse.redirect(revision.fileUrl);
  } catch (err: unknown) {
    console.error("[ACERVO_DOWNLOAD_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao processar download do documento." },
      { status: 500 }
    );
  }
}
