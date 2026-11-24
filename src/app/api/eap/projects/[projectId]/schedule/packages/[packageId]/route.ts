import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchPackageSchema = z.object({
  durationWorkingDays: z.number().int().min(1).max(365).optional(),
  teamsCount: z.number().int().min(1).max(20).optional(),
  predecessorNumbers: z.array(z.number().int().min(1)).optional(),
  segmentAction: z
    .object({
      type: z.enum(["UPSERT", "DELETE"]),
      segmentId: z.string().uuid().optional(),
      zoneCode: z.enum(["FUND_TERREO", "PAV_SUPERIOR", "COBERTURA", "EXTERNO"]).optional(),
      segmentOrder: z.number().int().min(1).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      workingDays: z.number().int().min(1).max(365).optional(),
      parallelLane: z.number().int().min(1).max(10).optional(),
      notes: z.string().max(300).nullable().optional(),
    })
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; packageId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { packageId } = await context.params;
    const body = await request.json();
    const parsed = patchPackageSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const pkg = await tx.schedulePackage.update({
        where: { id: packageId },
        data: {
          ...(parsed.durationWorkingDays !== undefined
            ? { durationWorkingDays: parsed.durationWorkingDays }
            : {}),
          ...(parsed.teamsCount !== undefined ? { teamsCount: parsed.teamsCount } : {}),
          ...(parsed.predecessorNumbers !== undefined
            ? { predecessorNumbersJson: parsed.predecessorNumbers }
            : {}),
        },
      });

      if (parsed.segmentAction) {
        const sa = parsed.segmentAction;
        if (sa.type === "DELETE" && sa.segmentId) {
          await tx.scheduleSegment.delete({ where: { id: sa.segmentId } });
        } else if (sa.type === "UPSERT") {
          if (sa.segmentId) {
            await tx.scheduleSegment.update({
              where: { id: sa.segmentId },
              data: {
                ...(sa.zoneCode ? { zoneCode: sa.zoneCode } : {}),
                ...(sa.startDate ? { startDate: new Date(`${sa.startDate}T00:00:00.000Z`) } : {}),
                ...(sa.endDate ? { endDate: new Date(`${sa.endDate}T00:00:00.000Z`) } : {}),
                ...(sa.workingDays ? { workingDays: sa.workingDays } : {}),
                ...(sa.parallelLane ? { parallelLane: sa.parallelLane } : {}),
                ...(sa.notes !== undefined ? { notes: sa.notes } : {}),
              },
            });
          } else if (sa.zoneCode && sa.startDate && sa.endDate) {
            const count = await tx.scheduleSegment.count({ where: { packageId } });
            await tx.scheduleSegment.create({
              data: {
                packageId,
                zoneCode: sa.zoneCode,
                segmentOrder: sa.segmentOrder ?? count + 1,
                startDate: new Date(`${sa.startDate}T00:00:00.000Z`),
                endDate: new Date(`${sa.endDate}T00:00:00.000Z`),
                workingDays: sa.workingDays ?? 5,
                parallelLane: sa.parallelLane ?? 1,
                notes: sa.notes ?? null,
              },
            });
          }
        }
      }

      return pkg;
    });

    return NextResponse.json({ ok: true, package: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar pacote." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
