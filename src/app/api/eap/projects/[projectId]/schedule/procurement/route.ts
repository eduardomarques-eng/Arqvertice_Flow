import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createGateSchema = z.object({
  packageId: z.string().uuid(),
  title: z.string().min(2).max(200),
  leadTimeDays: z.number().int().min(0).max(365),
  triggerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PENDENTE", "EM_COTACAO", "COMPRADO", "ENTREGUE"]).default("PENDENTE"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    await context.params;
    const body = await request.json();
    const parsed = createGateSchema.parse(body);

    const gate = await prisma.procurementGate.create({
      data: {
        packageId: parsed.packageId,
        title: parsed.title.trim(),
        leadTimeDays: parsed.leadTimeDays,
        triggerDate: new Date(`${parsed.triggerDate}T00:00:00.000Z`),
        status: parsed.status,
      },
    });

    return NextResponse.json({ ok: true, gate }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao criar gatilho de compra." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
