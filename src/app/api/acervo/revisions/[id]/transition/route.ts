import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { transitionAcervoWorkflow } from "@/server/services/acervo-cde-service";
import { AcervoWorkflowStatus } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { toStatus, action = "TRANSIÇÃO_STATUS", notes } = body;

    if (!toStatus || !Object.values(AcervoWorkflowStatus).includes(toStatus)) {
      return NextResponse.json(
        { error: "Status de destino inválido." },
        { status: 400 }
      );
    }

    // Regra de segurança: Somente ADMIN ou perfis autorizados (canApproveForWork / ENGENHEIRO / ARQUITETO) podem aprovar BOM_PARA_OBRA
    if (toStatus === AcervoWorkflowStatus.BOM_PARA_OBRA && user.role !== "ADMIN") {
      if (user.role !== "ENGENHEIRO" && user.role !== "ARQUITETO") {
        return NextResponse.json(
          { error: "Apenas coordenadores e administradores podem aprovar 'Bom para Obra'." },
          { status: 403 }
        );
      }

      const rev = await prisma.acervoRevision.findUnique({
        where: { id },
        include: { document: { select: { projectId: true, discipline: true } } },
      });
      if (rev?.document) {
        const perm = await prisma.acervoDisciplinePermission.findFirst({
          where: {
            userId: user.id,
            discipline: rev.document.discipline,
            OR: [{ projectId: rev.document.projectId }, { projectId: null }],
          },
        });
        if (perm && !perm.canApproveForWork) {
          return NextResponse.json(
            { error: "Apenas coordenadores com permissão de aprovação para esta disciplina podem aprovar 'Bom para Obra'." },
            { status: 403 }
          );
        }
      }
    }

    const updated = await transitionAcervoWorkflow({
      revisionId: id,
      toStatus: toStatus as AcervoWorkflowStatus,
      action,
      notes,
      performedById: user.id,
      performedByName: user.name,
      performedByRole: user.role,
    });

    revalidatePath("/admin/acervo");
    revalidatePath("/equipe/acervo");
    revalidatePath("/portal");

    return NextResponse.json({ success: true, revision: updated });
  } catch (err: unknown) {
    console.error("[ACERVO_WORKFLOW_POST_ERROR]", err);
    return NextResponse.json(
      { error: "Falha na transição de status do documento." },
      { status: 500 }
    );
  }
}
