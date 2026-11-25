import { describe, expect, it } from "vitest";
import {
  analyzeFloorMatrixConflicts,
  autoLevelFloorMatrix,
  DEFAULT_LOB_FLOORS,
  generateIntelligentFloorLobMatrix,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
} from "@/lib/eap-lob-grid";

const SAMPLE_PACKAGES: FloorMatrixServicePackage[] = [
  {
    packageNumber: 1,
    name: "Canteiro e Locação / Gabarito",
    discipline: "Preliminares",
    corHex: "#1D4ED8",
    textHex: "#FFFFFF",
    predecessorNumbers: [],
    productivityPerDay: 20,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["01"],
    isActive: true,
  },
  {
    packageNumber: 2,
    name: "Fundações e Baldrame",
    discipline: "Infraestrutura",
    corHex: "#0F766E",
    textHex: "#FFFFFF",
    predecessorNumbers: [1],
    productivityPerDay: 15,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["03"],
    isActive: true,
  },
  {
    packageNumber: 3,
    name: "Supraestrutura (Pilares, Vigas e Lajes)",
    discipline: "Estrutura",
    corHex: "#4338CA",
    textHex: "#FFFFFF",
    predecessorNumbers: [2],
    productivityPerDay: 18,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["04"],
    isActive: true,
  },
  {
    packageNumber: 4,
    name: "Alvenaria de Vedação",
    discipline: "Vedação",
    corHex: "#B45309",
    textHex: "#FFFFFF",
    predecessorNumbers: [3],
    productivityPerDay: 22,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["05"],
    isActive: true,
  },
  {
    packageNumber: 5,
    name: "Instalações Elétricas e Hidrossanitárias Embutidas",
    discipline: "MEP",
    corHex: "#0369A1",
    textHex: "#FFFFFF",
    predecessorNumbers: [4],
    productivityPerDay: 25,
    productivityUnit: "pt/dia",
    linkedEapStageCodes: ["08", "09"],
    isActive: true,
  },
  {
    packageNumber: 6,
    name: "Chapisco e Reboco Interno/Externo",
    discipline: "Revestimentos Brutos",
    corHex: "#047857",
    textHex: "#FFFFFF",
    predecessorNumbers: [5],
    productivityPerDay: 24,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["12"],
    isActive: true,
  },
  {
    packageNumber: 7,
    name: "Cobertura e Impermeabilização",
    discipline: "Cobertura",
    corHex: "#6D28D9",
    textHex: "#FFFFFF",
    predecessorNumbers: [3],
    productivityPerDay: 20,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["07", "11"],
    isActive: true,
  },
  {
    packageNumber: 8,
    name: "Pintura e Acabamentos",
    discipline: "Acabamentos",
    corHex: "#BE123C",
    textHex: "#FFFFFF",
    predecessorNumbers: [6, 7],
    productivityPerDay: 30,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: ["17"],
    isActive: true,
  },
];

const SAMPLE_TEAMS: FloorMatrixWorkTeam[] = [
  {
    teamCode: "A",
    name: "Equipe A",
    specialty: "Estrutura",
    maxDailyHours: 8,
    maxSimultaneousFronts: 1,
    workers: [{ roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 20 }],
  },
  {
    teamCode: "B",
    name: "Equipe B",
    specialty: "Revestimentos",
    maxDailyHours: 8,
    maxSimultaneousFronts: 1,
    workers: [{ roleName: "Azulejista", headcount: 2, dailyRate: 195, socialChargesPct: 20 }],
  },
  {
    teamCode: "C",
    name: "Equipe C",
    specialty: "MEP",
    maxDailyHours: 8,
    maxSimultaneousFronts: 1,
    workers: [{ roleName: "Eletricista", headcount: 1, dailyRate: 210, socialChargesPct: 20 }],
  },
];

function boundsOf(allocs: ReturnType<typeof generateIntelligentFloorLobMatrix>["allocations"], floorId: string, pkgNum: number) {
  const dates = allocs
    .filter((a) => a.floorId === floorId && a.packageNumber === pkgNum)
    .map((a) => a.dateIso)
    .sort();
  return dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null;
}

describe("Fase 20 — Sequência Lógica Construtiva & Trava Física/Equipe na Matriz LOB", () => {
  it("impõe sequência física estrita (Fundação -> Supraestrutura vertical -> Alvenaria -> MEP -> Chapisco/Reboco -> Acabamentos) com EAP vazia", () => {
    const holidays = new Set(["2026-04-21"]);
    const res = generateIntelligentFloorLobMatrix({
      startDate: "2026-04-01",
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      stageLoads: [],
      holidaySet: holidays,
      builtAreaM2: 200,
    });

    const fund = boundsOf(res.allocations, "FUNDACAO", 2)!;
    const estTerreo = boundsOf(res.allocations, "TERREO", 3)!;
    const estSup = boundsOf(res.allocations, "PAV_SUPERIOR", 3)!;
    const estCob = boundsOf(res.allocations, "COBERTA", 3)!;
    const alvTerreo = boundsOf(res.allocations, "TERREO", 4)!;
    const mepTerreo = boundsOf(res.allocations, "TERREO", 5)!;
    const rebTerreo = boundsOf(res.allocations, "TERREO", 6)!;
    const pintTerreo = boundsOf(res.allocations, "TERREO", 8)!;

    expect(fund).not.toBeNull();
    expect(estTerreo.min > fund.max).toBe(true);
    expect(estSup.min > estTerreo.max).toBe(true);
    expect(estCob.min > estSup.max).toBe(true);
    expect(alvTerreo.min > estTerreo.max).toBe(true);
    expect(mepTerreo.min > alvTerreo.max).toBe(true);
    // Zero absurdos: Chapisco e Reboco (Equipe B) aguarda Fundação, Estrutura, Alvenaria e MEP!
    expect(rebTerreo.min > mepTerreo.max).toBe(true);
    expect(rebTerreo.min > fund.max).toBe(true);
    expect(pintTerreo.min > rebTerreo.max).toBe(true);

    // Nenhuma alocação cai em Sábado, Domingo ou Feriado, nem excede maxSimultaneousFronts = 1
    const frontsByTeamDay = new Map<string, Set<string>>();
    for (const a of res.allocations) {
      const dow = new Date(`${a.dateIso}T00:00:00Z`).getUTCDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
      expect(holidays.has(a.dateIso)).toBe(false);
      const k = `${a.teamCode}::${a.dateIso}`;
      const set = frontsByTeamDay.get(k) ?? new Set<string>();
      set.add(`${a.floorId}::${a.packageNumber}`);
      frontsByTeamDay.set(k, set);
      expect(set.size).toBeLessThanOrEqual(1);
    }
  });

  it("detecta PRECEDENCE_VIOLATION ao colocar Chapisco/Reboco no dia da Fundação e corrige via autoLevelFloorMatrix", () => {
    const manualBad = [
      { floorId: "FUNDACAO", floorName: "Infraestrutura / Fundação", floorOrder: 1, dateIso: "2026-04-01", teamCode: "A", packageNumber: 2, isOvertime: false },
      { floorId: "FUNDACAO", floorName: "Infraestrutura / Fundação", floorOrder: 1, dateIso: "2026-04-02", teamCode: "A", packageNumber: 2, isOvertime: false },
      { floorId: "TERREO", floorName: "Térreo", floorOrder: 2, dateIso: "2026-04-01", teamCode: "B", packageNumber: 6, isOvertime: false },
    ];

    const checkBefore = analyzeFloorMatrixConflicts({
      allocations: manualBad,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      stageLoads: [],
      holidaySet: new Set(),
    });
    expect(checkBefore.isValid).toBe(false);
    expect(checkBefore.conflicts.some((c) => c.type === "PRECEDENCE_VIOLATION")).toBe(true);

    const leveled = autoLevelFloorMatrix({
      allocations: manualBad,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      holidaySet: new Set(),
    });
    expect(leveled.movedCount).toBeGreaterThan(0);

    const checkAfter = analyzeFloorMatrixConflicts({
      allocations: leveled.allocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: SAMPLE_PACKAGES,
      workTeams: SAMPLE_TEAMS,
      stageLoads: [],
      holidaySet: new Set(),
    });
    expect(checkAfter.isValid).toBe(true);
  });
});
