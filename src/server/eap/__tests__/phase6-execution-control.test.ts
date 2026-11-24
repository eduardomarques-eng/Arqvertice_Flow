import { describe, expect, it } from "vitest";
import {
  buildAdditiveBaselineSnapshot,
  buildProgressEvolutionPayload,
  classifyStageTrafficLight,
  computeExecutionDashboard,
  renderProgressEvolutionPdf,
  type ExecutionDashboardInput,
} from "../execution-control";

function makeSampleInput(): ExecutionDashboardInput {
  return {
    projectId: "proj-001",
    projectName: "Residência Praia das Dunas",
    clientName: "Carlos Eduardo",
    cityLabel: "Fortaleza/CE",
    builtAreaM2: 320,
    status: "EM_EXECUCAO",
    currentRevision: 1,
    referenceDate: "2026-04-30",
    zones: [
      { code: "FUND_TERREO", name: "Fundação e Térreo" },
      { code: "PAV_SUPERIOR", name: "Pavimento Superior" },
    ],
    stages: [
      {
        code: "04",
        name: "INFRAESTRUTURA (FUNDAÇÕES)",
        totalMaterial: 50000,
        totalLabor: 30000,
        totalThirdParty: 20000,
        totalDirectCost: 100000,
        totalCommercialPrice: 120000,
      },
      {
        code: "05",
        name: "SUPRAESTRUTURA",
        totalMaterial: 100000,
        totalLabor: 60000,
        totalThirdParty: 20000,
        totalDirectCost: 180000,
        totalCommercialPrice: 200000,
      },
      {
        code: "06",
        name: "ALVENARIA E VEDAÇÕES",
        totalMaterial: 40000,
        totalLabor: 30000,
        totalThirdParty: 10000,
        totalDirectCost: 80000,
        totalCommercialPrice: 80000,
      },
    ],
    packages: [
      {
        id: "pkg-1",
        packageNumber: 1,
        name: "Fundações e Baldrames",
        waveName: "Onda 1 - Estrutura",
        linkedStageCodes: ["04"],
        segments: [
          {
            id: "seg-1",
            zoneCode: "FUND_TERREO",
            startDate: "2026-03-01",
            endDate: "2026-03-31",
            workingDays: 22,
            progressPercent: 100,
          },
        ],
      },
      {
        id: "pkg-2",
        packageNumber: 2,
        name: "Supraestrutura Concreto Armado",
        waveName: "Onda 1 - Estrutura",
        linkedStageCodes: ["05"],
        segments: [
          {
            id: "seg-2",
            zoneCode: "FUND_TERREO",
            startDate: "2026-04-01",
            endDate: "2026-05-31",
            workingDays: 40,
            progressPercent: 50,
          },
        ],
      },
      {
        id: "pkg-3",
        packageNumber: 3,
        name: "Alvenaria Estrutural/Vedação",
        waveName: "Onda 2 - Vedações",
        linkedStageCodes: ["06"],
        segments: [
          {
            id: "seg-3",
            zoneCode: "PAV_SUPERIOR",
            startDate: "2026-06-01",
            endDate: "2026-06-30",
            workingDays: 20,
            progressPercent: 0,
          },
        ],
      },
    ],
    monthlySeries: [
      {
        monthKey: "2026-03",
        label: "Mar/26",
        materialCost: 50000,
        laborCost: 30000,
        thirdPartyCost: 20000,
        directCost: 100000,
        commercialCost: 120000,
        cumulativeCommercialCost: 120000,
        physicalPercentPeriod: 30,
        cumulativePhysicalPercent: 30,
        cumulativeFinancialPercent: 30,
      },
      {
        monthKey: "2026-04",
        label: "Abr/26",
        materialCost: 50000,
        laborCost: 30000,
        thirdPartyCost: 10000,
        directCost: 90000,
        commercialCost: 100000,
        cumulativeCommercialCost: 220000,
        physicalPercentPeriod: 25,
        cumulativePhysicalPercent: 55,
        cumulativeFinancialPercent: 55,
      },
      {
        monthKey: "2026-05",
        label: "Mai/26",
        materialCost: 50000,
        laborCost: 30000,
        thirdPartyCost: 10000,
        directCost: 90000,
        commercialCost: 100000,
        cumulativeCommercialCost: 320000,
        physicalPercentPeriod: 25,
        cumulativePhysicalPercent: 80,
        cumulativeFinancialPercent: 80,
      },
      {
        monthKey: "2026-06",
        label: "Jun/26",
        materialCost: 40000,
        laborCost: 30000,
        thirdPartyCost: 10000,
        directCost: 80000,
        commercialCost: 80000,
        cumulativeCommercialCost: 400000,
        physicalPercentPeriod: 20,
        cumulativePhysicalPercent: 100,
        cumulativeFinancialPercent: 100,
      },
    ],
    totalWorkingDays: 82,
    startDate: "2026-03-01",
    endDate: "2026-06-30",
    measurements: [
      {
        id: "meas-1",
        referenceDate: "2026-03-31",
        periodLabel: "Medição #01 - Mar/2026",
        physicalProgressPercent: 30,
        realizedMaterialCost: 65000,
        realizedLaborCost: 40000,
        realizedThirdPartyCost: 25000,
        notes: "Fundação concluída com reforço de estacas",
        detailsJson: {
          stageCosts: [{ stageCode: "04", material: 65000, labor: 40000, thirdParty: 25000 }],
        },
      },
      {
        id: "meas-2",
        referenceDate: "2026-04-30",
        periodLabel: "Medição #02 - Abr/2026",
        physicalProgressPercent: 55,
        realizedMaterialCost: 95000,
        realizedLaborCost: 65000,
        realizedThirdPartyCost: 20000,
        notes: "Laje térreo concretada",
        detailsJson: {
          stageCosts: [{ stageCode: "05", material: 95000, labor: 65000, thirdParty: 20000 }],
        },
      },
    ],
    baselineSnapshots: [
      {
        id: "snap-1",
        versionLabel: "v1.0",
        totalDirectCost: 360000,
        totalCommercialPrice: 400000,
        costPerM2: 1250,
        approvedAt: "2026-02-20",
        snapshotJson: { versionLabel: "v1.0" },
      },
    ],
    procurementGates: [
      {
        id: "gate-1",
        packageName: "Alvenaria Estrutural/Vedação",
        title: "Blocos cerâmicos e argamassa",
        triggerDate: "2026-05-10",
        leadTimeDays: 15,
        status: "PENDENTE",
      },
    ],
    financialPaymentsTotal: 310000,
  };
}

describe("Fase 6 — Ciclo II: Controle de Obra, SPI/CPI, Semáforo, Aditivos e PDF de Evolução", () => {
  it("calcula SPI (prazo), CPI (custo), Curva S dupla e saldo corretamente", () => {
    const dash = computeExecutionDashboard(makeSampleInput());

    // Ponderação financeira: etapa 04 (120k * 100%) + etapa 05 (200k * 50%) + etapa 06 (80k * 0%) = 220k / 400k = 55%
    expect(dash.kpis.plannedPhysicalPercent).toBe(55);
    expect(dash.kpis.realizedPhysicalPercent).toBe(55);
    expect(dash.kpis.spi).toBe(1);
    expect(dash.kpis.scheduleVarianceWorkingDays).toBe(0);

    // Valor Agregado = 55% de 400.000 = 220.000; Realizado = 130.000 + 180.000 = 310.000 => CPI = 220/310 = 0.71
    expect(dash.kpis.earnedValue).toBe(220000);
    expect(dash.kpis.realizedTotal).toBe(310000);
    expect(dash.kpis.cpi).toBe(0.71);
    expect(dash.kpis.remainingBudget).toBe(90000);

    // Curva S dupla: meses até Abr/26 possuem realizado, Mai/26 e Jun/26 ficam null
    expect(dash.dualSCurve).toHaveLength(4);
    expect(dash.dualSCurve[0].realizedPhysicalPct).toBe(30);
    expect(dash.dualSCurve[1].realizedPhysicalPct).toBe(55);
    expect(dash.dualSCurve[2].realizedPhysicalPct).toBeNull();
    expect(dash.dualSCurve[3].realizedFinancialAccumulated).toBeNull();
  });

  it("classifica corretamente o semáforo financeiro por etapa (SAUDAVEL, ATENCAO, ESTOURO)", () => {
    expect(
      classifyStageTrafficLight({
        budgetedCommercial: 100000,
        realizedTotal: 50000,
        spi: 1,
        physicalProgressPercent: 50,
      })
    ).toBe("SAUDAVEL");

    expect(
      classifyStageTrafficLight({
        budgetedCommercial: 100000,
        realizedTotal: 90000,
        spi: 1,
        physicalProgressPercent: 85,
      })
    ).toBe("ATENCAO");

    expect(
      classifyStageTrafficLight({
        budgetedCommercial: 100000,
        realizedTotal: 112000,
        spi: 1,
        physicalProgressPercent: 100,
      })
    ).toBe("ESTOURO");

    // Na matriz do dashboard de exemplo:
    // Etapa 04: 130k / 120k = 108.3% -> ESTOURO
    // Etapa 05: 180k / 200k = 90.0% -> ATENCAO
    // Etapa 06: 0 / 80k = 0% -> SAUDAVEL
    const dash = computeExecutionDashboard(makeSampleInput());
    const st04 = dash.stageMatrix.find((s) => s.code === "04");
    const st05 = dash.stageMatrix.find((s) => s.code === "05");
    const st06 = dash.stageMatrix.find((s) => s.code === "06");

    expect(st04?.status).toBe("ESTOURO");
    expect(st05?.status).toBe("ATENCAO");
    expect(st06?.status).toBe("SAUDAVEL");
  });

  it("cria revisão aditiva (Baseline v1.0 -> v2.0) preservando snapshot anterior e calculando delta", () => {
    const additive = buildAdditiveBaselineSnapshot({
      existingSnapshotsCount: 1,
      previousSnapshot: {
        versionLabel: "v1.0",
        totalCommercialPrice: 400000,
        totalDirectCost: 360000,
      },
      newTotalDirectCost: 405000,
      newTotalCommercialPrice: 460000,
      newCostPerM2: 1437.5,
      reason: "Inclusão de piscina aquecida e deck externo",
    });

    expect(additive.versionLabel).toBe("v2.0");
    expect(additive.nextRevisionNumber).toBe(2);
    expect(additive.deltaCommercialAmount).toBe(60000);
    expect(additive.deltaCommercialPercent).toBe(15);
    expect(additive.snapshotJson.previousVersionLabel).toBe("v1.0");
    expect(additive.snapshotJson.reason).toBe("Inclusão de piscina aquecida e deck externo");

    // Confirma que o histórico no dashboard preserva v1.0 e v2.0 com delta calculado
    const input = makeSampleInput();
    input.baselineSnapshots.push({
      id: "snap-2",
      versionLabel: additive.versionLabel,
      totalDirectCost: additive.totalDirectCost,
      totalCommercialPrice: additive.totalCommercialPrice,
      costPerM2: additive.costPerM2,
      approvedAt: "2026-05-02",
      snapshotJson: additive.snapshotJson,
    });
    const dash = computeExecutionDashboard(input);
    expect(dash.baselineHistory).toHaveLength(2);
    expect(dash.baselineHistory[0].versionLabel).toBe("v2.0");
    expect(dash.baselineHistory[0].deltaCommercialAmount).toBe(60000);
    expect(dash.baselineHistory[1].versionLabel).toBe("v1.0");
  });

  it("gera buffer %PDF- válido do Boletim Periódico de Evolução e aplica filtro CLIENT", () => {
    const dash = computeExecutionDashboard(makeSampleInput());
    const clientFiltered = buildProgressEvolutionPayload(dash, "CLIENT");
    expect(clientFiltered.baselineHistory[0].totalDirectCost).toBe(0);
    expect(clientFiltered.stageMatrix[0].budgetedMaterial).toBe(0);

    const pdfBytes = renderProgressEvolutionPdf(dash, "CLIENT");
    const header = Buffer.from(pdfBytes.slice(0, 8)).toString("ascii");
    expect(header.startsWith("%PDF-")).toBe(true);
    expect(pdfBytes.byteLength).toBeGreaterThan(1200);
  });
});
