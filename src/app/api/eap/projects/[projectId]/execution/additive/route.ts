import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { createAdditiveRevision } from "@/server/eap/execution-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AdditiveSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Informe a justificativa técnica/comercial do aditivo (mínimo 5 caracteres).")
    .max(500),
  notes: z.string().max(1500).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { projectId } = await context.params;
    const raw = await request.json();
    const parsed = AdditiveSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Dados do aditivo inválidos." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await createAdditiveRevision(projectId, admin.id, parsed.data);
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
      { ok: false, error: err instanceof Error ? err.message : "Erro ao registrar aditivo." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}
