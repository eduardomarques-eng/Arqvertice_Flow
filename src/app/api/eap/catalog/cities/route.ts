import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createCitySchema = z.object({
  name: z.string().min(2).max(120),
  state: z.string().length(2),
  defaultBdiPercent: z.number().min(0).max(100).default(22),
  isDefault: z.boolean().optional(),
  cloneFromCityId: z.string().uuid().optional(),
  adjustmentPercent: z.number().min(-80).max(300).optional(),
});

const updateCitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120).optional(),
  state: z.string().length(2).optional(),
  defaultBdiPercent: z.number().min(0).max(100).optional(),
  regionalLaborFactor: z.number().min(0.5).max(3.0).optional(),
  regionalMaterialFactor: z.number().min(0.5).max(3.0).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireRole("ADMIN");
    const cities = await prisma.cityCatalog.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            holidays: true,
            materialPrices: true,
            laborPrices: true,
          },
        },
      },
    });
    return NextResponse.json({ ok: true, cities }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao listar cidades." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const parsed = createCitySchema.parse(body);
    const normalizedState = parsed.state.toUpperCase();
    const factor = 1 + (parsed.adjustmentPercent ?? 0) / 100;

    const city = await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.cityCatalog.updateMany({ data: { isDefault: false } });
      }

      const created = await tx.cityCatalog.create({
        data: {
          name: parsed.name.trim(),
          state: normalizedState,
          defaultBdiPercent: parsed.defaultBdiPercent,
          isDefault: Boolean(parsed.isDefault),
          active: true,
        },
      });

      if (parsed.cloneFromCityId) {
        const [sourceMatPrices, sourceLaborPrices, sourceHolidays] = await Promise.all([
          tx.cityMaterialPrice.findMany({ where: { cityId: parsed.cloneFromCityId } }),
          tx.cityLaborPrice.findMany({ where: { cityId: parsed.cloneFromCityId } }),
          tx.cityHoliday.findMany({ where: { cityId: parsed.cloneFromCityId } }),
        ]);

        if (sourceMatPrices.length > 0) {
          await tx.cityMaterialPrice.createMany({
            data: sourceMatPrices.map((p) => ({
              cityId: created.id,
              materialId: p.materialId,
              materialUnitCost: Math.round(p.materialUnitCost * factor * 100) / 100,
              thirdPartyUnitCost: Math.round(p.thirdPartyUnitCost * factor * 100) / 100,
              note: `Clonado (${parsed.adjustmentPercent ?? 0}% reajuste)`,
            })),
          });
        }

        if (sourceLaborPrices.length > 0) {
          await tx.cityLaborPrice.createMany({
            data: sourceLaborPrices.map((p) => ({
              cityId: created.id,
              laborRoleId: p.laborRoleId,
              laborUnitCost: Math.round(p.laborUnitCost * factor * 100) / 100,
              dailyTeamRate: Math.round(p.dailyTeamRate * factor * 100) / 100,
              socialChargesPercent: p.socialChargesPercent,
            })),
          });
        }

        if (sourceHolidays.length > 0) {
          await tx.cityHoliday.createMany({
            data: sourceHolidays
              .filter((h) => h.type !== "MUNICIPAL")
              .map((h) => ({
                cityId: created.id,
                date: h.date,
                name: h.name,
                type: h.type,
              })),
            skipDuplicates: true,
          });
        }
      }

      return created;
    });

    return NextResponse.json({ ok: true, city }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao criar cidade." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const parsed = updateCitySchema.parse(body);

    const city = await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.cityCatalog.updateMany({ data: { isDefault: false } });
      }
      return tx.cityCatalog.update({
        where: { id: parsed.id },
        data: {
          ...(parsed.name ? { name: parsed.name.trim() } : {}),
          ...(parsed.state ? { state: parsed.state.toUpperCase() } : {}),
          ...(parsed.defaultBdiPercent !== undefined ? { defaultBdiPercent: parsed.defaultBdiPercent } : {}),
          ...(parsed.regionalLaborFactor !== undefined ? { regionalLaborFactor: parsed.regionalLaborFactor } : {}),
          ...(parsed.regionalMaterialFactor !== undefined ? { regionalMaterialFactor: parsed.regionalMaterialFactor } : {}),
          ...(parsed.isDefault !== undefined ? { isDefault: parsed.isDefault } : {}),
          ...(parsed.active !== undefined ? { active: parsed.active } : {}),
        },
      });
    });

    return NextResponse.json({ ok: true, city }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar cidade." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID da cidade obrigatório." }, { status: 400 });
    }
    await prisma.cityCatalog.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao remover cidade." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
