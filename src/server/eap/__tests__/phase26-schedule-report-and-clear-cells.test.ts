import { describe, expect, it } from "vitest";
import {
  buildEapScheduleReportPayload,
  renderEapScheduleReportPdf,
} from "@/server/eap/eap-schedule-report";
import {
  renderEapCostReportPdf,
  type EapCostReportPayload,
} from "@/server/eap/eap-cost-report";
import {
  DEFAULT_LOB_FLOORS,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
  type LobFloorAllocationItem,
} from "@/lib/eap-lob-grid";
import {
  clearEapItemsValues,
  clearLobAllocationsByMode,
} from "@/lib/eap-clear-helpers";

describe("Fase 26 — Relatório Isolado de Planejamento, Gráficos Custos EAP e Limpar Células", () => {
  const samplePackages: FloorMatrixServicePackage[] = [
    {
      packageNumber: 1,
      name: "Canteiro, Muro e Tapume",
      discipline: "Preliminares",
      corHex: "#1D4ED8",
      textHex: "#FFFFFF",
      predecessorNumbers: [],
      productivityPerDay: 20,
      productivityUnit: "m²",
      linkedEapStageCodes: ["01"],
      isActive: true,
    },
    {
      packageNumber: 4,
      name: "Fundações",
      discipline: "Estrutura",
      corHex: "#047857",
      textHex: "#FFFFFF",
      predecessorNumbers: [1],
      productivityPerDay: 10,
      productivityUnit: "m³",
      linkedEapStageCodes: ["03"],
      isActive: true,
    },
  ];

  const sampleTeams: FloorMatrixWorkTeam[] = [
    {
      teamCode: "A",
      name: "Equipe A — Estrutura",
      specialty: "Estrutura",
      maxDailyHours: 8,
      maxSimultaneousFronts: 2,
      workers: [{ roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 40 }],
    },
  ];

  const sampleAllocs: LobFloorAllocationItem[] = [
    {
      floorId: "FUNDACAO",
      floorName: "Infraestrutura / Fundação",
      floorOrder: 1,
      dateIso: "2027-02-01",
      teamCode: "A",
      packageNumber: 1,
      isOvertime: false,
      dataOrigin: "PRELIMINAR_PADRAO",
    },
    {
      floorId: "FUNDACAO",
      floorName: "Infraestrutura / Fundação",
      floorOrder: 1,
      dateIso: "2027-02-02",
      teamCode: "A",
      packageNumber: 1,
      isOvertime: false,
      dataOrigin: "PRELIMINAR_PADRAO",
    },
    {
      floorId: "FUNDACAO",
      floorName: "Infraestrutura / Fundação",
      floorOrder: 1,
      dateIso: "2027-02-08",
      teamCode: "A",
      packageNumber: 4,
      isOvertime: false,
      dataOrigin: "QUANTITATIVO_IMPORTADO",
    },
  ];

  it("gera Relatório Isolado de Planejamento consolidado e PDF vetorial válido sem 'Onda'", () => {
    const payload = buildEapScheduleReportPayload({
      meta: {
        projectId: "proj-1",
        projectName: "Residência de Praia",
        clientName: "Pedro",
        cityLabel: "Fortaleza/CE",
        title: "Planejamento LOB",
        builtAreaM2: 250,
        status: "EM_EXECUCAO",
      },
      allocations: sampleAllocs,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: samplePackages,
      workTeams: sampleTeams,
      holidaySet: new Set(),
    });

    expect(payload.kpis.startDate).toBe("2027-02-01");
    expect(payload.kpis.endDate).toBe("2027-02-08");
    expect(payload.kpis.activePackagesCount).toBe(2);
    expect(payload.kpis.totalAllocatedCells).toBe(3);
    expect(payload.kpis.teamOverloads).toBe(0);
    expect(payload.kpis.precedenceViolations).toBe(0);
    expect(payload.monthlyHistogram).toHaveLength(1);
    expect(payload.monthlyHistogram[0].totalDays).toBe(3);

    const pdfBytes = renderEapScheduleReportPdf(payload);
    const pdfStr = Buffer.from(pdfBytes).toString("latin1");
    expect(pdfStr.startsWith("%PDF-")).toBe(true);
    expect(pdfStr).not.toMatch(/\bOnda\b/i);
  });

  it("gera PDF de Custos da EAP com Donut, Material x MO por Pavimento e Curva ABC Pareto", () => {
    const mockCostPayload: EapCostReportPayload = {
      meta: {
        projectId: "proj-1",
        projectName: "Residência de Praia",
        clientName: "Pedro",
        cityLabel: "Fortaleza/CE",
        title: "EAP Custos",
        builtAreaM2: 250,
        bdiPercent: 22,
        status: "EM_CONFERENCIA",
        revision: 1,
        isParametricFallback: false,
      },
      kpis: {
        totalMaterialCost: 500_000,
        totalLaborCost: 350_000,
        totalThirdPartyCost: 50_000,
        totalDirectCost: 900_000,
        bdiValue: 198_000,
        bdiPercent: 22,
        totalCommercialPrice: 1_098_000,
        directCostPerM2: 3_600,
        costPerM2: 4_392,
        materialSharePercent: 55.6,
        laborSharePercent: 38.9,
        thirdPartySharePercent: 5.5,
        totalItemsCount: 10,
        concreteM3: 35.5,
        steelKg: 2015,
        masonryM2: 747.6,
        ceramicTileM2: 294.8,
        roofM2: 195,
      },
      byFloor: [
        {
          code: "FUND_TERREO",
          label: "Fundação & Térreo",
          materialCost: 300_000,
          laborCost: 200_000,
          thirdPartyCost: 20_000,
          directCost: 520_000,
          commercialPrice: 634_400,
          sharePercent: 57.8,
        },
        {
          code: "PAV_SUPERIOR",
          label: "Pav. Superior",
          materialCost: 200_000,
          laborCost: 150_000,
          thirdPartyCost: 30_000,
          directCost: 380_000,
          commercialPrice: 463_600,
          sharePercent: 42.2,
        },
      ],
      byDiscipline: [
        {
          discipline: "Estrutura",
          materialCost: 300_000,
          laborCost: 200_000,
          thirdPartyCost: 0,
          directCost: 500_000,
          commercialPrice: 610_000,
          sharePercent: 55.6,
          itemsCount: 5,
        },
      ],
      byPhase: [
        {
          phaseCode: "F2",
          phaseName: "Fase 2 — Estrutura",
          materialCost: 300_000,
          laborCost: 200_000,
          thirdPartyCost: 0,
          directCost: 500_000,
          commercialPrice: 610_000,
          sharePercent: 55.6,
          stagesCount: 2,
          itemsCount: 5,
        },
      ],
      stages: [
        {
          code: "04",
          name: "Supraestrutura",
          discipline: "Estrutura",
          phaseName: "Fase 2 — Estrutura",
          materialCost: 300_000,
          laborCost: 200_000,
          thirdPartyCost: 0,
          directCost: 500_000,
          commercialPrice: 610_000,
          sharePercent: 55.6,
          itemsCount: 5,
        },
      ],
      abcCurve: {
        items: [
          {
            rank: 1,
            code: "TQS-04.05",
            description: "Aço estrutural CA-50/CA-60",
            stageCode: "04",
            stageName: "Supraestrutura",
            unit: "kg",
            quantity: 1877,
            totalCommercialPrice: 27_479,
            sharePercent: 60,
            cumulativePercent: 60,
            abcClass: "A",
          },
        ],
        summaryByClass: {
          A: { count: 1, totalValue: 27_479, sharePercent: 60 },
          B: { count: 0, totalValue: 0, sharePercent: 0 },
          C: { count: 0, totalValue: 0, sharePercent: 0 },
        },
      },
      teams: [],
      premises: [],
      exclusions: [],
    };

    const pdfBytes = renderEapCostReportPdf(mockCostPayload);
    const pdfStr = Buffer.from(pdfBytes).toString("latin1");
    expect(pdfStr.startsWith("%PDF-")).toBe(true);
    expect(pdfBytes.byteLength).toBeGreaterThan(2000);
  });

  it("limpa itens da EAP por seleção, apenas preliminares ou planilha completa preservando origem importada", () => {
    const items = [
      {
        id: "i1",
        dataOrigin: "PRELIMINAR_PADRAO",
        zoneQuantities: { FUND_TERREO: 10, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
        materialUnitCost: 50,
        laborUnitCost: 30,
        thirdPartyUnitCost: 0,
      },
      {
        id: "i2",
        dataOrigin: "QUANTITATIVO_IMPORTADO",
        zoneQuantities: { FUND_TERREO: 20, PAV_SUPERIOR: 15, COBERTURA: 0, EXTERNO: 0 },
        materialUnitCost: 120,
        laborUnitCost: 80,
        thirdPartyUnitCost: 10,
      },
    ];

    const prelimRes = clearEapItemsValues(items, "PRELIMINARY");
    expect(prelimRes.changedIds).toEqual(["i1"]);
    expect(prelimRes.nextItems[0].zoneQuantities.FUND_TERREO).toBe(0);
    expect(prelimRes.nextItems[0].materialUnitCost).toBe(0);
    expect(prelimRes.nextItems[1].zoneQuantities.FUND_TERREO).toBe(20);

    const selRes = clearEapItemsValues(items, "SELECTED", new Set(["i2"]));
    expect(selRes.changedIds).toEqual(["i2"]);
    expect(selRes.nextItems[1].materialUnitCost).toBe(0);
    expect(selRes.nextItems[0].materialUnitCost).toBe(50);

    const allRes = clearEapItemsValues(items, "ALL");
    expect(allRes.changedIds).toEqual(["i1", "i2"]);
  });

  it("limpa alocações LOB por seleção, apenas preliminares ou grade completa", () => {
    const prelimRes = clearLobAllocationsByMode(sampleAllocs, "PRELIMINARY");
    expect(prelimRes.removedCount).toBe(2);
    expect(prelimRes.nextAllocations).toHaveLength(1);
    expect(prelimRes.nextAllocations[0].packageNumber).toBe(4);

    const selRes = clearLobAllocationsByMode(
      sampleAllocs,
      "SELECTED",
      new Set(["FUNDACAO::2027-02-01"])
    );
    expect(selRes.removedCount).toBe(1);
    expect(selRes.nextAllocations).toHaveLength(2);

    const allRes = clearLobAllocationsByMode(sampleAllocs, "ALL");
    expect(allRes.removedCount).toBe(3);
    expect(allRes.nextAllocations).toHaveLength(0);
  });
});
