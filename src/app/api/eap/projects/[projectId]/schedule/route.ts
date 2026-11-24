import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { computeScheduleAnalytics, evaluateScheduleAudit } from "@/server/eap/scheduler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: {
          include: { holidays: { orderBy: { date: "asc" } } },
        },
        zones: { orderBy: { orderIndex: "asc" } },
        conflictLogs: { select: { id: true, status: true } },
        baselineSnapshots: { orderBy: { approvedAt: "desc" }, take: 5 },
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              include: { items: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        schedulePackages: {
          orderBy: { orderIndex: "asc" },
          include: {
            segments: { orderBy: { segmentOrder: "asc" } },
            procurementGates: { orderBy: { triggerDate: "asc" } },
          },
        },
      },
    });

    if (!eap) {
      return NextResponse.json(
        { ok: false, error: "EAP não inicializada." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const tree = buildEapTreePayload({
      id: eap.id,
      projectId: eap.projectId,
      cityId: eap.cityId,
      cityLabel: `${eap.city.name}/${eap.city.state}`,
      title: eap.title,
      builtAreaM2: eap.builtAreaM2,
      bdiPercent: eap.bdiPercent,
      plannedStartDate: eap.plannedStartDate,
      status: eap.status,
      currentRevision: eap.currentRevision,
      premisesJson: eap.premisesJson,
      exclusionsJson: eap.exclusionsJson,
      zones: eap.zones,
      stages: eap.stages,
      conflicts: eap.conflictLogs,
    });

    const packages = eap.schedulePackages.map((p) => ({
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
      segments: p.segments.map((s) => ({
        id: s.id,
        zoneCode: s.zoneCode,
        segmentOrder: s.segmentOrder,
        startDate: s.startDate.toISOString().slice(0, 10),
        endDate: s.endDate.toISOString().slice(0, 10),
        workingDays: s.workingDays,
        parallelLane: s.parallelLane,
        progressPercent: s.progressPercent,
        notes: s.notes,
      })),
      procurementGates: p.procurementGates.map((g) => ({
        id: g.id,
        packageId: g.packageId,
        packageNumber: p.packageNumber,
        packageName: p.name,
        title: g.title,
        leadTimeDays: g.leadTimeDays,
        triggerDate: g.triggerDate.toISOString().slice(0, 10),
        status: g.status,
      })),
    }));

    const holidays = eap.city.holidays.map((h) => ({
      id: h.id,
      date: h.date.toISOString().slice(0, 10),
      name: h.name,
      type: h.type,
    }));

    const analytics = computeScheduleAnalytics({
      packages,
      stageBudgets: tree.stages.map((st) => ({
        stageCode: st.code,
        totalMaterial: st.totalMaterial,
        totalLabor: st.totalLabor,
        totalThirdParty: st.totalThirdParty,
        totalDirectCost: st.totalDirectCost,
        totalCommercialPrice: st.totalCommercialPrice,
      })),
      holidays: holidays.map((h) => h.date),
    });

    const activeStageCodesWithQty = tree.stages
      .filter((st) => st.groups.some((g) => g.items.some((i) => i.totalQtyWithLoss > 0)))
      .map((st) => st.code);

    const audit = evaluateScheduleAudit({
      packages,
      activeStageCodesWithQty,
      plannedStartDate: tree.plannedStartDate,
      weeklyHistogram: analytics.weeklyHistogram,
    });

    return NextResponse.json(
      {
        ok: true,
        eapStatus: eap.status,
        cityLabel: `${eap.city.name}/${eap.city.state}`,
        plannedStartDate: tree.plannedStartDate,
        zones: eap.zones,
        holidays,
        packages,
        analytics,
        audit,
        baselines: eap.baselineSnapshots.map((b) => ({
          id: b.id,
          versionLabel: b.versionLabel,
          totalDirectCost: b.totalDirectCost,
          totalCommercialPrice: b.totalCommercialPrice,
          costPerM2: b.costPerM2,
          approvedAt: b.approvedAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao carregar planejamento." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
