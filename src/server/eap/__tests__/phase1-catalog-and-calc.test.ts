import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  computeEapEngineeringIndicators,
  computeEapLine,
  computeEapStageSummary,
  computeWorkingDaysDuration,
  toIsoDateKeyUTC,
} from "@/server/eap/calculator";
import {
  DEFAULT_EAP_ZONES,
  DEFAULT_PROPOSAL_EXCLUSIONS,
  DEFAULT_PROPOSAL_PREMISES,
  MASTER_EAP_STAGES,
  MASTER_LOB_PACKAGES,
} from "@/server/eap/templates/residential-master";

describe("EAP Fase 1 — Calculadora & Templates Mestres", () => {
  it("calcula soma das 4 zonas, fator de perda e preço tripartido × Mark-Up", () => {
    const res = computeEapLine({
      description: "Concreto Usinado fck 30 MPa",
      category: "CONCRETO",
      unit: "m³",
      zoneQuantities: {
        FUND_TERREO: 40,
        PAV_SUPERIOR: 35,
        COBERTURA: 15,
        EXTERNO: 10,
      },
      lossPercent: 5,
      materialUnitCost: 595,
      laborUnitCost: 68,
      thirdPartyUnitCost: 65,
      markupMultiplier: 1.22,
    });

    expect(res.rawQuantity).toBe(100);
    expect(res.quantityWithLoss).toBe(105);
    expect(res.directUnitCost).toBe(728);
    expect(res.commercialUnitPrice).toBe(888.16);
    expect(res.totalMaterialCost).toBe(62475);
    expect(res.totalLaborCost).toBe(7140);
    expect(res.totalThirdPartyCost).toBe(6825);
    expect(res.totalDirectCost).toBe(76440);
    expect(res.totalCommercialPrice).toBe(93256.8);
  });

  it("calcula Taxa de Aço ponderada (kg/m³), Concreto/m² e Alvenaria/m² sem erro de média simples", () => {
    const lines = [
      {
        description: "Concreto Fundação",
        category: "CONCRETO",
        unit: "m³",
        zoneQuantities: { FUND_TERREO: 20 },
        lossPercent: 0,
        materialUnitCost: 560,
        laborUnitCost: 68,
        thirdPartyUnitCost: 65,
        markupMultiplier: 1.2,
      },
      {
        description: "Concreto Supraestrutura",
        category: "CONCRETO",
        unit: "m³",
        zoneQuantities: { PAV_SUPERIOR: 80 },
        lossPercent: 0,
        materialUnitCost: 595,
        laborUnitCost: 68,
        thirdPartyUnitCost: 65,
        markupMultiplier: 1.2,
      },
      {
        description: "Aço CA-50 Ø 10,0 mm",
        category: "ACO",
        unit: "kg",
        zoneQuantities: { FUND_TERREO: 1500, PAV_SUPERIOR: 7500 },
        lossPercent: 0,
        materialUnitCost: 7.8,
        laborUnitCost: 3.1,
        thirdPartyUnitCost: 0,
        markupMultiplier: 1.2,
      },
      {
        description: "Alvenaria Bloco Cerâmico TJC14",
        category: "ALVENARIA",
        unit: "m²",
        zoneQuantities: { FUND_TERREO: 220, PAV_SUPERIOR: 180 },
        lossPercent: 0,
        materialUnitCost: 56,
        laborUnitCost: 34,
        thirdPartyUnitCost: 0,
        markupMultiplier: 1.2,
      },
    ];

    const indicators = computeEapEngineeringIndicators(lines, 250);
    expect(indicators.totalConcreteM3).toBe(100);
    expect(indicators.totalSteelKg).toBe(9000);
    expect(indicators.steelRateKgPerM3).toBe(90); // 9000 / 100 = 90 kg/m³
    expect(indicators.concreteM3PerM2).toBe(0.4); // 100 / 250 = 0.40 m³/m²
    expect(indicators.masonryM2PerM2).toBe(1.6); // 400 / 250 = 1.60 m²/m²
    expect(indicators.directCostPerM2).toBeGreaterThan(0);
    expect(indicators.commercialCostPerM2).toBeGreaterThan(indicators.directCostPerM2);

    const stageSummary = computeEapStageSummary("04", lines.slice(0, 3));
    expect(stageSummary.itemsCount).toBe(3);
    expect(stageSummary.totalDirectCost).toBeGreaterThan(0);
  });

  it("calcula duração em dias úteis e pula fins de semana e feriados regionais do Ceará", () => {
    // 100 m² com produtividade de 16 m²/dia e 2 equipes => ceil(100 / 32) = 4 dias úteis
    expect(computeWorkingDaysDuration(100, 16, 2)).toBe(4);
    expect(computeWorkingDaysDuration(0, 16, 2)).toBe(0);

    // Março/2026: 18/03 (qua) -> 19/03 (qui, São José - CE) -> 20/03 (sex) -> 21-22 (fds) -> 23/03 (seg) -> 24/03 (ter) -> 25/03 (qua, Data Magna CE) -> 26/03 (qui)
    const cearaHolidays = ["2026-03-19", "2026-03-25"];
    const start = new Date("2026-03-18T00:00:00.000Z");
    const end = addWorkingDays(start, 5, cearaHolidays);
    // Dias úteis contados: 18/03 (1), 20/03 (2), 23/03 (3), 24/03 (4), 26/03 (5)
    expect(toIsoDateKeyUTC(end)).toBe("2026-03-26");
  });

  it("valida integridade do Template Mestre (4 Zonas, 26 Macro-Etapas EAP e 38 Pacotes LOB)", () => {
    expect(DEFAULT_EAP_ZONES).toHaveLength(4);
    expect(MASTER_EAP_STAGES).toHaveLength(26);
    expect(MASTER_EAP_STAGES[0].code).toBe("01");
    expect(MASTER_EAP_STAGES[25].code).toBe("26");
    expect(DEFAULT_PROPOSAL_PREMISES.length).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_PROPOSAL_EXCLUSIONS.length).toBeGreaterThanOrEqual(4);

    expect(MASTER_LOB_PACKAGES).toHaveLength(38);
    const pct16 = MASTER_LOB_PACKAGES.find((p) => p.packageNumber === 16);
    expect(pct16?.name).toContain("Reservatório Superior");

    const guardaCorpo = MASTER_LOB_PACKAGES.find((p) => p.name.includes("Guarda-Corpos"));
    const limpezaFinal = MASTER_LOB_PACKAGES.find((p) => p.name.includes("Limpeza Final"));
    expect(guardaCorpo).toBeDefined();
    expect(limpezaFinal).toBeDefined();
    expect(guardaCorpo!.packageNumber).toBeLessThan(limpezaFinal!.packageNumber);
    expect(limpezaFinal!.predecessorNumbers).toContain(guardaCorpo!.packageNumber);
  });
});
