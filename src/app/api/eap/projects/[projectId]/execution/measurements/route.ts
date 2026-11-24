import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { recordWorkMeasurement } from "@/server/eap/execution-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MeasurementSchema = z.object({
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Data de referência inválida (YYYY-MM-DD)."),
  periodLabel: z.string().trim().min(2, "Informe o rótulo do período (ex.: Medição #01 - Mar/2026).").max(120),
  physicalProgressPercent: z.number().min(0).max(100).optional(),
  realizedMaterialCost: z.number().min(0).default(0),
  realizedLaborCost: z.number().min(0).default(0),
  realizedThirdPartyCost: z.number().min(0).default(0),
  notes: z.string().max(1500).nullable().optional(),
  segmentUpdates: z
    .array(
      z.object({
        segmentId: z.string().uuid(),
        progressPercent: z.number().min(0).max(100),
      })
    )
    .optional(),
  stageCosts: z
    .array(
      z.object({
        stageCode: z.string().min(1).max(4),
        material: z.number().min(0).default(0),
        labor: z.number().min(0).default(0),
        thirdParty: z.number().min(0).default(0),
      })
    )
    .optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const raw = await request.json();
    const parsed = MeasurementSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dados de medição inválidos." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await recordWorkMeasurement(projectId, parsed.data);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "EAP não encontrada para este projeto." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, ...result },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao registrar medição." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}
