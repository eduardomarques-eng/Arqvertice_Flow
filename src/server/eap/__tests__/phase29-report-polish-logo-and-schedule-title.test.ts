import { describe, expect, it } from "vitest";
import {
  buildEapScheduleReportPayload,
  renderEapScheduleReportPdf,
} from "@/server/eap/eap-schedule-report";
import {
  renderEapCostReportPdf,
  type EapCostReportPayload,
} from "@/server/eap/eap-cost-report";
import { renderFieldMeasurementBulletinPdf } from "@/server/eap/field-measurement";
import { DEFAULT_LOB_FLOORS } from "@/lib/eap-lob-grid";
import { generatePreliminary13MonthLobMatrix } from "@/lib/eap-preliminary-13m";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";

describe("Fase 29 — Logo nos Relatórios, Remoção de Abreviações e Título 'Cronograma'", () => {
  it("gera PDF de Planejamento com título exato '1. Cronograma', logo embutida, sem 'Onda' e sem abreviações opacas", () => {
    const packages38 = MASTER_LOB_PACKAGES.map((p) => ({
      packageNumber: p.packageNumber,
      name: p.name,
      discipline: p.waveName.replace(/\bOnda\b/gi, "Fase"),
      corHex: "#1D4ED8",
      textHex: "#FFFFFF",
      predecessorNumbers: p.predecessorNumbers,
      productivityPerDay: 25,
      productivityUnit: "m²",
      linkedEapStageCodes: p.linkedStageCodes,
      isActive: true,
    }));

    const teamsABC = [
      {
        teamCode: "A",
        name: "Equipe A — Estrutura",
        specialty: "Estrutura",
        maxDailyHours: 8,
        maxSimultaneousFronts: 2,
        workers: [{ roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 40 }],
      },
      {
        teamCode: "B",
        name: "Equipe B — Alvenaria",
        specialty: "Alvenaria",
        maxDailyHours: 8,
        maxSimultaneousFronts: 2,
        workers: [{ roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 40 }],
      },
      {
        teamCode: "C",
        name: "Equipe C — Instalações",
        specialty: "Instalações",
        maxDailyHours: 8,
        maxSimultaneousFronts: 2,
        workers: [{ roleName: "Eletricista", headcount: 2, dailyRate: 210, socialChargesPct: 40 }],
      },
    ];

    const lob = generatePreliminary13MonthLobMatrix({
      startDate: "2027-02-01",
      builtAreaM2: 250,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: packages38,
      workTeams: teamsABC,
      holidaySet: new Set(),
    });

    const payload = buildEapScheduleReportPayload({
      meta: {
        projectId: "proj-pedro",
        projectName: "Residência de Praia",
        clientName: "Pedro",
        cityLabel: "Fortaleza/CE",
        title: "Planejamento LOB",
        builtAreaM2: 250,
        status: "EM_EXECUCAO",
      },
      allocations: lob.allocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages: packages38,
      workTeams: teamsABC,
      holidaySet: new Set(),
    });

    const pdfBytes = renderEapScheduleReportPdf(payload);
    const pdfStr = Buffer.from(pdfBytes).toString("latin1").toLowerCase();

    expect(pdfStr.startsWith("%pdf-")).toBe(true);
    // Logo institucional embutida no PdfWriter (hex string de ARQVERTICE)
    expect(pdfStr).toContain(Buffer.from("ARQVERTICE", "latin1").toString("hex").toLowerCase());
    // Título exato "1. Cronograma"
    expect(pdfStr).toContain(Buffer.from("1. Cronograma", "latin1").toString("hex").toLowerCase());
    // Sem "Onda" e sem "d.u." / "d.c." / "D.U."
    expect(pdfStr).not.toContain(Buffer.from("Onda", "latin1").toString("hex").toLowerCase());
    expect(pdfStr).not.toContain(Buffer.from("d.u.", "latin1").toString("hex").toLowerCase());
    expect(pdfStr).not.toContain(Buffer.from("d.c.", "latin1").toString("hex").toLowerCase());
    expect(pdfStr).not.toContain(Buffer.from("D.U.", "latin1").toString("hex").toLowerCase());
  });

  it("gera PDF de Custos da EAP e Boletim de Medição com logo institucional embutida", () => {
    const costPayload: EapCostReportPayload = {
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
          label: "Fundação e Térreo",
          materialCost: 500_000,
          laborCost: 350_000,
          thirdPartyCost: 50_000,
          directCost: 900_000,
          commercialPrice: 1_098_000,
          sharePercent: 100,
        },
      ],
      byDiscipline: [
        {
          discipline: "Estrutura",
          materialCost: 500_000,
          laborCost: 350_000,
          thirdPartyCost: 50_000,
          directCost: 900_000,
          commercialPrice: 1_098_000,
          sharePercent: 100,
          itemsCount: 10,
        },
      ],
      byPhase: [
        {
          phaseCode: "F2",
          phaseName: "Fase 2 — Estrutura",
          materialCost: 500_000,
          laborCost: 350_000,
          thirdPartyCost: 50_000,
          directCost: 900_000,
          commercialPrice: 1_098_000,
          sharePercent: 100,
          stagesCount: 1,
          itemsCount: 10,
        },
      ],
      stages: [],
      abcCurve: {
        items: [],
        summaryByClass: {
          A: { count: 0, totalValue: 0, sharePercent: 0 },
          B: { count: 0, totalValue: 0, sharePercent: 0 },
          C: { count: 0, totalValue: 0, sharePercent: 0 },
        },
      },
      teams: [],
      premises: [],
      exclusions: [],
    };

    const costPdfStr = Buffer.from(renderEapCostReportPdf(costPayload)).toString("latin1").toLowerCase();
    expect(costPdfStr.startsWith("%pdf-")).toBe(true);
    expect(costPdfStr).toContain(Buffer.from("ARQVERTICE", "latin1").toString("hex").toLowerCase());

    const fieldPdfBytes = renderFieldMeasurementBulletinPdf({
      bulletinCode: "BM-01",
      projectName: "Residência de Praia",
      referenceDate: "2027-03-15",
      status: "APROVADO",
      inspectorName: "Eng. Eduardo",
      weatherCondition: "SOL",
      generalNotes: "Concretagem dentro do prazo.",
      summary: {
        totalPlannedValue: 1_000_000,
        totalAccumulatedValue: 220_000,
        totalMeasuredValue: 200_000,
        totalPendingValue: 780_000,
        physicalProgressPct: 22,
        plannedLobPct: 20,
        deviationPct: 2,
        completedItemsCount: 4,
        totalItemsCount: 18,
      },
      floorSummaries: [],
      items: [],
    });
    const fieldPdfStr = Buffer.from(fieldPdfBytes).toString("latin1").toLowerCase();
    expect(fieldPdfStr.startsWith("%pdf-")).toBe(true);
    expect(fieldPdfStr).toContain(Buffer.from("ARQVERTICE", "latin1").toString("hex").toLowerCase());
  });
});
