import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const syncSegmentSchema = z.object({
  zoneCode: z.enum(["FUND_TERREO", "PAV_SUPERIOR", "COBERTURA", "EXTERNO"]),
  segmentOrder: z.number().int().min(1).default(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workingDays: z.number().int().min(1).max(365),
  parallelLane: z.number().int().min(1).max(20).default(1),
  progressPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(300).nullable().optional(),
});

const syncSchema = z.object({
  updates: z
    .array(
      z.object({
        packageId: z.string().uuid(),
        durationWorkingDays: z.number().int().min(0).max(1000).optional(),
        teamsCount: z.number().int().min(1).max(20).optional(),
        segments: z.array(syncSegmentSchema),
      })
    )
    .min(1)
    .max(60),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = syncSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: {
        id: true,
        schedulePackages: { select: { id: true } },
      },
    });

    if (!eap) {
      return NextResponse.json(
        { ok: false, error: "EAP não encontrada para este projeto." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const validPackageIds = new Set(eap.schedulePackages.map((p) => p.id));
    for (const upd of parsed.updates) {
      if (!validPackageIds.has(upd.packageId)) {
        return NextResponse.json(
          { ok: false, error: `Pacote ${upd.packageId} não pertence a este projeto.` },
          { status: 404, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const upd of parsed.updates) {
        const computedWorkingDays = upd.segments.reduce((acc, s) => acc + s.workingDays, 0);
        const nextDuration =
          upd.durationWorkingDays !== undefined
            ? Math.max(1, upd.durationWorkingDays || computedWorkingDays || 1)
            : Math.max(1, computedWorkingDays || 1);

        await tx.schedulePackage.update({
          where: { id: upd.packageId },
          data: {
            durationWorkingDays: nextDuration,
            ...(upd.teamsCount !== undefined ? { teamsCount: upd.teamsCount } : {}),
          },
        });

        await tx.scheduleSegment.deleteMany({
          where: { packageId: upd.packageId },
        });

        if (upd.segments.length > 0) {
          await tx.scheduleSegment.createMany({
            data: upd.segments.map((seg, idx) => ({
              packageId: upd.packageId,
              zoneCode: seg.zoneCode,
              segmentOrder: seg.segmentOrder || idx + 1,
              startDate: new Date(`${seg.startDate}T00:00:00.000Z`),
              endDate: new Date(`${seg.endDate}T00:00:00.000Z`),
              workingDays: seg.workingDays,
              parallelLane: seg.parallelLane || 1,
              progressPercent: seg.progressPercent ?? 0,
              notes: seg.notes ?? null,
            })),
          });
        }
      }
    });

    return NextResponse.json(
      { ok: true, updatedPackagesCount: parsed.updates.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao sincronizar cronograma." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
