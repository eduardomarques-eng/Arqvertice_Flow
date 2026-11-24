import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Ativa (restaura) uma versão anterior de arquivo de quantitativo na EAP,
 * rebaixando a versão atualmente ativa da mesma disciplina para o histórico.
 */
export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId, sourceId } = await context.params;

    const target = await prisma.eapSourceFile.findUnique({
      where: { id: sourceId },
      include: {
        eapProject: { select: { id: true, projectId: true } },
      },
    });

    if (!target || target.eapProject.projectId !== projectId) {
      return NextResponse.json(
        { ok: false, error: "Versão de arquivo não encontrada neste projeto." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.eapSourceFile.updateMany({
        where: {
          eapProjectId: target.eapProjectId,
          discipline: target.discipline,
          id: { not: target.id },
          isActive: true,
        },
        data: {
          isActive: false,
          includedInMining: false,
        },
      });

      return tx.eapSourceFile.update({
        where: { id: target.id },
        data: {
          isActive: true,
          includedInMining: true,
        },
      });
    });

    return NextResponse.json(
      { ok: true, source: updated },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao ativar revisão." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
