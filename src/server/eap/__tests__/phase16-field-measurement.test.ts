import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/server/errors";

const mockPrisma = vi.hoisted(() => ({
  eapProject: {
    findUnique: vi.fn(),
  },
  eapItem: {
    count: vi.fn(),
  },
  eapFieldMeasurementBulletin: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  eapFieldMeasurementEntry: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: mockPrisma,
}));

import {
  computeFieldMeasurementLine,
  computeWeightedFieldProgress,
  formatBulletinCode,
  renderFieldMeasurementBulletinPdf,
  saveFieldMeasurementBulletin,
} from "../field-measurement";

describe("Fase 12 — Medição no Canteiro & Relatórios Automáticos de Avanço", () => {
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

  it("calcula executado acumulado, saldo pendente e percentual ponderado por custo da EAP", () => {
    const lineA = computeFieldMeasurementLine({
      plannedQty: 100,
      previousExecutedQty: 25,
      currentExecutedQty: 50,
      unitPrice: 200,
    });

    expect(lineA.accumulatedQty).toBe(75);
    expect(lineA.pendingQty).toBe(25);
    expect(lineA.accumulatedPct).toBe(75);
    expect(lineA.measuredAmount).toBe(10000);
    expect(lineA.accumulatedAmount).toBe(15000);
    expect(lineA.pendingAmount).toBe(5000);
    expect(lineA.status).toBe("EM_ANDAMENTO");

    const lineB = computeFieldMeasurementLine({
      plannedQty: 10,
      previousExecutedQty: 0,
      currentExecutedQty: 10,
      unitPrice: 1000,
    });
    expect(lineB.status).toBe("CONCLUIDO");

    const weighted = computeWeightedFieldProgress([lineA, lineB], 70);
    // Total planned = 20000 + 10000 = 30000; accumulated = 15000 + 10000 = 25000 -> 83.33%
    expect(weighted.totalPlannedValue).toBe(30000);
    expect(weighted.totalAccumulatedValue).toBe(25000);
    expect(weighted.totalMeasuredValue).toBe(20000);
    expect(weighted.totalPendingValue).toBe(5000);
    expect(weighted.physicalProgressPct).toBe(83.33);
    expect(weighted.deviationPct).toBe(13.33);
  });

  it("gera boletins sequenciais (BM-01 -> BM-02), bloqueia medição negativa e isola projeto divergente (404)", async () => {
    // Bloqueia medição negativa
    await expect(
      saveFieldMeasurementBulletin({
        projectId: "proj-1",
        referenceDate: "2026-05-10",
        status: "RASCUNHO",
        entries: [
          {
            floorId: "TERREO",
            floorName: "Térreo",
            serviceLabel: "Alvenaria",
            unit: "m²",
            plannedQty: 50,
            previousExecutedQty: 0,
            currentExecutedQty: -5,
            unitPrice: 100,
          },
        ],
      })
    ).rejects.toThrow(DomainError);

    // Projeto divergente -> retorna null (404 na rota)
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce(null);
    const missing = await saveFieldMeasurementBulletin({
      projectId: "proj-inexistente",
      referenceDate: "2026-05-10",
      status: "RASCUNHO",
      entries: [
        {
          floorId: "TERREO",
          floorName: "Térreo",
          serviceLabel: "Alvenaria",
          unit: "m²",
          plannedQty: 50,
          previousExecutedQty: 0,
          currentExecutedQty: 10,
          unitPrice: 100,
        },
      ],
    });
    expect(missing).toBeNull();

    // Sequencial BM-02 quando já existe BM-01
    expect(formatBulletinCode(1)).toBe("BM-01");
    mockPrisma.eapProject.findUnique.mockResolvedValueOnce({ id: "eap-1" });
    mockPrisma.eapFieldMeasurementBulletin.aggregate.mockResolvedValueOnce({
      _max: { bulletinNumber: 1 },
    });
    mockPrisma.eapFieldMeasurementBulletin.create.mockResolvedValueOnce({ id: "bul-2" });
    mockPrisma.eapFieldMeasurementEntry.deleteMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.eapFieldMeasurementEntry.createMany.mockResolvedValueOnce({ count: 1 });

    const created = await saveFieldMeasurementBulletin({
      projectId: "proj-1",
      referenceDate: "2026-05-10",
      status: "APROVADO",
      entries: [
        {
          floorId: "TERREO",
          floorName: "Térreo",
          serviceLabel: "Alvenaria",
          unit: "m²",
          plannedQty: 50,
          previousExecutedQty: 10,
          currentExecutedQty: 15,
          unitPrice: 100,
        },
      ],
    });

    expect(created?.bulletinNumber).toBe(2);
    expect(created?.bulletinCode).toBe("BM-02");
    expect(created?.totalMeasuredValue).toBe(1500);
  });

  it("renderiza buffer PDF válido começando com %PDF-", () => {
    const line = computeFieldMeasurementLine({
      plannedQty: 100,
      previousExecutedQty: 20,
      currentExecutedQty: 30,
      unitPrice: 150,
    });

    const bytes = renderFieldMeasurementBulletinPdf({
      projectName: "Residência Horizonte",
      bulletinCode: "BM-01",
      referenceDate: "2026-05-10",
      status: "APROVADO",
      inspectorName: "Eng. Eduardo",
      weatherCondition: "SOL",
      generalNotes: "Frente em ritmo normal.",
      summary: {
        totalPlannedValue: 15000,
        totalAccumulatedValue: 7500,
        totalMeasuredValue: 4500,
        totalPendingValue: 7500,
        physicalProgressPct: 50,
        plannedLobPct: 45,
        deviationPct: 5,
        completedItemsCount: 0,
        totalItemsCount: 1,
      },
      floorSummaries: [
        {
          floorId: "TERREO",
          floorName: "Térreo",
          floorOrder: 2,
          itemsCount: 1,
          completedCount: 0,
          plannedAmount: 15000,
          accumulatedAmount: 7500,
          pendingAmount: 7500,
          progressPct: 50,
        },
      ],
      items: [
        {
          rowKey: "TERREO::item-1",
          floorId: "TERREO",
          floorName: "Térreo",
          floorOrder: 2,
          packageNumber: 7,
          teamCode: "A",
          eapItemId: "item-1",
          serviceLabel: "04 · Supraestrutura",
          unit: "m²",
          fieldNote: null,
          ...line,
        },
      ],
    });

    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(800);
  });
});
