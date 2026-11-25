import { describe, expect, it } from "vitest";
import {
  analyzeFloorMatrixConflicts,
  autoLevelFloorMatrix,
  computeEffectiveDailyCapacity,
  DEFAULT_LOB_FLOORS,
  generateIntelligentFloorLobMatrix,
  type EapStageFloorLoad,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
} from "@/lib/eap-lob-grid";

const SAMPLE_PACKAGES: FloorMatrixServicePackage[] = [
  {
    packageNumber: 4,
    name: "Fundações",
    discipline: "Estrutura & Fundações",
    corHex: "#1D4ED8",
    textHex: "#FFFFFF",
    predecessorNumbers: [],
    productivityPerDay: 20,
    productivityUnit: "m³/dia",
    linkedEapStageCodes: ["03"],
    isActive: true,
  },
  {
    packageNumber: 7,
    name: "Supraestrutura",
    discipline: "Estrutura & Fundações",
    corHex: "#6D28D9",
    textHex: "#FFFFFF",
    predecessorNumbers: [4],
    productivityPerDay: 50,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["04"],
    isActive: true,
  },
];

const SAMPLE_TEAMS: FloorMatrixWorkTeam[] = [
  {
    teamCode: "A",
    name: "Equipe A — Estrutura",
    specialty: "Estrutura",
    maxDailyHours: 8,
    maxSimultaneousFronts: 1,
    workers: [
      { roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 20, maxDailyOutput: 15 },
    ],
  },
];

describe("Fase 10 — Motor Inteligente LOB × EAP × Equipes A/B/C & Nivelamento", () => {
  it("calcula duração em dias úteis cruzando quantitativos da EAP com productivityPerDay e limites dos trabalhadores", () => {
    // 2 pedreiros * 15/dia = 30 maxDailyOutput -> min(50, 30) = 30/dia para Pacote 7
    expect(computeEffectiveDailyCapacity(SAMPLE_PACKAGES[1], SAMPLE_TEAMS[0])).toBe(30);
    // Pacote 4: min(20, 30) = 20/dia
    expect(computeEffectiveDailyCapacity(SAMPLE_PACKAGES[0], SAMPLE_TEAMS[0])).toBe(20);

    const stageLoads: EapStageFloorLoad[] = [
      {
        stageCode: "03",
        stageName: "Fundações",
        floorQuantities: { FUNDACAO: 40, TERREO: 0, PAV_SUPERIOR: 0, COBERTA: 0, AREA_EXTERNA: 0 },
      },
      {
        stageCode: "04",
        stageName: "Supraestrutura",
        floorQuantities: { FUNDACAO: 0, TERREO: 60, PAV_SUPERIOR: 30, COBERTA: 0, AREA_EXTERNA: 0 },
      },
    ];

    const holidaySet = new Set(["2026-04-06"]); // Segunda feriado
    const generated = generateIntelligentFloorLobMatrix({
      startDate: "2026-04-03", // Sexta
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      stageLoads,
      holidaySet,
    });

    // Pacote 4 (Fundação, 40 / 20 = 2 dias úteis): 2026-04-03 (sex) e 2026-04-07 (terça, pulando 04, 05, 06)
    const pkg4Days = generated.allocations
      .filter((a) => a.packageNumber === 4)
      .map((a) => a.dateIso);
    expect(pkg4Days).toEqual(["2026-04-03", "2026-04-07"]);

    // Pacote 7 (Térreo 60 / 30 = 2d, Pav Superior 30 / 30 = 1d), mesma Equipe A (maxSimultaneousFronts = 1)
    const pkg7Terreo = generated.allocations
      .filter((a) => a.packageNumber === 7 && a.floorId === "TERREO")
      .map((a) => a.dateIso);
    const pkg7Sup = generated.allocations
      .filter((a) => a.packageNumber === 7 && a.floorId === "PAV_SUPERIOR")
      .map((a) => a.dateIso);

    expect(pkg7Terreo).toEqual(["2026-04-08", "2026-04-09"]);
    expect(pkg7Sup).toEqual(["2026-04-10"]);
  });

  it("detecta sobrecarga de frentes simultâneas e quebra de precedência e nivela preservando travadas", () => {
    const holidaySet = new Set<string>();
    const conflictingAllocations = [
      // Equipe A no mesmo dia (2026-04-07) na Fundação (Pacote 4) e Térreo (Pacote 7 - violando maxSimultaneousFronts=1)
      {
        floorId: "FUNDACAO",
        floorName: "Infraestrutura / Fundação",
        floorOrder: 1,
        dateIso: "2026-04-07",
        teamCode: "A",
        packageNumber: 4,
        isOvertime: false,
        isLocked: true,
      },
      {
        floorId: "TERREO",
        floorName: "Térreo",
        floorOrder: 2,
        dateIso: "2026-04-07",
        teamCode: "A",
        packageNumber: 7,
        isOvertime: false,
        isLocked: false,
      },
      // Quebra de precedência na Fundação: Pacote 7 em 2026-04-06 antes do Pacote 4 (2026-04-07)
      {
        floorId: "FUNDACAO",
        floorName: "Infraestrutura / Fundação",
        floorOrder: 1,
        dateIso: "2026-04-06",
        teamCode: "A",
        packageNumber: 7,
        isOvertime: false,
        isLocked: false,
      },
    ];

    const before = analyzeFloorMatrixConflicts({
      allocations: conflictingAllocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      stageLoads: [],
      holidaySet,
    });

    expect(before.isValid).toBe(false);
    expect(before.conflicts.some((c) => c.type === "TEAM_OVERLOAD")).toBe(true);
    expect(before.conflicts.some((c) => c.type === "PRECEDENCE_VIOLATION")).toBe(true);

    const leveled = autoLevelFloorMatrix({
      allocations: conflictingAllocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      holidaySet,
    });

    expect(leveled.movedCount).toBeGreaterThan(0);

    // Célula travada permanece intacta em 2026-04-07
    const lockedStillThere = leveled.allocations.find(
      (a) => a.floorId === "FUNDACAO" && a.packageNumber === 4 && a.dateIso === "2026-04-07"
    );
    expect(lockedStillThere).toBeDefined();

    const after = analyzeFloorMatrixConflicts({
      allocations: leveled.allocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      stageLoads: [],
      holidaySet,
    });
    expect(after.isValid).toBe(true);
  });
});
