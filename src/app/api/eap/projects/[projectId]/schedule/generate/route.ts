import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { generateScheduleFromEap } from "@/server/eap/scheduler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const generateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const rawBody = await request.json().catch(() => ({}));
    const parsed = generateSchema.parse(rawBody);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: { include: { holidays: true } },
        zones: { orderBy: { orderIndex: "asc" } },
        conflictLogs: { select: { id: true, status: true } },
        schedulePackages: { orderBy: { orderIndex: "asc" } },
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              include: {
                items: {
                  orderBy: { orderIndex: "asc" },
                  include: { laborRole: true },
                },
              },
            },
          },
        },
      },
    });

    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    const startDateStr =
      parsed.startDate ||
      (eap.plannedStartDate ? eap.plannedStartDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

    const tree = buildEapTreePayload({
      id: eap.id,
      projectId: eap.projectId,
      cityId: eap.cityId,
      cityLabel: `${eap.city.name}/${eap.city.state}`,
      title: eap.title,
      builtAreaM2: eap.builtAreaM2,
      bdiPercent: eap.bdiPercent,
      plannedStartDate: startDateStr,
      status: eap.status,
      currentRevision: eap.currentRevision,
      premisesJson: eap.premisesJson,
      exclusionsJson: eap.exclusionsJson,
      zones: eap.zones,
      stages: eap.stages,
      conflicts: eap.conflictLogs,
    });

    const laborProdMap = new Map<string, number>();
    for (const st of eap.stages) {
      for (const g of st.groups) {
        for (const it of g.items) {
          if (it.laborRole) {
            laborProdMap.set(it.id, it.laborRole.dailyProductivityPerTeam);
          }
        }
      }
    }

    const schedulerItems = tree.stages.flatMap((st) =>
      st.groups.flatMap((g) =>
        g.items.map((it) => ({
          stageCode: st.code,
          zoneQuantities: it.zoneQuantities,
          lossPercent: it.lossPercent,
          dailyProductivityPerTeam: laborProdMap.get(it.id) ?? null,
          teamsCount: it.teamsCount,
          totalMaterial: it.totalMaterial,
          totalLabor: it.totalLabor,
          totalThirdParty: it.totalThirdParty,
          totalDirectCost: it.totalDirectCost,
          totalCommercialPrice: it.totalCommercialPrice,
        }))
      )
    );

    const generated = generateScheduleFromEap({
      packages: eap.schedulePackages.map((p) => ({
        id: p.id,
        packageNumber: p.packageNumber,
        name: p.name,
        waveName: p.waveName,
        linkedStageCodes: Array.isArray(p.linkedStageCodesJson)
          ? p.linkedStageCodesJson.map(String)
          : [],
        predecessorNumbers: Array.isArray(p.predecessorNumbersJson)
          ? p.predecessorNumbersJson.map(Number)
          : [],
        durationWorkingDays: p.durationWorkingDays,
        teamsCount: p.teamsCount,
        orderIndex: p.orderIndex,
      })),
      items: schedulerItems,
      plannedStartDate: startDateStr,
      holidays: eap.city.holidays.map((h) => h.date),
    });

    await prisma.$transaction(async (tx) => {
      const pkgIds = eap.schedulePackages.map((p) => p.id);
      if (pkgIds.length > 0) {
        await tx.scheduleSegment.deleteMany({ where: { packageId: { in: pkgIds } } });
        await tx.procurementGate.deleteMany({ where: { packageId: { in: pkgIds } } });
      }

      if (generated.segments.length > 0) {
        await tx.scheduleSegment.createMany({
          data: generated.segments.map((s) => ({
            packageId: s.packageId,
            zoneCode: s.zoneCode,
            segmentOrder: s.segmentOrder,
            startDate: s.startDate,
            endDate: s.endDate,
            workingDays: s.workingDays,
            parallelLane: s.parallelLane,
            progressPercent: s.progressPercent,
            notes: s.notes,
          })),
        });
      }

      if (generated.procurementGates.length > 0) {
        await tx.procurementGate.createMany({
          data: generated.procurementGates.map((g) => ({
            packageId: g.packageId,
            title: g.title,
            leadTimeDays: g.leadTimeDays,
            triggerDate: g.triggerDate,
            status: g.status,
          })),
        });
      }

      await tx.eapProject.update({
        where: { id: eap.id },
        data: { plannedStartDate: new Date(`${startDateStr}T00:00:00.000Z`) },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        segmentsCount: generated.segments.length,
        procurementGatesCount: generated.procurementGates.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao gerar cronograma." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
