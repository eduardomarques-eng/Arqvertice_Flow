import { prisma } from "@/server/db";
import {
  DEFAULT_LOB_FLOORS,
  generateIntelligentFloorLobMatrix,
  type EapStageFloorLoad,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
  type LobFloorAllocationItem,
  type LobFloorDefinition,
} from "@/lib/eap-lob-grid";
import type { ComputedEapStageDTO } from "./workbench";

export function buildEapStageFloorLoads(stages: ComputedEapStageDTO[]): EapStageFloorLoad[] {
  return stages.map((st) => {
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
        COBERTURA: Math.round(coberta * 100) / 100,
        AREA_EXTERNA: Math.round(externo * 100) / 100,
      },
    };
  });
}

export async function regenerateAndPersistLobMatrix(params: {
  eapProjectId: string;
  startDate: string;
  builtAreaM2: number;
  floors?: LobFloorDefinition[];
  servicePackages: FloorMatrixServicePackage[];
  workTeams: FloorMatrixWorkTeam[];
  stageLoads: EapStageFloorLoad[];
  holidays: string[];
}): Promise<LobFloorAllocationItem[]> {
  const floors =
    params.floors && params.floors.length > 0 ? params.floors : DEFAULT_LOB_FLOORS;
  const holidaySet = new Set(params.holidays.map((h) => h.slice(0, 10)));

  const generated = generateIntelligentFloorLobMatrix({
    startDate: params.startDate,
    floors,
    servicePackages: params.servicePackages,
    workTeams: params.workTeams,
    stageLoads: params.stageLoads,
    holidaySet,
    builtAreaM2: params.builtAreaM2,
  });

  await prisma.$transaction(async (tx) => {
    await tx.eapLobFloorAllocation.deleteMany({
      where: { eapProjectId: params.eapProjectId },
    });
    if (generated.allocations.length > 0) {
      await tx.eapLobFloorAllocation.createMany({
        data: generated.allocations.map((a) => ({
          eapProjectId: params.eapProjectId,
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

  return generated.allocations;
}
