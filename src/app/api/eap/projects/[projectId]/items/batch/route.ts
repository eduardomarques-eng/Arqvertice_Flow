import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const batchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REORDER"),
    groupId: z.string().uuid(),
    orderedItemIds: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    action: z.literal("DELETE"),
    itemIds: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    action: z.literal("CLEAR_QUANTITIES"),
    itemIds: z.array(z.string().uuid()).min(1),
  }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = batchSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    const idsToCheck =
      parsed.action === "REORDER" ? parsed.orderedItemIds : parsed.itemIds;

    const matchingCount = await prisma.eapItem.count({
      where: {
        id: { in: idsToCheck },
        group: { stage: { eapProjectId: eap.id } },
      },
    });
    if (matchingCount !== idsToCheck.length) {
      return NextResponse.json(
        { ok: false, error: "Um ou mais itens não pertencem a este projeto." },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (parsed.action === "REORDER") {
        for (let idx = 0; idx < parsed.orderedItemIds.length; idx++) {
          await tx.eapItem.update({
            where: { id: parsed.orderedItemIds[idx] },
            data: { orderIndex: idx + 1 },
          });
        }
      } else if (parsed.action === "DELETE") {
        await tx.eapItem.deleteMany({
          where: { id: { in: parsed.itemIds } },
        });
      } else {
        await tx.eapItem.updateMany({
          where: { id: { in: parsed.itemIds } },
          data: {
            zoneQuantitiesJson: {
              FUND_TERREO: 0,
              PAV_SUPERIOR: 0,
              COBERTURA: 0,
              EXTERNO: 0,
            },
            revisionTag: "QUANTIDADE_ALTERADA",
            dataOrigin: "EDITADO_USUARIO",
          },
        });
      }
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro na operação em lote." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
