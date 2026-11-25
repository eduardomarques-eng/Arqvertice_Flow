import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  eapProject: {
    findUnique: vi.fn(),
  },
  eapLobFloorAllocation: {
    findMany: vi.fn(),
  },
  eapServicePackage: {
    findMany: vi.fn(),
  },
  eapStage: {
    findMany: vi.fn(),
  },
  eapConstraint: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: mockPrisma,
}));

import {
  computeOrderDeadlineDate,
  evaluateConstraintRisks,
  generateSuggestedConstraintsFromLob,
} from "../constraints-lookahead";

describe("Fase 11 — Kanban de Restrições & Suprimentos / Lookahead LOB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      }
      return arg;
    });
  });

  it("calcula orderDeadlineDate (neededByDate - leadTimeDays), classifica riscos e limpa bloqueio ao liberar", () => {
    const needed = new Date("2026-04-20T00:00:00.000Z");
    const deadline = computeOrderDeadlineDate(needed, 10);
    expect(deadline.toISOString().slice(0, 10)).toBe("2026-04-10");

    const evalBefore = evaluateConstraintRisks(
      [
        {
          id: "c1",
          title: "Compra de Aço CA-50",
          status: "IDENTIFICADA",
          priority: "ALTA",
          category: "COMPRAS_SUPRIMENTOS",
          floorId: "TERREO",
          floorName: "Térreo",
          packageNumber: 7,
          teamCode: "A",
          neededByDate: "2026-04-12",
          leadTimeDays: 10,
          orderDeadlineDate: "2026-04-02",
          estimatedCost: 15000,
        },
        {
          id: "c2",
          title: "Tubulação Hidráulica",
          status: "EM_COTACAO_ANALISE",
          priority: "MEDIA",
          category: "COMPRAS_SUPRIMENTOS",
          floorId: "TERREO",
          floorName: "Térreo",
          packageNumber: 15,
          teamCode: "B",
          neededByDate: "2026-04-18",
          leadTimeDays: 5,
          orderDeadlineDate: "2026-04-13",
          estimatedCost: 5000,
        },
        {
          id: "c3",
          title: "Tapume Canteiro",
          status: "LIBERADA",
          priority: "MEDIA",
          category: "LOGISTICA_CANTEIRO",
          floorId: "FUNDACAO",
          floorName: "Infraestrutura / Fundação",
          packageNumber: 1,
          teamCode: "A",
          neededByDate: "2026-04-01",
          leadTimeDays: 5,
          orderDeadlineDate: "2026-03-27",
          estimatedCost: 3000,
        },
      ],
      "2026-04-12"
    );

    expect(evalBefore.riskById["c1"]).toBe("CRITICA");
    expect(evalBefore.riskById["c2"]).toBe("ATENCAO");
    expect(evalBefore.riskById["c3"]).toBe("LIBERADA");
    expect(evalBefore.lobBlockMap["TERREO::7"]?.criticalCount).toBe(1);
    expect(evalBefore.lobBlockMap["FUNDACAO::1"]).toBeUndefined();
    expect(evalBefore.metrics.totalEstimatedCost).toBe(23000);

    // Ao mover c1 para LIBERADA, o bloqueio do pacote TERREO::7 desaparece
    const evalAfter = evaluateConstraintRisks(
      [
        {
          id: "c1",
          title: "Compra de Aço CA-50",
          status: "LIBERADA",
          priority: "ALTA",
          category: "COMPRAS_SUPRIMENTOS",
          floorId: "TERREO",
          floorName: "Térreo",
          packageNumber: 7,
          teamCode: "A",
          neededByDate: "2026-04-12",
          leadTimeDays: 10,
          orderDeadlineDate: "2026-04-02",
          estimatedCost: 15000,
        },
      ],
      "2026-04-12"
    );
    expect(evalAfter.lobBlockMap["TERREO::7"]).toBeUndefined();
  });

  it("gera Lookahead 45d de forma idempotente e retorna null para projeto divergente (404)", async () => {
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce(null);
    const missing = await generateSuggestedConstraintsFromLob("proj-inexistente");
    expect(missing).toBeNull();

    // Primeira geração cria 1 restrição
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce({ id: "eap-1" });
    mockPrisma.eapLobFloorAllocation.findMany.mockResolvedValueOnce([
      {
        floorId: "TERREO",
        floorName: "Térreo",
        floorOrder: 2,
        dateIso: "2026-05-10",
        teamCode: "A",
        packageNumber: 7,
      },
    ]);
    mockPrisma.eapServicePackage.findMany.mockResolvedValueOnce([
      {
        packageNumber: 7,
        name: "Supraestrutura Térreo",
        linkedEapStageCodes: ["04"],
      },
    ]);
    mockPrisma.eapStage.findMany.mockResolvedValueOnce([
      {
        code: "04",
        groups: [
          {
            items: [{ zoneQuantitiesJson: { FUND_TERREO: 10 }, materialUnitCost: 300 }],
          },
        ],
      },
    ]);
    mockPrisma.eapConstraint.findMany.mockResolvedValueOnce([]);
    mockPrisma.eapConstraint.createMany.mockResolvedValueOnce({ count: 1 });

    const first = await generateSuggestedConstraintsFromLob("proj-1", {
      referenceDateIso: "2026-05-01",
    });
    expect(first?.createdCount).toBe(1);
    expect(first?.skippedExistingCount).toBe(0);

    // Segunda execução encontra existente e não duplica
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce({ id: "eap-1" });
    mockPrisma.eapLobFloorAllocation.findMany.mockResolvedValueOnce([
      {
        floorId: "TERREO",
        floorName: "Térreo",
        floorOrder: 2,
        dateIso: "2026-05-10",
        teamCode: "A",
        packageNumber: 7,
      },
    ]);
    mockPrisma.eapServicePackage.findMany.mockResolvedValueOnce([
      { packageNumber: 7, name: "Supraestrutura Térreo", linkedEapStageCodes: ["04"] },
    ]);
    mockPrisma.eapStage.findMany.mockResolvedValueOnce([]);
    mockPrisma.eapConstraint.findMany.mockResolvedValueOnce([
      { floorId: "TERREO", packageNumber: 7 },
    ]);

    const second = await generateSuggestedConstraintsFromLob("proj-1", {
      referenceDateIso: "2026-05-01",
    });
    expect(second?.createdCount).toBe(0);
    expect(second?.skippedExistingCount).toBe(1);
  });
});
