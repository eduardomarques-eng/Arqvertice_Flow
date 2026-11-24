import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchGateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  triggerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["PENDENTE", "EM_COTACAO", "COMPRADO", "ENTREGUE"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; gateId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { gateId } = await context.params;
    const body = await request.json();
    const parsed = patchGateSchema.parse(body);

    const gate = await prisma.procurementGate.update({
      where: { id: gateId },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title.trim() } : {}),
        ...(parsed.leadTimeDays !== undefined ? { leadTimeDays: parsed.leadTimeDays } : {}),
        ...(parsed.triggerDate !== undefined
          ? { triggerDate: new Date(`${parsed.triggerDate}T00:00:00.000Z`) }
          : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      },
    });

    return NextResponse.json({ ok: true, gate }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar gatilho." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; gateId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { gateId } = await context.params;
    await prisma.procurementGate.delete({ where: { id: gateId } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao remover gatilho." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
