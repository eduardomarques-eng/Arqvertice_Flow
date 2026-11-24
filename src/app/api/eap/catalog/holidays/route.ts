import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const holidaySchema = z.object({
  cityId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(2).max(160),
  type: z.enum(["NACIONAL", "ESTADUAL", "MUNICIPAL", "RECESSO"]).default("MUNICIPAL"),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const cityId = request.nextUrl.searchParams.get("cityId");
    if (!cityId) {
      return NextResponse.json({ ok: false, error: "cityId obrigatório." }, { status: 400 });
    }
    const holidays = await prisma.cityHoliday.findMany({
      where: { cityId },
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ ok: true, holidays }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao listar feriados." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();
    const parsed = holidaySchema.parse(body);
    const dt = new Date(`${parsed.date}T00:00:00.000Z`);

    const holiday = await prisma.cityHoliday.upsert({
      where: { cityId_date: { cityId: parsed.cityId, date: dt } },
      update: { name: parsed.name.trim(), type: parsed.type },
      create: { cityId: parsed.cityId, date: dt, name: parsed.name.trim(), type: parsed.type },
    });

    return NextResponse.json({ ok: true, holiday }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar feriado." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID do feriado obrigatório." }, { status: 400 });
    }
    await prisma.cityHoliday.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao remover feriado." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
