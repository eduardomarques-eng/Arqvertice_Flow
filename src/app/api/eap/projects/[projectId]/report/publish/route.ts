import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true, status: true },
    });
    if (!eap) {
      return NextResponse.json(
        { ok: false, error: "EAP não encontrada." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const nextStatus =
      eap.status === "EM_EXECUCAO" || eap.status === "CONCLUIDA"
        ? eap.status
        : "BASELINE_APROVADA";

    const updated = await prisma.eapProject.update({
      where: { id: eap.id },
      data: { status: nextStatus },
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json(
      {
        ok: true,
        publishedAt: updated.updatedAt.toISOString(),
        status: updated.status,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao publicar relatório." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
