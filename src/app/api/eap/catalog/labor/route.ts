import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createLaborSchema = z.object({
  cityId: z.string().uuid(),
  code: z.string().min(2).max(40),
  name: z.string().min(3).max(200),
  unit: z.string().min(1).max(20),
  productivityUnit: z.string().min(1).max(40),
  dailyProductivityPerTeam: z.number().positive(),
  laborUnitCost: z.number().min(0).default(0),
  dailyTeamRate: z.number().min(0).default(0),
  socialChargesPercent: z.number().min(0).max(200).default(85),
});

const updateLaborSchema = z.object({
  laborRoleId: z.string().uuid(),
  cityId: z.string().uuid(),
  name: z.string().min(3).max(200).optional(),
  dailyProductivityPerTeam: z.number().positive().optional(),
  laborUnitCost: z.number().min(0).optional(),
  dailyTeamRate: z.number().min(0).optional(),
  socialChargesPercent: z.number().min(0).max(200).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const cityId = request.nextUrl.searchParams.get("cityId");
    const roles = await prisma.laborRoleCatalog.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        cityPrices: cityId ? { where: { cityId }, take: 1 } : false,
      },
    });

    const items = roles.map((r) => {
      const price = Array.isArray(r.cityPrices) ? r.cityPrices[0] : undefined;
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        unit: r.unit,
        productivityUnit: r.productivityUnit,
        dailyProductivityPerTeam: r.dailyProductivityPerTeam,
        laborUnitCost: price?.laborUnitCost ?? 0,
        dailyTeamRate: price?.dailyTeamRate ?? 0,
        socialChargesPercent: price?.socialChargesPercent ?? 85,
      };
    });

    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao listar mão de obra." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const parsed = createLaborSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.laborRoleCatalog.create({
        data: {
          code: parsed.code.trim().toUpperCase(),
          name: parsed.name.trim(),
          unit: parsed.unit.trim(),
          productivityUnit: parsed.productivityUnit.trim(),
          dailyProductivityPerTeam: parsed.dailyProductivityPerTeam,
          active: true,
        },
      });

      const price = await tx.cityLaborPrice.create({
        data: {
          cityId: parsed.cityId,
          laborRoleId: role.id,
          laborUnitCost: parsed.laborUnitCost,
          dailyTeamRate: parsed.dailyTeamRate,
          socialChargesPercent: parsed.socialChargesPercent,
        },
      });

      return {
        ...role,
        laborUnitCost: price.laborUnitCost,
        dailyTeamRate: price.dailyTeamRate,
        socialChargesPercent: price.socialChargesPercent,
      };
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao criar função de mão de obra." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const parsed = updateLaborSchema.parse(body);

    await prisma.$transaction(async (tx) => {
      if (parsed.name !== undefined || parsed.dailyProductivityPerTeam !== undefined) {
        await tx.laborRoleCatalog.update({
          where: { id: parsed.laborRoleId },
          data: {
            ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
            ...(parsed.dailyProductivityPerTeam !== undefined
              ? { dailyProductivityPerTeam: parsed.dailyProductivityPerTeam }
              : {}),
          },
        });
      }

      if (
        parsed.laborUnitCost !== undefined ||
        parsed.dailyTeamRate !== undefined ||
        parsed.socialChargesPercent !== undefined
      ) {
        await tx.cityLaborPrice.upsert({
          where: { cityId_laborRoleId: { cityId: parsed.cityId, laborRoleId: parsed.laborRoleId } },
          update: {
            ...(parsed.laborUnitCost !== undefined ? { laborUnitCost: parsed.laborUnitCost } : {}),
            ...(parsed.dailyTeamRate !== undefined ? { dailyTeamRate: parsed.dailyTeamRate } : {}),
            ...(parsed.socialChargesPercent !== undefined
              ? { socialChargesPercent: parsed.socialChargesPercent }
              : {}),
          },
          create: {
            cityId: parsed.cityId,
            laborRoleId: parsed.laborRoleId,
            laborUnitCost: parsed.laborUnitCost ?? 0,
            dailyTeamRate: parsed.dailyTeamRate ?? 0,
            socialChargesPercent: parsed.socialChargesPercent ?? 85,
          },
        });
      }
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar mão de obra." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID da função obrigatório." }, { status: 400 });
    }
    await prisma.laborRoleCatalog.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao desativar função." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
