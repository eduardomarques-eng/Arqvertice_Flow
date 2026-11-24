import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchConflictSchema = z.object({
  status: z.enum(["BLOQUEADO_AUTO", "SOBRESCRITO_HUMANO", "RESOLVIDO"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; conflictId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { conflictId } = await context.params;
    const body = await request.json();
    const parsed = patchConflictSchema.parse(body);

    const updated = await prisma.eapConflictLog.update({
      where: { id: conflictId },
      data: { status: parsed.status },
    });

    return NextResponse.json({ ok: true, conflict: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar conflito." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
