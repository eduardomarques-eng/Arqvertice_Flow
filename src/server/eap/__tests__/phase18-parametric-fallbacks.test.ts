import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOB_FLOORS,
  generateIntelligentFloorLobMatrix,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
} from "@/lib/eap-lob-grid";
import {
  buildParametricExecutiveFallback,
  renderExecutiveReportPdf,
  type ExecutiveReportPayload,
} from "../executive-report";
import { buildParametricFieldMeasurementRows } from "../field-measurement";

describe("Fase 15 Final — Fallbacks Paramétricos Independentes (LOB, Relatório Executivo & Medição)", () => {
  it("gera matriz LOB (A1, A2, B...) com EAP totalmente vazia usando área construída e capacidade das equipes", () => {
    const packages: FloorMatrixServicePackage[] = [
      {
        packageNumber: 1,
        name: "Infraestrutura & Fundação",
        discipline: "Estrutura",
        corHex: "#1E293B",
        textHex: "#FFFFFF",
        predecessorNumbers: [],
        productivityPerDay: 12,
        productivityUnit: "m²/dia",
        linkedEapStageCodes: ["03"],
        isActive: true,
      },
      {
        packageNumber: 2,
        name: "Supraestrutura",
        discipline: "Estrutura",
        corHex: "#0F766E",
        textHex: "#FFFFFF",
        predecessorNumbers: [1],
        productivityPerDay: 15,
        productivityUnit: "m²/dia",
        linkedEapStageCodes: ["04"],
        isActive: true,
      },
      {
        packageNumber: 3,
        name: "Alvenaria & Vedações",
        discipline: "Arquitetura",
        corHex: "#B45309",
        textHex: "#FFFFFF",
        predecessorNumbers: [2],
        productivityPerDay: 20,
        productivityUnit: "m²/dia",
        linkedEapStageCodes: ["05"],
        isActive: true,
      },
    ];

    const teams: FloorMatrixWorkTeam[] = [
      {
        teamCode: "A",
        name: "Equipe A",
        specialty: "Estrutura",
        maxDailyHours: 8,
        maxSimultaneousFronts: 1,
        workers: [{ roleName: "Pedreiro", headcount: 2, dailyRate: 220, socialChargesPct: 40 }],
      },
      {
        teamCode: "B",
        name: "Equipe B",
        specialty: "Alvenaria",
        maxDailyHours: 8,
        maxSimultaneousFronts: 1,
        workers: [{ roleName: "Pedreiro", headcount: 2, dailyRate: 210, socialChargesPct: 40 }],
      },
    ];

    const res = generateIntelligentFloorLobMatrix({
      startDate: "2026-04-01",
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: packages,
      workTeams: teams,
      stageLoads: [
        {
          stageCode: "03",
          stageName: "Fundações",
          floorQuantities: { FUNDACAO: 0, TERREO: 0, PAV_SUPERIOR: 0, COBERTA: 0, AREA_EXTERNA: 0 },
        },
      ],
      holidaySet: new Set(),
      builtAreaM2: 240,
    });

    expect(res.usedParametricFallback).toBe(true);
    expect(res.scheduledPackagesCount).toBe(3);
    expect(res.allocations.length).toBeGreaterThan(5);
    expect(res.allocations.some((a) => `${a.teamCode}${a.packageNumber}` === "A1")).toBe(true);
    expect(res.allocations.some((a) => `${a.teamCode}${a.packageNumber}` === "A2")).toBe(true);
  });

  it("gera Relatório Executivo paramétrico editável (Área, Padrão, BDI, Prazo) e PDF válido quando EAP está vazia", () => {
    const emptyBase: ExecutiveReportPayload = {
      audience: "INTERNAL",
      meta: {
        projectId: "11111111-1111-1111-1111-111111111111",
        projectName: "Residência Praia do Futuro",
        clientName: "Cliente Teste",
        cityLabel: "Fortaleza/CE",
        builtAreaM2: 180,
        bdiPercent: 20,
        status: "EM_CONFERENCIA",
        baselineLabel: "Rascunho r1",
        startDate: null,
        endDate: null,
        totalMonths: 0,
        totalWorkingDays: 0,
        isPublishedToClient: false,
      },
      kpis: {
        totalCommercialPrice: 0,
        costPerM2: 0,
        totalDirectCost: 0,
        directCostPerM2: 0,
        materialSharePercent: 0,
        laborSharePercent: 0,
        thirdPartySharePercent: 0,
        steelRateKgPerM3: 0,
        concreteM3PerM2: 0,
        masonryM2PerM2: 0,
      },
      stages: [],
      abcCurve: {
        items: [],
        summaryByClass: {
          A: { itemsCount: 0, totalCommercialPrice: 0, sharePercent: 0 },
          B: { itemsCount: 0, totalCommercialPrice: 0, sharePercent: 0 },
          C: { itemsCount: 0, totalCommercialPrice: 0, sharePercent: 0 },
        },
      },
      schedule: { waves: [], monthlySeries: [], procurementMilestones: [] },
      acervoVisuals: { technicalSheets: [], galleryImages: [] },
      premises: [],
      exclusions: [],
      comparativeAnalytics: null,
    };

    const report = buildParametricExecutiveFallback({
      basePayload: emptyBase,
      overrides: {
        builtAreaM2: 300,
        standardLevel: "ALTO",
        bdiPercent: 25,
        durationMonths: 10,
      },
    });

    expect(report.meta.isParametricFallback).toBe(true);
    expect(report.meta.builtAreaM2).toBe(300);
    expect(report.meta.totalMonths).toBe(10);
    expect(report.kpis.totalCommercialPrice).toBeGreaterThan(1_000_000);
    expect(report.stages.length).toBe(8);
    expect(report.schedule.monthlySeries.length).toBe(10);
    expect(report.comparativeAnalytics?.aiSummary.headline).toContain("ALTO");

    const pdf = renderExecutiveReportPdf(report);
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toContain("%PDF-1.4");
  });

  it("gera estrutura-base paramétrica editável na Medição no Canteiro quando EAP/LOB estão vazios", () => {
    const rows = buildParametricFieldMeasurementRows({
      builtAreaM2: 200,
      bdiPercent: 20,
      floors: DEFAULT_LOB_FLOORS,
      approvedPrevByKey: new Map(),
      draftCurrentByKey: new Map(),
    });

    expect(rows.length).toBe(7);
    expect(rows.every((r) => r.plannedQty > 0 && r.plannedAmount > 0)).toBe(true);
    expect(rows.some((r) => r.floorId === "FUNDACAO")).toBe(true);
    expect(rows.some((r) => r.floorId === "AREA_EXTERNA")).toBe(true);
  });
});
