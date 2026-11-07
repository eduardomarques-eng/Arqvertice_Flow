import { NextResponse } from "next/server";
import { z } from "zod";
import { moveScheduleStage } from "@/server/services/schedule-service";
import { DomainError } from "@/server/errors";

const moveSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "COMPLETED"]),
  order: z.number().int().nonnegative().optional(),
  completion: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { id, stageId } = await params;
  try {
    const body = moveSchema.parse(await request.json());
    await moveScheduleStage(stageId, id, body.status, body.order, body.completion);
    return NextResponse.json({ ok: true, projectId: id, stageId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Dados de movimentação inválidos." }, { status: 422 });
    if (error instanceof DomainError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    return NextResponse.json({ error: "Não foi possível mover a etapa." }, { status: 500 });
  }
}
