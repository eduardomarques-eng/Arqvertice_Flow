import { describe, expect, it } from "vitest";
import {
  applyCommercialUnitPrice,
  formatPtBrCurrency,
  formatPtBrQty,
  parsePtBrNumber,
  recomputeTreeTotals,
} from "@/lib/eap-spreadsheet";
import { planMiningMerge } from "@/server/eap/base-items";
import {
  DEFAULT_EAP_ZONES,
  MASTER_EAP_BASE_ITEMS,
  MASTER_EAP_STAGES,
} from "@/server/eap/templates/residential-master";
import { buildEapTreePayload } from "@/server/eap/workbench";

describe("EAP Fase 2 (Planilha Editável, Estrutura Base e Auto-Preenchimento Não-Destrutivo)", () => {
  it("cobre todas as disciplinas com etapas/subgrupos válidos em MASTER_EAP_BASE_ITEMS", () => {
    const validGroupCodes = new Set(
      MASTER_EAP_STAGES.flatMap((st) => st.groups.map((g) => `${st.code}:${g.code}`))
    );

    for (const base of MASTER_EAP_BASE_ITEMS) {
      expect(validGroupCodes.has(`${base.stageCode}:${base.groupCode}`)).toBe(true);
    }

    const disciplines = new Set(MASTER_EAP_BASE_ITEMS.map((b) => b.discipline));
    expect(disciplines.has("ARQUITETONICO")).toBe(true);
    expect(disciplines.has("ESTRUTURAL")).toBe(true);
    expect(disciplines.has("ELETRICO")).toBe(true);
    expect(disciplines.has("HIDRO_ABASTECIMENTO")).toBe(true);
    expect(disciplines.has("HIDRO_ESGOTAMENTO")).toBe(true);
    expect(disciplines.has("HIDRO_DRENAGEM")).toBe(true);
    expect(disciplines.has("LUMINOTECNICO")).toBe(true);
    expect(disciplines.has("PAISAGISMO")).toBe(true);
  });

  it("interpreta e formata números pt-BR deixando células zeradas em branco e recalculando totais", () => {
    expect(parsePtBrNumber("1.250,50")).toBe(1250.5);
    expect(parsePtBrNumber("R$ 840,75")).toBe(840.75);
    expect(parsePtBrNumber("")).toBe(0);
    expect(parsePtBrNumber("-10")).toBe(0);

    expect(formatPtBrQty(0, true)).toBe("");
    expect(formatPtBrQty(12.5, true)).toBe("12,50");
    expect(formatPtBrCurrency(0, true)).toBe("");
    expect(formatPtBrCurrency(1234.5, false)).toContain("1.234,50");

    const baseStages = MASTER_EAP_STAGES.map((st) => ({
      id: `st-${st.code}`,
      code: st.code,
      name: st.name,
      orderIndex: st.orderIndex,
      groups: st.groups.map((g, idx) => ({
        id: `grp-${g.code}`,
        code: g.code,
        name: g.name,
        orderIndex: idx + 1,
        items:
          st.code === "05" && idx === 0
            ? [
                {
                  id: "it-alv",
                  groupId: `grp-${g.code}`,
                  materialCatalogId: null,
                  laborRoleId: null,
                  code: "ALV-TJC14",
                  description: "Alvenaria Bloco 14cm",
                  unit: "m²",
                  zoneQuantitiesJson: { FUND_TERREO: 0, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
                  lossPercent: 0,
                  materialUnitCost: 0,
                  laborUnitCost: 0,
                  thirdPartyUnitCost: 0,
                  markupMultiplier: 1.22,
                  teamsCount: 1,
                  sourceSoftware: "TEMPLATE",
                  sourceFileId: null,
                  sourcePage: null,
                  sanityFlag: null,
                  revisionTag: "ORIGINAL",
                  orderIndex: 1,
                },
              ]
            : [],
      })),
    }));

    const tree = buildEapTreePayload({
      id: "eap-test",
      projectId: "proj-test",
      cityId: "city-for",
      cityLabel: "Fortaleza/CE",
      title: "EAP Teste",
      builtAreaM2: 200,
      bdiPercent: 22,
      plannedStartDate: null,
      status: "RASCUNHO",
      currentRevision: 1,
      premisesJson: [],
      exclusionsJson: [],
      zones: DEFAULT_EAP_ZONES.map((z, idx) => ({ id: `z-${idx}`, ...z })),
      stages: baseStages,
      conflicts: [],
    });

    // Edita inline: 100 m² no Térreo + 80 m² no Superior a R$ 122,00 comercial/m²
    const targetStage = tree.stages.find((s) => s.code === "05")!;
    const item = targetStage.groups[0].items[0];
    item.zoneQuantities = { FUND_TERREO: 100, PAV_SUPERIOR: 80, COBERTURA: 0, EXTERNO: 0 };
    Object.assign(item, applyCommercialUnitPrice(item, 122));

    const recalculated = recomputeTreeTotals(tree);
    const updatedStage = recalculated.stages.find((s) => s.code === "05")!;
    const updatedItem = updatedStage.groups[0].items[0];

    expect(updatedItem.rawQuantity).toBe(180);
    expect(updatedItem.unitCommercialPrice).toBeCloseTo(122, 2);
    expect(updatedItem.totalCommercialPrice).toBeCloseTo(21960, 1);
    expect(updatedStage.totalCommercialPrice).toBeCloseTo(21960, 1);
    expect(recalculated.indicators.totalCommercialPrice).toBeCloseTo(21960, 1);
  });

  it("faz merge da mineração preenchendo linhas-base e preservando edições manuais", () => {
    const groupByStage = new Map<string, string>([
      ["04", "grp-04"],
      ["05", "grp-05"],
      ["21", "grp-21"],
    ]);

    const existingItems = [
      {
        id: "base-conc-30",
        groupId: "grp-04",
        stageCode: "04",
        code: "CONC-FCK30",
        description: "Concreto Usinado fck 30 MPa",
        unit: "m³",
        sourceSoftware: "TEMPLATE",
        revisionTag: "ORIGINAL",
        materialUnitCost: 0,
        laborUnitCost: 0,
        thirdPartyUnitCost: 0,
      },
      {
        id: "edited-alv",
        groupId: "grp-05",
        stageCode: "05",
        code: "ALV-TJC14",
        description: "Alvenaria Bloco 14cm (Editada)",
        unit: "m²",
        sourceSoftware: "REVIT",
        revisionTag: "QUANTIDADE_ALTERADA",
        materialUnitCost: 60,
        laborUnitCost: 35,
        thirdPartyUnitCost: 0,
      },
      {
        id: "stale-lumi",
        groupId: "grp-21",
        stageCode: "21",
        code: "INST-PTO-LUMI",
        description: "Pontos Luminotécnicos",
        unit: "unid",
        sourceSoftware: "REVIT",
        revisionTag: "ORIGINAL",
        materialUnitCost: 145,
        laborUnitCost: 75,
        thirdPartyUnitCost: 0,
      },
    ];

    const plan = planMiningMerge({
      existingItems,
      acceptedItems: [
        {
          description: "Concreto C30 (TQS)",
          unit: "m³",
          zoneQuantities: { FUND_TERREO: 22, PAV_SUPERIOR: 18, COBERTURA: 4, EXTERNO: 0 },
          eapStageCode: "04",
          rawCategory: "CONCRETO",
          materialCatalogId: "mat-conc-30",
          laborRoleId: "lab-conc",
          code: "CONC-FCK30",
          lossPercent: 5,
          materialUnitCost: 595,
          laborUnitCost: 68,
          thirdPartyUnitCost: 65,
          sourceSoftware: "TQS",
          sourceFileId: "sf-1",
          sourcePage: 1,
          sanityFlag: null,
        },
        {
          description: "Alvenaria TJC14 Revit",
          unit: "m²",
          zoneQuantities: { FUND_TERREO: 240, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
          eapStageCode: "05",
          rawCategory: "ALVENARIA",
          materialCatalogId: "mat-alv-14",
          laborRoleId: "lab-pedr",
          code: "ALV-TJC14",
          lossPercent: 8,
          materialUnitCost: 56,
          laborUnitCost: 34,
          thirdPartyUnitCost: 0,
          sourceSoftware: "REVIT",
          sourceFileId: "sf-2",
          sourcePage: 1,
          sanityFlag: null,
        },
      ],
      groupByStageCode: groupByStage,
      fallbackGroupId: "grp-04",
      defaultMarkup: 1.22,
    });

    // Linha-base ORIGINAL recebe quantidades e preços
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe("base-conc-30");
    expect(plan.updates[0].zoneQuantities.FUND_TERREO).toBe(22);
    expect(plan.updates[0].materialUnitCost).toBe(595);

    // Linha editada manualmente NÃO é sobrescrita nem duplicada
    expect(plan.preservedManualCount).toBe(1);
    expect(plan.creates).toHaveLength(0);

    // Linha-base anteriormente minerada mas ausente na nova mineração volta a ficar em branco como TEMPLATE
    expect(plan.resetTemplateIds).toEqual(["stale-lumi"]);
  });
});
