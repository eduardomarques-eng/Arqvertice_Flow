import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const settingsSchema = z.object({
  builtAreaM2: z.number().positive().optional(),
  bdiPercent: z.number().min(0).max(100).optional(),
  applyBdiToAllItems: z.boolean().optional(),
  plannedStartDate: z.string().nullable().optional(),
  premisesJson: z.array(z.string()).optional(),
  exclusionsJson: z.array(z.string()).optional(),
  zones: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100),
        orderIndex: z.number().int().min(0),
      })
    )
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = settingsSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        stages: { include: { groups: { select: { id: true } } } },
      },
    });
    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextEap = await tx.eapProject.update({
        where: { id: eap.id },
        data: {
          ...(parsed.builtAreaM2 !== undefined ? { builtAreaM2: parsed.builtAreaM2 } : {}),
          ...(parsed.bdiPercent !== undefined ? { bdiPercent: parsed.bdiPercent } : {}),
          ...(parsed.plannedStartDate !== undefined
            ? {
                plannedStartDate: parsed.plannedStartDate
                  ? new Date(`${parsed.plannedStartDate.slice(0, 10)}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(parsed.premisesJson !== undefined ? { premisesJson: parsed.premisesJson } : {}),
          ...(parsed.exclusionsJson !== undefined ? { exclusionsJson: parsed.exclusionsJson } : {}),
        },
      });

      if (parsed.applyBdiToAllItems && parsed.bdiPercent !== undefined) {
        const groupIds = eap.stages.flatMap((s) => s.groups.map((g) => g.id));
        if (groupIds.length > 0) {
          const multiplier = Math.round((1 + parsed.bdiPercent / 100) * 10000) / 10000;
          await tx.eapItem.updateMany({
            where: { groupId: { in: groupIds } },
            data: { markupMultiplier: multiplier },
          });
        }
      }

      if (parsed.zones && parsed.zones.length > 0) {
        for (const zItem of parsed.zones) {
          await tx.eapZone.update({
            where: { id: zItem.id },
            data: { name: zItem.name.trim(), orderIndex: zItem.orderIndex },
          });
        }
      }

      return nextEap;
    });

    return NextResponse.json({ ok: true, eapProject: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar parâmetros da EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
