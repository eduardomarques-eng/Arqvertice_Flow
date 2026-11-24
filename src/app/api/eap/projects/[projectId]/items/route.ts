import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createItemSchema = z.object({
  stageCode: z.string().min(2).max(4).optional(),
  groupId: z.string().uuid().optional(),
  newGroupName: z.string().min(2).max(120).optional(),
  materialCatalogId: z.string().uuid().nullable().optional(),
  laborRoleId: z.string().uuid().nullable().optional(),
  code: z.string().max(40).nullable().optional(),
  description: z.string().min(2).max(260),
  unit: z.string().min(1).max(20),
  category: z.string().max(40).optional(),
  zoneQuantities: z
    .object({
      FUND_TERREO: z.number().min(0).default(0),
      PAV_SUPERIOR: z.number().min(0).default(0),
      COBERTURA: z.number().min(0).default(0),
      EXTERNO: z.number().min(0).default(0),
    })
    .default({ FUND_TERREO: 0, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 }),
  lossPercent: z.number().min(0).max(100).default(0),
  materialUnitCost: z.number().min(0).default(0),
  laborUnitCost: z.number().min(0).default(0),
  thirdPartyUnitCost: z.number().min(0).default(0),
  markupMultiplier: z.number().min(0).max(10).optional(),
  teamsCount: z.number().int().min(1).max(50).default(1),
  saveToCityCatalog: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = createItemSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        stages: {
          include: { groups: { orderBy: { orderIndex: "asc" } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetGroupId = parsed.groupId;

      if (!targetGroupId) {
        const targetStage =
          eap.stages.find((s) => s.code === (parsed.stageCode || "01")) ?? eap.stages[0];
        if (!targetStage) {
          throw new Error("Nenhuma etapa encontrada na EAP.");
        }

        if (parsed.newGroupName?.trim()) {
          const nextIdx = targetStage.groups.length + 1;
          const createdGroup = await tx.eapGroup.create({
            data: {
              stageId: targetStage.id,
              code: `${targetStage.code}.${nextIdx}`,
              name: parsed.newGroupName.trim(),
              orderIndex: nextIdx,
            },
          });
          targetGroupId = createdGroup.id;
        } else if (targetStage.groups[0]) {
          targetGroupId = targetStage.groups[0].id;
        } else {
          const createdGroup = await tx.eapGroup.create({
            data: {
              stageId: targetStage.id,
              code: `${targetStage.code}.1`,
              name: "Serviços Gerais",
              orderIndex: 1,
            },
          });
          targetGroupId = createdGroup.id;
        }
      }

      let resolvedMaterialId = parsed.materialCatalogId ?? null;
      if (parsed.saveToCityCatalog && !resolvedMaterialId) {
        const matCode =
          parsed.code?.trim().toUpperCase() ||
          `CUSTOM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const createdMat = await tx.materialCatalogItem.upsert({
          where: { code: matCode },
          update: {
            name: parsed.description.trim(),
            unit: parsed.unit.trim(),
            defaultLossPercent: parsed.lossPercent,
            eapStageCode: (parsed.stageCode || "01").padStart(2, "0"),
          },
          create: {
            code: matCode,
            name: parsed.description.trim(),
            category: (parsed.category || "PERSONALIZADO").toUpperCase(),
            unit: parsed.unit.trim(),
            defaultLossPercent: parsed.lossPercent,
            eapStageCode: (parsed.stageCode || "01").padStart(2, "0"),
            sourceSoftwareHint: "MANUAL",
            active: true,
          },
        });
        resolvedMaterialId = createdMat.id;

        await tx.cityMaterialPrice.upsert({
          where: { cityId_materialId: { cityId: eap.cityId, materialId: createdMat.id } },
          update: {
            materialUnitCost: parsed.materialUnitCost,
            thirdPartyUnitCost: parsed.thirdPartyUnitCost,
          },
          create: {
            cityId: eap.cityId,
            materialId: createdMat.id,
            materialUnitCost: parsed.materialUnitCost,
            thirdPartyUnitCost: parsed.thirdPartyUnitCost,
            note: "Adicionado via Mesa de Conferência EAP",
          },
        });
      }

      const itemsCount = await tx.eapItem.count({ where: { groupId: targetGroupId } });
      const defaultMarkup = 1 + (eap.bdiPercent || 0) / 100;

      const createdItem = await tx.eapItem.create({
        data: {
          groupId: targetGroupId,
          materialCatalogId: resolvedMaterialId,
          laborRoleId: parsed.laborRoleId ?? null,
          code: parsed.code?.trim().toUpperCase() || null,
          description: parsed.description.trim(),
          unit: parsed.unit.trim(),
          zoneQuantitiesJson: parsed.zoneQuantities,
          lossPercent: parsed.lossPercent,
          materialUnitCost: parsed.materialUnitCost,
          laborUnitCost: parsed.laborUnitCost,
          thirdPartyUnitCost: parsed.thirdPartyUnitCost,
          markupMultiplier: parsed.markupMultiplier ?? defaultMarkup,
          teamsCount: parsed.teamsCount,
          sourceSoftware: "MANUAL",
          revisionTag: "ADICIONADO",
          orderIndex: itemsCount + 1,
        },
      });

      return createdItem;
    });

    return NextResponse.json(
      { ok: true, item: result },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao criar item na EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
