import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createMaterialSchema = z.object({
  cityId: z.string().uuid(),
  code: z.string().min(2).max(40),
  name: z.string().min(3).max(200),
  category: z.string().min(2).max(40),
  unit: z.string().min(1).max(20),
  defaultLossPercent: z.number().min(0).max(100).default(5),
  eapStageCode: z.string().min(2).max(4).default("04"),
  sourceSoftwareHint: z.enum(["TQS", "REVIT", "MANUAL"]).default("MANUAL"),
  materialUnitCost: z.number().min(0).default(0),
  thirdPartyUnitCost: z.number().min(0).default(0),
  note: z.string().max(300).optional(),
});

const updateMaterialSchema = z.object({
  materialId: z.string().uuid(),
  cityId: z.string().uuid(),
  name: z.string().min(3).max(200).optional(),
  category: z.string().min(2).max(40).optional(),
  unit: z.string().min(1).max(20).optional(),
  defaultLossPercent: z.number().min(0).max(100).optional(),
  eapStageCode: z.string().min(2).max(4).optional(),
  materialUnitCost: z.number().min(0).optional(),
  thirdPartyUnitCost: z.number().min(0).optional(),
  note: z.string().max(300).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const cityId = request.nextUrl.searchParams.get("cityId");
    const materials = await prisma.materialCatalogItem.findMany({
      where: { active: true },
      orderBy: [{ eapStageCode: "asc" }, { category: "asc" }, { name: "asc" }],
      include: {
        cityPrices: cityId ? { where: { cityId }, take: 1 } : false,
      },
    });

    const items = materials.map((m) => {
      const price = Array.isArray(m.cityPrices) ? m.cityPrices[0] : undefined;
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        unit: m.unit,
        defaultLossPercent: m.defaultLossPercent,
        eapStageCode: m.eapStageCode,
        sourceSoftwareHint: m.sourceSoftwareHint,
        materialUnitCost: price?.materialUnitCost ?? 0,
        thirdPartyUnitCost: price?.thirdPartyUnitCost ?? 0,
        note: price?.note ?? null,
      };
    });

    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao listar materiais." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const parsed = createMaterialSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const mat = await tx.materialCatalogItem.create({
        data: {
          code: parsed.code.trim().toUpperCase(),
          name: parsed.name.trim(),
          category: parsed.category.trim().toUpperCase(),
          unit: parsed.unit.trim(),
          defaultLossPercent: parsed.defaultLossPercent,
          eapStageCode: parsed.eapStageCode.padStart(2, "0"),
          sourceSoftwareHint: parsed.sourceSoftwareHint,
          active: true,
        },
      });

      const price = await tx.cityMaterialPrice.create({
        data: {
          cityId: parsed.cityId,
          materialId: mat.id,
          materialUnitCost: parsed.materialUnitCost,
          thirdPartyUnitCost: parsed.thirdPartyUnitCost,
          note: parsed.note ?? null,
        },
      });

      return { ...mat, materialUnitCost: price.materialUnitCost, thirdPartyUnitCost: price.thirdPartyUnitCost };
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao criar material." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const parsed = updateMaterialSchema.parse(body);

    await prisma.$transaction(async (tx) => {
      if (
        parsed.name !== undefined ||
        parsed.category !== undefined ||
        parsed.unit !== undefined ||
        parsed.defaultLossPercent !== undefined ||
        parsed.eapStageCode !== undefined
      ) {
        await tx.materialCatalogItem.update({
          where: { id: parsed.materialId },
          data: {
            ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
            ...(parsed.category !== undefined ? { category: parsed.category.trim().toUpperCase() } : {}),
            ...(parsed.unit !== undefined ? { unit: parsed.unit.trim() } : {}),
            ...(parsed.defaultLossPercent !== undefined ? { defaultLossPercent: parsed.defaultLossPercent } : {}),
            ...(parsed.eapStageCode !== undefined ? { eapStageCode: parsed.eapStageCode.padStart(2, "0") } : {}),
          },
        });
      }

      if (parsed.materialUnitCost !== undefined || parsed.thirdPartyUnitCost !== undefined || parsed.note !== undefined) {
        await tx.cityMaterialPrice.upsert({
          where: { cityId_materialId: { cityId: parsed.cityId, materialId: parsed.materialId } },
          update: {
            ...(parsed.materialUnitCost !== undefined ? { materialUnitCost: parsed.materialUnitCost } : {}),
            ...(parsed.thirdPartyUnitCost !== undefined ? { thirdPartyUnitCost: parsed.thirdPartyUnitCost } : {}),
            ...(parsed.note !== undefined ? { note: parsed.note } : {}),
          },
          create: {
            cityId: parsed.cityId,
            materialId: parsed.materialId,
            materialUnitCost: parsed.materialUnitCost ?? 0,
            thirdPartyUnitCost: parsed.thirdPartyUnitCost ?? 0,
            note: parsed.note ?? null,
          },
        });
      }
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar material." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID do material obrigatório." }, { status: 400 });
    }
    await prisma.materialCatalogItem.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao desativar material." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
