import { describe, expect, it } from "vitest";
import {
  createDuplicateItemPayload,
  parseClipboardMatrix,
  parsePtBrNumber,
  reorderItemsInList,
} from "@/lib/eap-spreadsheet";
import { planMiningMerge } from "@/server/eap/base-items";

describe("EAP Fase 7 — Flexibilidade da Planilha EAP, Colagem em Bloco & Versões Vigentes", () => {
  it("faz parsing de matriz copiada do Excel/Sheets (\t e \n) com números pt-BR", () => {
    const raw = "12,50\t8,00\t0\n1.250,75\t40\t15,25\n";
    const matrix = parseClipboardMatrix(raw);

    expect(matrix).toHaveLength(2);
    expect(matrix[0]).toEqual(["12,50", "8,00", "0"]);
    expect(parsePtBrNumber(matrix[1][0])).toBe(1250.75);
    expect(parsePtBrNumber(matrix[1][2])).toBe(15.25);
  });

  it("duplica item preservando preços/composição com quantidades zeradas e reordena sequencialmente", () => {
    const dup = createDuplicateItemPayload({
      groupId: "grp-1",
      stageCode: "05",
      materialCatalogId: "mat-1",
      laborRoleId: "lab-1",
      code: "ALV-TJC14",
      description: "Alvenaria Bloco 14cm",
      unit: "m²",
      lossPercent: 8,
      materialUnitCost: 56,
      laborUnitCost: 34,
      thirdPartyUnitCost: 0,
      markupMultiplier: 1.22,
      teamsCount: 2,
    });

    expect(dup.description).toBe("Alvenaria Bloco 14cm (Cópia)");
    expect(dup.materialUnitCost).toBe(56);
    expect(dup.laborUnitCost).toBe(34);
    expect(dup.zoneQuantities).toEqual({
      FUND_TERREO: 0,
      PAV_SUPERIOR: 0,
      COBERTURA: 0,
      EXTERNO: 0,
    });

    const items = [
      { id: "a", orderIndex: 1 },
      { id: "b", orderIndex: 2 },
      { id: "c", orderIndex: 3 },
    ];
    const movedUp = reorderItemsInList(items, "c", "up");
    expect(movedUp.map((i) => i.id)).toEqual(["a", "c", "b"]);
    expect(movedUp.map((i) => i.orderIndex)).toEqual([1, 2, 3]);
  });

  it("preserva edições manuais (revisionTag !== ORIGINAL) durante mineração de versão vigente", () => {
    const plan = planMiningMerge({
      existingItems: [
        {
          id: "edited-1",
          groupId: "grp-04",
          stageCode: "04",
          code: "CONC-FCK30",
          description: "Concreto Editado",
          unit: "m³",
          sourceSoftware: "TQS",
          revisionTag: "QUANTIDADE_ALTERADA",
          materialUnitCost: 610,
          laborUnitCost: 70,
          thirdPartyUnitCost: 65,
        },
      ],
      acceptedItems: [
        {
          description: "Concreto C30 R01",
          unit: "m³",
          zoneQuantities: { FUND_TERREO: 50, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
          eapStageCode: "04",
          rawCategory: "CONCRETO",
          materialCatalogId: "mat-conc",
          laborRoleId: "lab-conc",
          code: "CONC-FCK30",
          lossPercent: 5,
          materialUnitCost: 595,
          laborUnitCost: 68,
          thirdPartyUnitCost: 65,
          sourceSoftware: "TQS",
          sourceFileId: "sf-r01",
          sourcePage: 1,
          sanityFlag: null,
        },
      ],
      groupByStageCode: new Map([["04", "grp-04"]]),
      fallbackGroupId: "grp-04",
      defaultMarkup: 1.22,
    });

    expect(plan.preservedManualCount).toBe(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toHaveLength(0);
  });
});
