import { prisma } from "@/server/db";
import {
  DEFAULT_LOB_FLOORS,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
  type LobFloorAllocationItem,
  type LobFloorDefinition,
} from "@/lib/eap-lob-grid";
import {
  computePreliminaryEapQuantities,
  generatePreliminary13MonthLobMatrix,
  normalizeDataOrigin,
} from "@/lib/eap-preliminary-13m";
import { normalizeZoneQuantities } from "./workbench";
import { ensureDefaultTeamsAndPackages } from "./teams-and-packages";

export async function applyPreliminary13MonthFill(params: {
  eapProjectId: string;
  startDate?: string;
  overwritePreliminary?: boolean;
}): Promise<{
  filledEapItemsCount: number;
  preservedItemsCount: number;
  lobAllocationsCount: number;
  workingDaysSpan: number;
  endDate: string;
}> {
  await ensureDefaultTeamsAndPackages(params.eapProjectId);

  const eap = await prisma.eapProject.findUnique({
    where: { id: params.eapProjectId },
    include: {
      city: { include: { holidays: { orderBy: { date: "asc" } } } },
      stages: {
        orderBy: { orderIndex: "asc" },
        include: {
          groups: {
            orderBy: { orderIndex: "asc" },
            include: { items: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
      servicePackages: { orderBy: { packageNumber: "asc" } },
      workTeams: {
        orderBy: { teamCode: "asc" },
        include: { workers: { orderBy: { createdAt: "asc" } } },
      },
      lobFloorAllocations: {
        orderBy: [{ floorOrder: "asc" }, { dateIso: "asc" }],
      },
    },
  });

  if (!eap) {
    throw new Error("EAP não encontrada para preenchimento preliminar.");
  }

  let filledEapItemsCount = 0;
  let preservedItemsCount = 0;

  const updates: Array<{ id: string; zoneQuantities: Record<string, number> }> = [];
  for (const st of eap.stages) {
    for (const grp of st.groups) {
      for (const item of grp.items) {
        const origin = normalizeDataOrigin(item.dataOrigin, {
          sourceSoftware: item.sourceSoftware,
          revisionTag: item.revisionTag,
        });
        const zq = normalizeZoneQuantities(item.zoneQuantitiesJson);
        const totalQty =
          zq.FUND_TERREO + zq.PAV_SUPERIOR + zq.COBERTURA + zq.EXTERNO;

        if (origin === "EDITADO_USUARIO" || origin === "QUANTITATIVO_IMPORTADO") {
          preservedItemsCount += 1;
          continue;
        }
        if (totalQty > 0 && !params.overwritePreliminary) {
          continue;
        }

        const prelimQty = computePreliminaryEapQuantities(
          {
            code: item.code,
            stageCode: st.code,
            unit: item.unit,
            description: item.description,
          },
          eap.builtAreaM2
        );
        updates.push({ id: item.id, zoneQuantities: prelimQty });
      }
    }
  }

  const startIso =
    params.startDate ||
    (eap.plannedStartDate
      ? eap.plannedStartDate.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10));

  const floors: LobFloorDefinition[] =
    Array.isArray(eap.lobFloorsJson) && eap.lobFloorsJson.length > 0
      ? (eap.lobFloorsJson as unknown as LobFloorDefinition[])
      : DEFAULT_LOB_FLOORS;

  const servicePackages: FloorMatrixServicePackage[] = eap.servicePackages.map((sp) => ({
    packageNumber: sp.packageNumber,
    name: sp.name,
    discipline: sp.discipline,
    corHex: sp.corHex,
    textHex: sp.textHex,
    predecessorNumbers: sp.predecessorNumbers ?? [],
    productivityPerDay: sp.productivityPerDay,
    productivityUnit: sp.productivityUnit,
    linkedEapStageCodes: sp.linkedEapStageCodes ?? [],
    isActive: sp.isActive,
  }));

  const workTeams: FloorMatrixWorkTeam[] = eap.workTeams.map((wt) => ({
    teamCode: wt.teamCode,
    name: wt.name,
    specialty: wt.specialty,
    maxDailyHours: wt.maxDailyHours,
    maxSimultaneousFronts: wt.maxSimultaneousFronts,
    workers: wt.workers.map((w) => ({
      roleName: w.roleName,
      headcount: w.headcount,
      dailyRate: w.dailyRate,
      socialChargesPct: w.socialChargesPct,
      maxDailyOutput: w.maxDailyOutput,
    })),
  }));

  const existingAllocations: LobFloorAllocationItem[] = eap.lobFloorAllocations.map((a) => ({
    floorId: a.floorId,
    floorName: a.floorName,
    floorOrder: a.floorOrder,
    dateIso: a.dateIso,
    teamCode: a.teamCode,
    packageNumber: a.packageNumber,
    isOvertime: a.isOvertime,
    dataOrigin: normalizeDataOrigin(a.dataOrigin),
  }));

  const holidaySet = new Set(
    eap.city.holidays.map((h) => h.date.toISOString().slice(0, 10))
  );

  const lobResult = generatePreliminary13MonthLobMatrix({
    startDate: startIso,
    builtAreaM2: eap.builtAreaM2,
    floors,
    servicePackages,
    workTeams,
    holidaySet,
    existingAllocations,
    preserveEdited: true,
  });

  await prisma.$transaction(async (tx) => {
    for (const upd of updates) {
      await tx.eapItem.update({
        where: { id: upd.id },
        data: {
          zoneQuantitiesJson: upd.zoneQuantities,
          sourceSoftware: "TEMPLATE",
          revisionTag: "ORIGINAL",
          dataOrigin: "PRELIMINAR_PADRAO",
        },
      });
      filledEapItemsCount += 1;
    }

    if (!eap.plannedStartDate) {
      await tx.eapProject.update({
        where: { id: eap.id },
        data: { plannedStartDate: new Date(`${startIso}T00:00:00.000Z`) },
      });
    }

    await tx.eapLobFloorAllocation.deleteMany({
      where: { eapProjectId: eap.id },
    });

    if (lobResult.allocations.length > 0) {
      await tx.eapLobFloorAllocation.createMany({
        data: lobResult.allocations.map((a) => ({
          eapProjectId: eap.id,
          floorId: a.floorId,
          floorName: a.floorName,
          floorOrder: a.floorOrder,
          dateIso: a.dateIso,
          teamCode: a.teamCode,
          packageNumber: a.packageNumber,
          isOvertime: Boolean(a.isOvertime),
          dataOrigin: a.dataOrigin ?? "PRELIMINAR_PADRAO",
        })),
        skipDuplicates: true,
      });
    }
  });

  return {
    filledEapItemsCount,
    preservedItemsCount,
    lobAllocationsCount: lobResult.allocations.length,
    workingDaysSpan: lobResult.workingDaysSpan,
    endDate: lobResult.endDate,
  };
}
