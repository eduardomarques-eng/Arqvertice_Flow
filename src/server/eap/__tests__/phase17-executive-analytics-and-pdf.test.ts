import { describe, expect, it } from "vitest";
import {
  buildDeterministicDeviationsSummary,
  computeComparativeFinancials,
  type ComparativeProjectAnalytics,
} from "../executive-analytics-ai";
import {
  renderExecutiveReportPdf,
  type ExecutiveReportPayload,
} from "../executive-report";

describe("Fase 13 — Análises Comparativas, Resumo IA de Desvios & PDF Integral", () => {
  it("cruza Orçado EAP × Previsto LOB × Medido Canteiro × Faturado e calcula SPI/CPI/EAC", () => {
    const fin = computeComparativeFinancials({
      budgetedEapTotal: 1_000_000,
      plannedLobPct: 50,
      physicalProgressPct: 40,
      measuredFieldCumulative: 450_000,
      billedInstallmentsTotal: 420_000,
      receivedInstallmentsTotal: 350_000,
    });

    expect(fin.plannedLobCumulative).toBe(500_000);
    expect(fin.measuredFieldCumulative).toBe(450_000);
    expect(fin.billedInstallmentsTotal).toBe(420_000);
    expect(fin.receivedInstallmentsTotal).toBe(350_000);
    expect(fin.physicalDeviationPct).toBe(-10);
    expect(fin.spi).toBe(0.8); // 40 / 50
    // EV = 400_000; AC = 450_000 -> CPI = 0.89
    expect(fin.cpi).toBe(0.89);
    expect(fin.cashBalanceBilledMinusMeasured).toBe(-30_000);
    expect(fin.eacCostProjection).toBe(1_123_595.51);
  });

  it("gera resumo estruturado de desvios e gargalos sem expor dados pessoais (PII)", () => {
    const financial = computeComparativeFinancials({
      budgetedEapTotal: 800_000,
      plannedLobPct: 60,
      physicalProgressPct: 45,
      measuredFieldCumulative: 380_000,
      billedInstallmentsTotal: 350_000,
      receivedInstallmentsTotal: 300_000,
    });

    const ai = buildDeterministicDeviationsSummary({
      financial,
      shortTerm: {
        windowDays: 30,
        upcomingPackagesCount: 6,
        criticalConstraintsCount: 2,
        attentionConstraintsCount: 1,
        recentBulletinsCount: 2,
        teamUtilization: [],
      },
      floorComparison: [
        { floorName: "Térreo", progressPct: 42, plannedAmount: 300_000 },
      ],
      criticalConstraintTitles: ["Compra de Aço CA-50", "Liberação Concreto"],
      teamOverloadMessages: ["Equipe A sobrecarregada em 2 frentes"],
    });

    expect(ai.healthStatus).toBe("CRITICO");
    expect(ai.source).toBe("DETERMINISTIC");
    expect(ai.topBottlenecks.some((b) => b.axis === "PRAZO")).toBe(true);
    expect(ai.topBottlenecks.some((b) => b.axis === "SUPRIMENTOS")).toBe(true);
    expect(ai.topBottlenecks.some((b) => b.axis === "EQUIPES")).toBe(true);
    expect(ai.topBottlenecks.some((b) => b.axis === "FINANCEIRO")).toBe(true);
    expect(ai.actionPlan.length).toBeGreaterThan(0);

    // Garante que nenhuma informação pessoal fictícia está presente
    const serialized = JSON.stringify(ai);
    expect(serialized).not.toMatch(/\bCPF\b|\bRG\b|@/i);
  });

  it("gera PDF executivo integral (%PDF-) com seções comparativas e sem o termo Onda", () => {
    const fin = computeComparativeFinancials({
      budgetedEapTotal: 500_000,
      plannedLobPct: 50,
      physicalProgressPct: 50,
      measuredFieldCumulative: 250_000,
      billedInstallmentsTotal: 260_000,
      receivedInstallmentsTotal: 260_000,
    });

    const comparativeAnalytics: ComparativeProjectAnalytics = {
      referenceDate: "2026-05-15",
      financial: fin,
      shortTerm: {
        windowDays: 30,
        upcomingPackagesCount: 4,
        criticalConstraintsCount: 0,
        attentionConstraintsCount: 0,
        recentBulletinsCount: 1,
        teamUtilization: [
          {
            teamCode: "A",
            name: "Equipe A — Estrutura",
            workingDays: 12,
            headcount: 6,
            dailyCost: 900,
            totalEstimatedCost: 10800,
            occupancyPercent: 80,
          },
        ],
      },
      monthlyComparative: [
        {
          monthKey: "2026-05",
          label: "05/26",
          plannedCumulative: 250_000,
          measuredCumulative: 250_000,
          billedCumulative: 260_000,
        },
      ],
      floorComparison: [
        {
          floorId: "TERREO",
          floorName: "Térreo",
          plannedAmount: 300_000,
          measuredAmount: 150_000,
          progressPct: 50,
        },
      ],
      activeVersions: [
        { discipline: "ESTRUTURAL", fileName: "EST_R01.pdf", versionCode: "R01" },
      ],
      bulletinsSummary: [
        {
          bulletinCode: "BM-01",
          referenceDate: "2026-05-15",
          status: "APROVADO",
          physicalProgressPct: 50,
          totalMeasuredValue: 250_000,
        },
      ],
      aiSummary: buildDeterministicDeviationsSummary({
        financial: fin,
        shortTerm: {
          windowDays: 30,
          upcomingPackagesCount: 4,
          criticalConstraintsCount: 0,
          attentionConstraintsCount: 0,
          recentBulletinsCount: 1,
          teamUtilization: [],
        },
        floorComparison: [{ floorName: "Térreo", progressPct: 50, plannedAmount: 300_000 }],
        criticalConstraintTitles: [],
        teamOverloadMessages: [],
      }),
    };

    const payload: ExecutiveReportPayload = {
      audience: "INTERNAL",
      meta: {
        projectId: "proj-1",
        projectName: "Residência Vertice",
        clientName: "Cliente Teste",
        cityLabel: "Fortaleza/CE",
        builtAreaM2: 320,
        bdiPercent: 22,
        status: "EM_EXECUCAO",
        baselineLabel: "v1.0",
        startDate: "2026-04-01",
        endDate: "2026-10-30",
        totalMonths: 7,
        totalWorkingDays: 140,
        isPublishedToClient: true,
      },
      kpis: {
        totalCommercialPrice: 500_000,
        costPerM2: 1562.5,
        totalDirectCost: 409_836,
        directCostPerM2: 1280.74,
        materialSharePercent: 55,
        laborSharePercent: 35,
        thirdPartySharePercent: 10,
        steelRateKgPerM3: 92,
        concreteM3PerM2: 0.28,
        masonryM2PerM2: 1.4,
      },
      stages: [
        {
          code: "04",
          name: "Supraestrutura",
          itemsCount: 1,
          totalCommercialPrice: 500_000,
          weightPercent: 100,
          items: [
            {
              id: "i1",
              code: "EST-01",
              description: "Concreto Estrutural",
              unit: "m³",
              totalQtyWithLoss: 90,
              zoneQuantities: { FUND_TERREO: 90, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
              unitCommercialPrice: 5555.56,
              totalCommercialPrice: 500_000,
              weightPercent: 100,
            },
          ],
        },
      ],
      abcCurve: {
        items: [],
        summaryByClass: {
          A: { itemsCount: 1, totalCommercialPrice: 500_000, sharePercent: 100 },
          B: { itemsCount: 0, totalCommercialPrice: 0, sharePercent: 0 },
          C: { itemsCount: 0, totalCommercialPrice: 0, sharePercent: 0 },
        },
      },
      schedule: {
        waves: [
          {
            waveName: "Onda 1 — Estrutura",
            packagesCount: 4,
            startDate: "2026-04-01",
            endDate: "2026-06-30",
            totalWorkingDays: 60,
            progressPercent: 50,
          },
        ],
        monthlySeries: [],
        procurementMilestones: [],
      },
      acervoVisuals: { technicalSheets: [], galleryImages: [] },
      premises: ["Execucao conforme norma."],
      exclusions: ["Mobilia solta."],
      comparativeAnalytics,
    };

    const bytes = renderExecutiveReportPdf(payload);
    const pdfRaw = Buffer.from(bytes).toString("latin1");
    expect(pdfRaw.startsWith("%PDF-")).toBe(true);
    expect(bytes.length).toBeGreaterThan(1500);

    // O PdfWriter codifica texto em hex; decodificamos os blocos <...> para validar seções e ausência de "Onda"
    const hexMatches = [...pdfRaw.matchAll(/<([0-9A-Fa-f]{4,})>/g)].map((m) =>
      Buffer.from(m[1], "hex").toString("latin1")
    );
    const extractedText = hexMatches.join(" ");
    expect(extractedText).toContain("COMPARATIVO CUSTOS");
    expect(extractedText).toContain("RESUMO DE DESVIOS");
    expect(extractedText).not.toMatch(/\bOnda\b/i);
  });
});
