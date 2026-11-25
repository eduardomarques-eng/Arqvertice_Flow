import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  eapProject: {
    findUnique: vi.fn(),
  },
  eapServicePackage: {
    count: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  eapWorkTeam: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  eapItem: {
    updateMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: mockPrisma,
}));

import {
  computeLaborUnitCostFromTeam,
  computeTeamCostSummary,
  computeWorkerDailyCost,
  computeWorkerHourlyRate,
  ensureDefaultTeamsAndPackages,
  getContrastTextHex,
  getNextTeamCode,
  syncTeamLaborRatesToEap,
} from "../teams-and-packages";

describe("Fase 8 — Pacotes de Serviço (1..N) & Equipes (A, B, C...)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });
  });

  it("calcula custo diário/hora com encargos sociais e respeita limite de frentes/horas", () => {
    expect(
      computeWorkerDailyCost({ headcount: 2, dailyRate: 180, socialChargesPct: 20 })
    ).toBe(432);
    expect(computeWorkerHourlyRate(180, 8)).toBe(22.5);

    const summary = computeTeamCostSummary({
      maxDailyHours: 8,
      maxSimultaneousFronts: 2,
      workers: [
        { roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 20 },
        { roleName: "Servente", headcount: 3, dailyRate: 110, socialChargesPct: 20 },
      ],
    });

    // 2*180*1.2 = 432; 3*110*1.2 = 396 -> total = 828
    expect(summary.totalHeadcount).toBe(5);
    expect(summary.totalDailyCost).toBe(828);
    expect(summary.totalHourlyCost).toBe(103.5);
    expect(summary.effectiveFrontDailyCost).toBe(1656);

    // Respeita maxDailyOutput menor que productivityPerDay
    expect(
      computeLaborUnitCostFromTeam({
        teamDailyCost: 828,
        productivityPerDay: 20,
        maxDailyOutput: 10,
      })
    ).toBe(82.8);

    expect(getNextTeamCode(["A", "B", "C"])).toBe("D");
    expect(getContrastTextHex("#1D4ED8")).toBe("#FFFFFF");
    expect(getContrastTextHex("#FDE047")).toBe("#0F172A");
  });

  it("executa seed idempotente de pacotes 1..N e equipes A, B, C apenas quando vazio", async () => {
    mockPrisma.eapServicePackage.count.mockResolvedValueOnce(0);
    mockPrisma.eapWorkTeam.count.mockResolvedValueOnce(0);
    mockPrisma.eapServicePackage.createMany.mockResolvedValueOnce({ count: 38 });
    mockPrisma.eapWorkTeam.create.mockResolvedValue({ id: "team-id" });

    const first = await ensureDefaultTeamsAndPackages("eap-1");
    expect(first.seededPackages).toBe(38);
    expect(first.seededTeams).toBe(3);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.eapServicePackage.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.eapWorkTeam.create).toHaveBeenCalledTimes(3);

    // Segunda execução não duplica
    vi.clearAllMocks();
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      }
      return arg;
    });
    mockPrisma.eapServicePackage.count.mockResolvedValueOnce(38);
    mockPrisma.eapWorkTeam.count.mockResolvedValueOnce(3);

    const second = await ensureDefaultTeamsAndPackages("eap-1");
    expect(second).toEqual({ seededPackages: 0, seededTeams: 0 });
    expect(mockPrisma.eapServicePackage.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.eapWorkTeam.create).not.toHaveBeenCalled();
  });

  it("sincroniza MO com itens vinculados da EAP em lote e isola projeto/equipe divergente", async () => {
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce(null);
    const missing = await syncTeamLaborRatesToEap({
      projectId: "proj-inexistente",
      teamId: "team-a",
      stageCodes: ["04"],
    });
    expect(missing).toBeNull();

    // Equipe de outro projeto retorna null (isolamento multi-tenant -> 404 na rota)
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce({ id: "eap-1" });
    mockPrisma.eapWorkTeam.findFirst.mockResolvedValueOnce(null);
    const foreignTeam = await syncTeamLaborRatesToEap({
      projectId: "proj-1",
      teamId: "team-outro-projeto",
      stageCodes: ["04"],
    });
    expect(foreignTeam).toBeNull();

    // Sincronização válida em lote via updateMany
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce({ id: "eap-1" });
    mockPrisma.eapWorkTeam.findFirst.mockResolvedValueOnce({
      id: "team-a",
      teamCode: "A",
      maxDailyHours: 8,
      maxSimultaneousFronts: 2,
      workers: [
        { roleName: "Pedreiro", headcount: 2, dailyRate: 200, socialChargesPct: 0, maxDailyOutput: null },
      ],
    });
    mockPrisma.eapServicePackage.findMany.mockResolvedValueOnce([
      { linkedEapStageCodes: ["04"], productivityPerDay: 10 },
    ]);
    mockPrisma.eapItem.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const synced = await syncTeamLaborRatesToEap({
      projectId: "proj-1",
      teamId: "team-a",
      stageCodes: ["04"],
    });

    expect(synced).not.toBeNull();
    expect(synced?.updatedCount).toBe(3);
    expect(synced?.teamDailyCost).toBe(400);
    expect(synced?.appliedRatesByStage["04"]).toBe(40);
    expect(mockPrisma.eapItem.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.eapItem.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        group: { stage: { eapProjectId: "eap-1", code: "04" } },
        revisionTag: "ORIGINAL",
      },
      data: {
        laborUnitCost: 40,
        teamsCount: 2,
        revisionTag: "CUSTO_ALTERADO",
      },
    });
  });
});
