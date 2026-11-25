import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { applyPreliminary13MonthFill } from "@/server/eap/preliminary-fill";
import { handleEapRouteError, jsonNoStore, uuidParamSchema } from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  overwritePreliminary: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const rawBody = await request.json().catch(() => ({}));
    const parsed = payloadSchema.parse(rawBody);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });

    if (!eap) {
      return jsonNoStore({ ok: false, error: "EAP não encontrada." }, 404);
    }

    const result = await applyPreliminary13MonthFill({
      eapProjectId: eap.id,
      startDate: parsed.startDate,
      overwritePreliminary: parsed.overwritePreliminary ?? false,
    });

    return jsonNoStore({
      ok: true,
      ...result,
    });
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao aplicar preenchimento preliminar de 13 meses."
    );
  }
}
