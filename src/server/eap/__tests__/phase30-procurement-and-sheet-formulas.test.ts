import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildEapCellMatrixResolver,
  evaluateSheetInput,
  expandCellRange,
} from "@/lib/eap-sheet-formulas";
import {
  addWorkingDays,
  buildProcurementPlanRows,
  subtractWorkingDays,
  summarizeProcurementItems,
  type EapProcurementItemDTO,
} from "@/server/eap/procurement-plan";

describe("Phase 30 — Avaliador Seguro de Fórmulas de Planilha (Sheets)", () => {
  it("avalia expressões aritméticas, decimais pt-BR e porcentagens sem eval", () => {
    const r1 = evaluateSheetInput("=12.5*3.4");
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.value).toBeCloseTo(42.5, 4);

    const r2 = evaluateSheetInput("=100 + 15% * 200");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value).toBeCloseTo(130, 4);

    const r3 = evaluateSheetInput("=(12,5 + 7,5) / 4");
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(r3.value).toBeCloseTo(5, 4);

    const formulaSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/eap-sheet-formulas.ts"),
      "utf8"
    );
    expect(formulaSrc).not.toMatch(/\beval\s*\(/);
    expect(formulaSrc).not.toMatch(/new\s+Function\s*\(/);
  });

  it("avalia SOMA, MEDIA, MIN, MAX, ARRED com referências e intervalos de células EAP", () => {
    const rows = [
      { quantity: 10, materialUnitCost: 100, laborUnitCost: 50, thirdPartyUnitCost: 0 },
      { quantity: 20, materialUnitCost: 200, laborUnitCost: 60, thirdPartyUnitCost: 10 },
      { quantity: 30, materialUnitCost: 300, laborUnitCost: 70, thirdPartyUnitCost: 20 },
      { quantity: 40, materialUnitCost: 400, laborUnitCost: 80, thirdPartyUnitCost: 30 },
    ];
    const resolver = buildEapCellMatrixResolver(rows);

    expect(expandCellRange("C1", "C4")).toEqual(["C1", "C2", "C3", "C4"]);

    const soma = evaluateSheetInput("=SOMA(C1:C4)", resolver);
    expect(soma.ok).toBe(true);
    if (soma.ok) expect(soma.value).toBe(100);

    const media = evaluateSheetInput("=MEDIA(D1:D4)", resolver);
    expect(media.ok).toBe(true);
    if (media.ok) expect(media.value).toBe(250);

    const min = evaluateSheetInput("=MIN(E1:E4)", resolver);
    expect(min.ok).toBe(true);
    if (min.ok) expect(min.value).toBe(50);

    const max = evaluateSheetInput("=MAX(F1:F4)", resolver);
    expect(max.ok).toBe(true);
    if (max.ok) expect(max.value).toBe(30);

    const arred = evaluateSheetInput("=ARRED(10 / 3; 2)", resolver);
    expect(arred.ok).toBe(true);
    if (arred.ok) expect(arred.value).toBe(3.33);
  });

  it("rejeita divisão por zero e sintaxe inválida com mensagem segura", () => {
    const divZero = evaluateSheetInput("=10 / 0");
    expect(divZero.ok).toBe(false);
    if (!divZero.ok) expect(divZero.error).toContain("Divisão por zero");

    const unknownFn = evaluateSheetInput("=EXEC(1)");
    expect(unknownFn.ok).toBe(false);
  });
});

describe("Phase 30 — Plano de Aquisições Integrado ao LOB & Financeiro", () => {
  it("cruza itens da EAP com datas do LOB calculando necessidade e data limite de pedido", () => {
    const start = new Date("2026-06-01T00:00:00.000Z"); // Segunda-feira
    const rows = buildProcurementPlanRows({
      plannedStartDate: start,
      stages: [
        {
          code: "04",
          name: "Supraestrutura",
          items: [
            {
              description: "Aço CA-50 10mm",
              unit: "kg",
              quantity: 1200,
              materialUnitCost: 8.5,
              thirdPartyUnitCost: 0,
            },
          ],
        },
        {
          code: "14",
          name: "Esquadrias",
          items: [
            {
              description: "Esquadria de Alumínio Linha Suprema",
              unit: "m²",
              quantity: 45,
              materialUnitCost: 900,
              thirdPartyUnitCost: 200,
            },
          ],
        },
      ],
      lobAllocations: [
        {
          floorId: "TERREO",
          floorName: "Térreo",
          floorOrder: 1,
          dateIso: addWorkingDays(start, 10).toISOString().slice(0, 10),
          packageNumber: 4,
          teamCode: "A",
          isOvertime: false,
          dataOrigin: "EDITADO_USUARIO",
        },
      ],
      servicePackages: [
        {
          id: "pkg-4",
          packageNumber: 4,
          name: "Supraestrutura",
          linkedStageCodes: ["04"],
        },
      ],
      schedulePackages: [],
    });

    expect(rows.length).toBe(2);
    const steel = rows.find((r) => r.itemName.includes("Aço CA-50"));
    expect(steel).toBeDefined();
    expect(steel?.estimatedAmount).toBe(10200);
    expect(steel?.leadTimeDays).toBe(12);
    expect(steel?.needDate.toISOString().slice(0, 10)).toBe(
      addWorkingDays(start, 10).toISOString().slice(0, 10)
    );
    expect(steel?.orderDeadlineDate.toISOString().slice(0, 10)).toBe(
      subtractWorkingDays(steel!.needDate, 12).toISOString().slice(0, 10)
    );

    const esq = rows.find((r) => r.itemName.includes("Esquadria"));
    expect(esq?.leadTimeDays).toBe(25);
    expect(esq?.estimatedAmount).toBe(49500);
  });

  it("resume corretamente orçamentos, pedidos emitidos e comprometido financeiro", () => {
    const sample: EapProcurementItemDTO[] = [
      {
        id: "1",
        eapProjectId: "eap-1",
        packageId: null,
        packageNumber: 4,
        packageName: "Supraestrutura",
        stageCode: "04",
        itemName: "Aço CA-50",
        category: "MATERIAL",
        unit: "kg",
        quantity: 1000,
        estimatedAmount: 8500,
        closedAmount: 8200,
        supplierName: "Gerdau",
        needDate: "2026-06-20T00:00:00.000Z",
        leadTimeDays: 12,
        orderDeadlineDate: "2026-06-04T00:00:00.000Z",
        status: "PEDIDO_EMITIDO",
        financialEntryId: "fin-1",
        notes: null,
      },
      {
        id: "2",
        eapProjectId: "eap-1",
        packageId: null,
        packageNumber: 14,
        packageName: "Esquadrias",
        stageCode: "14",
        itemName: "Esquadria Alumínio",
        category: "MATERIAL",
        unit: "m²",
        quantity: 20,
        estimatedAmount: 20000,
        closedAmount: null,
        supplierName: null,
        needDate: "2026-07-01T00:00:00.000Z",
        leadTimeDays: 25,
        orderDeadlineDate: "2026-05-27T00:00:00.000Z",
        status: "A_COTAR",
        financialEntryId: null,
        notes: null,
      },
    ];

    const summary = summarizeProcurementItems(sample, new Date("2026-05-25T00:00:00.000Z"));
    expect(summary.totalItems).toBe(2);
    expect(summary.totalEstimated).toBe(28500);
    expect(summary.totalClosed).toBe(8200);
    expect(summary.totalCommittedFinance).toBe(8200);
    expect(summary.orderedCount).toBe(1);
    expect(summary.toQuoteCount).toBe(1);
    expect(summary.urgentCount).toBe(1);
  });
});
