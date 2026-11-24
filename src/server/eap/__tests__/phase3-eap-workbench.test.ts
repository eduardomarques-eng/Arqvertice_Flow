import { describe, expect, it } from "vitest";
import {
  buildEapTreePayload,
  evaluateConferenceGate,
  resolveRevisionTag,
} from "@/server/eap/workbench";
import { DEFAULT_EAP_ZONES, MASTER_EAP_STAGES } from "@/server/eap/templates/residential-master";

function makeMockStages() {
  return MASTER_EAP_STAGES.map((st) => ({
    id: `stage-${st.code}`,
    code: st.code,
    name: st.name,
    orderIndex: st.orderIndex,
    groups: st.groups.map((g, idx) => ({
      id: `grp-${g.code}`,
      code: g.code,
      name: g.name,
      orderIndex: idx + 1,
      items:
        st.code === "04" && idx === 0
          ? [
              {
                id: "item-conc",
                groupId: `grp-${g.code}`,
                materialCatalogId: "mat-conc",
                laborRoleId: "lab-conc",
                code: "CONC-FCK30",
                description: "Concreto Usinado fck 30 MPa",
                unit: "m³",
                zoneQuantitiesJson: { FUND_TERREO: 40, PAV_SUPERIOR: 40, COBERTURA: 20, EXTERNO: 0 },
                lossPercent: 5,
                materialUnitCost: 595,
                laborUnitCost: 68,
                thirdPartyUnitCost: 65,
                markupMultiplier: 1.22,
                teamsCount: 1,
                sourceSoftware: "TQS",
                sourceFileId: "src-1",
                sourcePage: 1,
                sanityFlag: null,
                revisionTag: "ORIGINAL",
                orderIndex: 1,
              },
              {
                id: "item-aco",
                groupId: `grp-${g.code}`,
                materialCatalogId: "mat-aco",
                laborRoleId: "lab-arm",
                code: "ACO-CA50-100",
                description: "Aço CA-50 Ø 10,0 mm",
                unit: "kg",
                zoneQuantitiesJson: { FUND_TERREO: 4000, PAV_SUPERIOR: 5450, COBERTURA: 0, EXTERNO: 0 },
                lossPercent: 0,
                materialUnitCost: 7.8,
                laborUnitCost: 3.1,
                thirdPartyUnitCost: 0,
                markupMultiplier: 1.22,
                teamsCount: 1,
                sourceSoftware: "TQS",
                sourceFileId: "src-1",
                sourcePage: 1,
                sanityFlag: null,
                revisionTag: "ORIGINAL",
                orderIndex: 2,
              },
            ]
          : st.code === "05" && idx === 0
            ? [
                {
                  id: "item-alv",
                  groupId: `grp-${g.code}`,
                  materialCatalogId: "mat-alv",
                  laborRoleId: "lab-pedr",
                  code: "ALV-TJC14",
                  description: "Alvenaria Bloco Cerâmico 14cm (TJC14)",
                  unit: "m²",
                  zoneQuantitiesJson: { FUND_TERREO: 200, PAV_SUPERIOR: 200, COBERTURA: 0, EXTERNO: 0 },
                  lossPercent: 0,
                  materialUnitCost: 56,
                  laborUnitCost: 34,
                  thirdPartyUnitCost: 0,
                  markupMultiplier: 1.22,
                  teamsCount: 2,
                  sourceSoftware: "REVIT",
                  sourceFileId: "src-2",
                  sourcePage: 2,
                  sanityFlag: null,
                  revisionTag: "ADICIONADO",
                  orderIndex: 1,
                },
              ]
            : [],
    })),
  }));
}

describe("EAP Fase 3 — Mesa de Conferência, Revision Tag & Gate de Validação", () => {
  it("calcula árvore completa de 26 etapas, pesos %, BDI e indicadores de engenharia", () => {
    const tree = buildEapTreePayload({
      id: "eap-1",
      projectId: "proj-1",
      cityId: "city-for",
      cityLabel: "Fortaleza/CE",
      title: "EAP Residência",
      builtAreaM2: 250,
      bdiPercent: 22,
      plannedStartDate: "2026-04-01",
      status: "EM_CONFERENCIA",
      currentRevision: 1,
      premisesJson: ["Premissa 1"],
      exclusionsJson: ["Marcenaria"],
      zones: DEFAULT_EAP_ZONES.map((z, idx) => ({ id: `z-${idx}`, ...z })),
      stages: makeMockStages(),
      conflicts: [],
    });

    expect(tree.stages).toHaveLength(26);
    const stage04 = tree.stages.find((s) => s.code === "04")!;
    const stage05 = tree.stages.find((s) => s.code === "05")!;

    expect(stage04.itemsCount).toBe(2);
    expect(stage05.itemsCount).toBe(1);
    expect(Math.round(stage04.weightPercent + stage05.weightPercent)).toBe(100);

    // Concreto com 5% perda = 105 m³; Aço = 9450 kg => Taxa de aço = 9450 / 105 = 90 kg/m³
    expect(tree.indicators.steelRateKgPerM3).toBe(90);
    expect(tree.indicators.concreteM3PerM2).toBe(0.42); // 105 / 250
    expect(tree.indicators.masonryM2PerM2).toBe(1.6); // 400 / 250
    expect(tree.indicators.costPerM2).toBeGreaterThan(tree.indicators.directCostPerM2);
    expect(
      Math.round(
        tree.indicators.materialSharePercent +
          tree.indicators.laborSharePercent +
          tree.indicators.thirdPartySharePercent
      )
    ).toBe(100);
    expect(tree.conferenceGate.approved).toBe(true);
  });

  it("atualiza revisionTag corretamente em edições inline de quantidade e custo", () => {
    const base = {
      zoneQuantitiesJson: { FUND_TERREO: 10, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
      lossPercent: 5,
      materialUnitCost: 100,
      laborUnitCost: 50,
      thirdPartyUnitCost: 0,
      markupMultiplier: 1.22,
      revisionTag: "ORIGINAL",
    };

    expect(
      resolveRevisionTag(base, {
        zoneQuantities: { FUND_TERREO: 12 },
      })
    ).toBe("QUANTIDADE_ALTERADA");

    expect(
      resolveRevisionTag(base, {
        materialUnitCost: 115,
      })
    ).toBe("CUSTO_ALTERADO");

    expect(
      resolveRevisionTag(
        { ...base, revisionTag: "ADICIONADO" },
        { materialUnitCost: 120 }
      )
    ).toBe("ADICIONADO");
  });

  it("bloqueia Gate de Conferência com pendências (sem preço, sanityFlag ou conflito) e aprova quando limpo", () => {
    const blocked = evaluateConferenceGate({
      items: [
        { totalQtyWithLoss: 10, unitDirectCost: 0, sanityFlag: null },
        { totalQtyWithLoss: 32, unitDirectCost: 500, sanityFlag: "ANOMALIA_UNIDADE_M3" },
      ],
      conflicts: [{ status: "BLOQUEADO_AUTO" }],
    });

    expect(blocked.approved).toBe(false);
    expect(blocked.summary.pendingConflictsCount).toBe(1);
    expect(blocked.summary.itemsWithoutPriceCount).toBe(1);
    expect(blocked.summary.sanityAlertsCount).toBe(1);
    expect(blocked.blockers).toHaveLength(3);

    const passed = evaluateConferenceGate({
      items: [
        { totalQtyWithLoss: 10, unitDirectCost: 120, sanityFlag: null },
        { totalQtyWithLoss: 2.4, unitDirectCost: 500, sanityFlag: null },
      ],
      conflicts: [{ status: "RESOLVIDO" }],
    });

    expect(passed.approved).toBe(true);
    expect(passed.blockers).toHaveLength(0);
    expect(passed.summary.pricedItemsCount).toBe(2);
  });
});
