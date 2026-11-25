import { describe, expect, it } from "vitest";
import {
  REGIONAL_CITY_MULTIPLIERS,
  computeMultiStandardItemPrices,
  previewMultiStandardTriage,
  type TriagePreviewItemInput,
} from "@/server/eap/regional-standards-catalog";

describe("Fase 28 — Catálogos Regionais Multi-Padrão (Baixo, Médio, Alto) & Triagem Inteligente", () => {
  it("diferencia fortemente Acabamentos/Pedras/Louças entre padrões e mantém variação controlada em Estrutura/Concreto", () => {
    // Etapa 04 (Estrutura - Concreto C35) -> variação controlada (0.94x / 1.00x / 1.08x)
    const concLow = computeMultiStandardItemPrices({
      stageCode: "04",
      unit: "m³",
      materialUnitCost: 630,
      laborUnitCost: 165,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "BAIXO_PADRAO",
      currentMaterialFactor: 1.0,
      currentLaborFactor: 1.0,
      targetMaterialFactor: 1.0,
      targetLaborFactor: 1.0,
    });
    const concHigh = computeMultiStandardItemPrices({
      stageCode: "04",
      unit: "m³",
      materialUnitCost: 630,
      laborUnitCost: 165,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "ALTO_PADRAO",
      currentMaterialFactor: 1.0,
      currentLaborFactor: 1.0,
      targetMaterialFactor: 1.0,
      targetLaborFactor: 1.0,
    });

    expect(concHigh.materialUnitCost / concLow.materialUnitCost).toBeLessThan(1.2);
    expect(concLow.tier).toBe("ESTRUTURAL_BRUTO");

    // Etapa 14 (Porcelanato / Pisos) -> alta diferenciação (R$ 68+38 vs R$ 135+52 vs R$ 290+78)
    const pisoLow = computeMultiStandardItemPrices({
      stageCode: "14",
      unit: "m²",
      materialUnitCost: 135,
      laborUnitCost: 52,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "BAIXO_PADRAO",
      currentMaterialFactor: 1.0,
      currentLaborFactor: 1.0,
      targetMaterialFactor: 1.0,
      targetLaborFactor: 1.0,
    });
    const pisoMid = computeMultiStandardItemPrices({
      stageCode: "14",
      unit: "m²",
      materialUnitCost: 135,
      laborUnitCost: 52,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "MEDIO_PADRAO",
      currentMaterialFactor: 1.0,
      currentLaborFactor: 1.0,
      targetMaterialFactor: 1.0,
      targetLaborFactor: 1.0,
    });
    const pisoHigh = computeMultiStandardItemPrices({
      stageCode: "14",
      unit: "m²",
      materialUnitCost: 135,
      laborUnitCost: 52,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "ALTO_PADRAO",
      currentMaterialFactor: 1.0,
      currentLaborFactor: 1.0,
      targetMaterialFactor: 1.0,
      targetLaborFactor: 1.0,
    });

    expect(pisoLow.materialUnitCost).toBe(68);
    expect(pisoLow.laborUnitCost).toBe(38);
    expect(pisoMid.materialUnitCost).toBe(135);
    expect(pisoMid.laborUnitCost).toBe(52);
    expect(pisoHigh.materialUnitCost).toBe(290);
    expect(pisoHigh.laborUnitCost).toBe(78);
    expect(pisoHigh.tier).toBe("ACABAMENTO_NOBRE");
  });

  it("aplica multiplicadores regionais de Mão de Obra e Material por cidade (Fortaleza vs Eusébio vs São Paulo)", () => {
    const fort = REGIONAL_CITY_MULTIPLIERS.find((c) => c.key === "FORTALEZA_CE")!;
    const eus = REGIONAL_CITY_MULTIPLIERS.find((c) => c.key === "EUSEBIO_AQUIRAZ_CE")!;
    const sp = REGIONAL_CITY_MULTIPLIERS.find((c) => c.key === "SAO_PAULO_SP")!;

    const fortPiso = computeMultiStandardItemPrices({
      stageCode: "14",
      unit: "m²",
      materialUnitCost: 135,
      laborUnitCost: 52,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "ALTO_PADRAO",
      currentMaterialFactor: fort.regionalMaterialFactor,
      currentLaborFactor: fort.regionalLaborFactor,
      targetMaterialFactor: fort.regionalMaterialFactor,
      targetLaborFactor: fort.regionalLaborFactor,
    });

    const eusPiso = computeMultiStandardItemPrices({
      stageCode: "14",
      unit: "m²",
      materialUnitCost: 135,
      laborUnitCost: 52,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "ALTO_PADRAO",
      currentMaterialFactor: fort.regionalMaterialFactor,
      currentLaborFactor: fort.regionalLaborFactor,
      targetMaterialFactor: eus.regionalMaterialFactor,
      targetLaborFactor: eus.regionalLaborFactor,
    });

    const spPiso = computeMultiStandardItemPrices({
      stageCode: "14",
      unit: "m²",
      materialUnitCost: 135,
      laborUnitCost: 52,
      thirdPartyUnitCost: 0,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "ALTO_PADRAO",
      currentMaterialFactor: fort.regionalMaterialFactor,
      currentLaborFactor: fort.regionalLaborFactor,
      targetMaterialFactor: sp.regionalMaterialFactor,
      targetLaborFactor: sp.regionalLaborFactor,
    });

    expect(eusPiso.laborUnitCost).toBeGreaterThan(fortPiso.laborUnitCost);
    expect(spPiso.laborUnitCost).toBeGreaterThan(eusPiso.laborUnitCost);
    expect(spPiso.materialUnitCost).toBeGreaterThan(fortPiso.materialUnitCost);
  });

  it("preserva itens EDITADO_USUARIO no modo seguro da Triagem Inteligente e permite sobrescrever quando solicitado", () => {
    const items: TriagePreviewItemInput[] = [
      {
        id: "item-auto",
        stageCode: "14",
        stageName: "Pisos, Porcelanatos e Rodapés",
        description: "Porcelanato Retificado",
        unit: "m²",
        dataOrigin: "QUANTITATIVO_IMPORTADO",
        zoneQuantities: { FUND_TERREO: 100, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
        lossPercent: 10,
        materialUnitCost: 135,
        laborUnitCost: 52,
        thirdPartyUnitCost: 0,
        markupMultiplier: 1,
      },
      {
        id: "item-manual",
        stageCode: "20",
        stageName: "Louças, Metais e Acessórios",
        description: "Kit Banheira Master Editado Manualmente",
        unit: "vb",
        dataOrigin: "EDITADO_USUARIO",
        zoneQuantities: { FUND_TERREO: 0, PAV_SUPERIOR: 1, COBERTURA: 0, EXTERNO: 0 },
        lossPercent: 0,
        materialUnitCost: 18500,
        laborUnitCost: 3900,
        thirdPartyUnitCost: 0,
        markupMultiplier: 1,
      },
    ];

    const safePreview = previewMultiStandardTriage({
      items,
      bdiPercent: 22,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "ALTO_PADRAO",
      currentMaterialFactor: 1.0,
      currentLaborFactor: 1.0,
      targetMaterialFactor: 1.0,
      targetLaborFactor: 1.0,
      includeUserEdited: false,
    });

    expect(safePreview.updatedItemsCount).toBe(1);
    expect(safePreview.preservedEditedCount).toBe(1);
    expect(safePreview.itemUpdates[0].id).toBe("item-auto");

    const forcePreview = previewMultiStandardTriage({
      items,
      bdiPercent: 22,
      currentStandard: "MEDIO_PADRAO",
      targetStandard: "ALTO_PADRAO",
      currentMaterialFactor: 1.0,
      currentLaborFactor: 1.0,
      targetMaterialFactor: 1.0,
      targetLaborFactor: 1.0,
      includeUserEdited: true,
    });

    expect(forcePreview.updatedItemsCount).toBe(2);
    expect(forcePreview.preservedEditedCount).toBe(0);
  });
});
