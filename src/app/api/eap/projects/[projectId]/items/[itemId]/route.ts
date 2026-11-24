import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { normalizeZoneQuantities, resolveRevisionTag } from "@/server/eap/workbench";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchItemSchema = z.object({
  code: z.string().max(40).nullable().optional(),
  description: z.string().min(1).max(260).optional(),
  unit: z.string().min(1).max(20).optional(),
  zoneQuantities: z
    .object({
      FUND_TERREO: z.number().min(0).optional(),
      PAV_SUPERIOR: z.number().min(0).optional(),
      COBERTURA: z.number().min(0).optional(),
      EXTERNO: z.number().min(0).optional(),
    })
    .optional(),
  lossPercent: z.number().min(0).max(100).optional(),
  materialUnitCost: z.number().min(0).optional(),
  laborUnitCost: z.number().min(0).optional(),
  thirdPartyUnitCost: z.number().min(0).optional(),
  markupMultiplier: z.number().min(0).max(10).optional(),
  teamsCount: z.number().int().min(1).max(50).optional(),
  laborRoleId: z.string().uuid().nullable().optional(),
  clearSanityFlag: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId, itemId } = await context.params;
    const body = await request.json();
    const parsed = patchItemSchema.parse(body);

    const existing = await prisma.eapItem.findUnique({
      where: { id: itemId },
      include: {
        group: {
          include: {
            stage: {
              include: {
                eapProject: { select: { projectId: true } },
              },
            },
          },
        },
      },
    });
    if (!existing || existing.group.stage.eapProject.projectId !== projectId) {
      return NextResponse.json({ ok: false, error: "Item da EAP não encontrado." }, { status: 404 });
    }

    const prevZones = normalizeZoneQuantities(existing.zoneQuantitiesJson);
    const nextZones = parsed.zoneQuantities
      ? {
          FUND_TERREO: parsed.zoneQuantities.FUND_TERREO ?? prevZones.FUND_TERREO,
          PAV_SUPERIOR: parsed.zoneQuantities.PAV_SUPERIOR ?? prevZones.PAV_SUPERIOR,
          COBERTURA: parsed.zoneQuantities.COBERTURA ?? prevZones.COBERTURA,
          EXTERNO: parsed.zoneQuantities.EXTERNO ?? prevZones.EXTERNO,
        }
      : prevZones;

    const nextRevisionTag = resolveRevisionTag(existing, parsed);

    const updated = await prisma.eapItem.update({
      where: { id: itemId },
      data: {
        ...(parsed.code !== undefined ? { code: parsed.code?.trim().toUpperCase() || null } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description.trim() } : {}),
        ...(parsed.unit !== undefined ? { unit: parsed.unit.trim() } : {}),
        ...(parsed.zoneQuantities !== undefined ? { zoneQuantitiesJson: nextZones } : {}),
        ...(parsed.lossPercent !== undefined ? { lossPercent: parsed.lossPercent } : {}),
        ...(parsed.materialUnitCost !== undefined ? { materialUnitCost: parsed.materialUnitCost } : {}),
        ...(parsed.laborUnitCost !== undefined ? { laborUnitCost: parsed.laborUnitCost } : {}),
        ...(parsed.thirdPartyUnitCost !== undefined ? { thirdPartyUnitCost: parsed.thirdPartyUnitCost } : {}),
        ...(parsed.markupMultiplier !== undefined ? { markupMultiplier: parsed.markupMultiplier } : {}),
        ...(parsed.teamsCount !== undefined ? { teamsCount: parsed.teamsCount } : {}),
        ...(parsed.laborRoleId !== undefined ? { laborRoleId: parsed.laborRoleId } : {}),
        ...(parsed.clearSanityFlag ? { sanityFlag: null } : {}),
        revisionTag: nextRevisionTag,
      },
    });

    return NextResponse.json({ ok: true, item: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar item." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId, itemId } = await context.params;
    const existing = await prisma.eapItem.findUnique({
      where: { id: itemId },
      include: {
        group: {
          include: {
            stage: {
              include: {
                eapProject: { select: { projectId: true } },
              },
            },
          },
        },
      },
    });
    if (!existing || existing.group.stage.eapProject.projectId !== projectId) {
      return NextResponse.json({ ok: false, error: "Item da EAP não encontrado." }, { status: 404 });
    }
    await prisma.eapItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao remover item." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
