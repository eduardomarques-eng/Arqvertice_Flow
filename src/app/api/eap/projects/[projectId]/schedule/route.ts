import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { computeScheduleAnalytics, evaluateScheduleAudit } from "@/server/eap/scheduler";
import { ensureDefaultTeamsAndPackages } from "@/server/eap/teams-and-packages";
import { evaluateConstraintRisks } from "@/server/eap/constraints-lookahead";
import { DEFAULT_LOB_FLOORS } from "@/lib/eap-lob-grid";
import { handleEapRouteError, jsonNoStore, uuidParamSchema } from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);

    const existingIdRow = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!existingIdRow) {
      return jsonNoStore({ ok: false, error: "EAP não inicializada." }, 404);
    }

    await ensureDefaultTeamsAndPackages(existingIdRow.id);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: {
          include: { holidays: { orderBy: { date: "asc" } } },
        },
        zones: { orderBy: { orderIndex: "asc" } },
        conflictLogs: { select: { id: true, status: true } },
        baselineSnapshots: { orderBy: { approvedAt: "desc" }, take: 5 },
        servicePackages: { orderBy: { packageNumber: "asc" } },
        workTeams: {
          orderBy: { teamCode: "asc" },
          include: { workers: { orderBy: { createdAt: "asc" } } },
        },
        lobFloorAllocations: {
          orderBy: [{ floorOrder: "asc" }, { dateIso: "asc" }],
        },
        constraints: {
          orderBy: { neededByDate: "asc" },
        },
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
      return jsonNoStore({ ok: false, error: "EAP não inicializada." }, 404);
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

    const parsedFloors = Array.isArray(eap.lobFloorsJson) && eap.lobFloorsJson.length > 0
      ? eap.lobFloorsJson
      : DEFAULT_LOB_FLOORS;

    const eapStageFloorLoads = tree.stages.map((st) => {
      let fundacao = 0;
      let terreo = 0;
      let superior = 0;
      let coberta = 0;
      let externo = 0;
      const isInfraStage = ["01", "02", "03"].includes(st.code);

      for (const grp of st.groups) {
        for (const item of grp.items) {
          const zq = item.zoneQuantities;
          if (isInfraStage) {
            fundacao += zq.FUND_TERREO || 0;
          } else {
            terreo += zq.FUND_TERREO || 0;
          }
          superior += zq.PAV_SUPERIOR || 0;
          coberta += zq.COBERTURA || 0;
          externo += zq.EXTERNO || 0;
        }
      }

      return {
        stageCode: st.code,
        stageName: st.name,
        floorQuantities: {
          FUNDACAO: Math.round(fundacao * 100) / 100,
          TERREO: Math.round(terreo * 100) / 100,
          PAV_SUPERIOR: Math.round(superior * 100) / 100,
          COBERTA: Math.round(coberta * 100) / 100,
          AREA_EXTERNA: Math.round(externo * 100) / 100,
        },
      };
    });

    const constraintEval = evaluateConstraintRisks(eap.constraints);

    return jsonNoStore({
      ok: true,
      eapStatus: eap.status,
      cityLabel: `${eap.city.name}/${eap.city.state}`,
      builtAreaM2: eap.builtAreaM2,
      plannedStartDate: tree.plannedStartDate,
      zones: eap.zones,
      holidays,
      packages,
      servicePackages: eap.servicePackages,
      workTeams: eap.workTeams,
      lobFloors: parsedFloors,
      lobAllocations: eap.lobFloorAllocations,
      eapStageFloorLoads,
      constraintBlocks: constraintEval.lobBlockMap,
      constraintsMetrics: constraintEval.metrics,
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
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao carregar planejamento.");
  }
}
