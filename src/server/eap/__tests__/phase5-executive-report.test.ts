import { describe, expect, it } from "vitest";
import {
  buildExecutiveReportPayload,
  computeAbcCurve,
  renderExecutiveReportPdf,
} from "@/server/eap/executive-report";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { computeScheduleAnalytics } from "@/server/eap/scheduler";
import { DEFAULT_EAP_ZONES, MASTER_EAP_STAGES } from "@/server/eap/templates/residential-master";

function makeFixtureTree() {
  const stages = MASTER_EAP_STAGES.map((st) => ({
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
        st.code === "04" && idx === 0
          ? [
              {
                id: "i-conc",
                groupId: `grp-${g.code}`,
                materialCatalogId: null,
                laborRoleId: null,
                code: "CONC-30",
                description: "Concreto Usinado fck 30 MPa",
                unit: "m³",
                zoneQuantitiesJson: { FUND_TERREO: 60, PAV_SUPERIOR: 40, COBERTURA: 0, EXTERNO: 0 },
                lossPercent: 0,
                materialUnitCost: 600,
                laborUnitCost: 70,
                thirdPartyUnitCost: 60,
                markupMultiplier: 1.25,
                teamsCount: 1,
                sourceSoftware: "TQS",
                sourceFileId: null,
                sourcePage: 1,
                sanityFlag: null,
                revisionTag: "ORIGINAL",
                orderIndex: 1,
              },
              {
                id: "i-aco",
                groupId: `grp-${g.code}`,
                materialCatalogId: null,
                laborRoleId: null,
                code: "ACO-10",
                description: "Aço CA-50 Ø 10mm",
                unit: "kg",
                zoneQuantitiesJson: { FUND_TERREO: 5000, PAV_SUPERIOR: 4000, COBERTURA: 0, EXTERNO: 0 },
                lossPercent: 0,
                materialUnitCost: 8,
                laborUnitCost: 3,
                thirdPartyUnitCost: 0,
                markupMultiplier: 1.25,
                teamsCount: 1,
                sourceSoftware: "TQS",
                sourceFileId: null,
                sourcePage: 1,
                sanityFlag: null,
                revisionTag: "ORIGINAL",
                orderIndex: 2,
              },
            ]
          : st.code === "16" && idx === 0
            ? [
                {
                  id: "i-esq",
                  groupId: `grp-${g.code}`,
                  materialCatalogId: null,
                  laborRoleId: null,
                  code: "ESQ-ALUM",
                  description: "Esquadria Alumínio",
                  unit: "m²",
                  zoneQuantitiesJson: { FUND_TERREO: 15, PAV_SUPERIOR: 15, COBERTURA: 0, EXTERNO: 0 },
                  lossPercent: 0,
                  materialUnitCost: 0,
                  laborUnitCost: 0,
                  thirdPartyUnitCost: 1000,
                  markupMultiplier: 1.25,
                  teamsCount: 1,
                  sourceSoftware: "REVIT",
                  sourceFileId: null,
                  sourcePage: 2,
                  sanityFlag: null,
                  revisionTag: "ORIGINAL",
                  orderIndex: 1,
                },
              ]
            : st.code === "26" && idx === 0
              ? [
                  {
                    id: "i-limp",
                    groupId: `grp-${g.code}`,
                    materialCatalogId: null,
                    laborRoleId: null,
                    code: "LIMP-01",
                    description: "Limpeza Final Pós-Obra",
                    unit: "vb",
                    zoneQuantitiesJson: { FUND_TERREO: 1, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
                    lossPercent: 0,
                    materialUnitCost: 1000,
                    laborUnitCost: 2000,
                    thirdPartyUnitCost: 0,
                    markupMultiplier: 1.25,
                    teamsCount: 1,
                    sourceSoftware: "MANUAL",
                    sourceFileId: null,
                    sourcePage: null,
                    sanityFlag: null,
                    revisionTag: "ADICIONADO",
                    orderIndex: 1,
                  },
                ]
              : [],
    })),
  }));

  return buildEapTreePayload({
    id: "eap-1",
    projectId: "proj-1",
    cityId: "city-for",
    cityLabel: "Fortaleza/CE",
    title: "EAP Residência Alphaville",
    builtAreaM2: 300,
    bdiPercent: 25,
    plannedStartDate: "2026-04-01",
    status: "BASELINE_APROVADA",
    currentRevision: 1,
    premisesJson: ["Base Fortaleza/CE", "Prazo em dias úteis"],
    exclusionsJson: ["Marcenaria planejada", "Climatização"],
    zones: DEFAULT_EAP_ZONES.map((z, idx) => ({ id: `z-${idx}`, ...z })),
    stages,
    conflicts: [],
  });
}

describe("EAP Fase 5 — Relatório Executivo, Curva ABC, Privacidade e PDF", () => {
  it("calcula Curva ABC ordenando decrescentemente e classificando Classes A (80%), B (95%) e C (100%)", () => {
    const abc = computeAbcCurve([
      { id: "1", code: "C1", stageCode: "04", description: "Aço", unit: "kg", totalQtyWithLoss: 100, totalCommercialPrice: 50000 },
      { id: "2", code: "C2", stageCode: "04", description: "Concreto", unit: "m³", totalQtyWithLoss: 100, totalCommercialPrice: 30000 },
      { id: "3", code: "C3", stageCode: "16", description: "Esquadria", unit: "m²", totalQtyWithLoss: 10, totalCommercialPrice: 15000 },
      { id: "4", code: "C4", stageCode: "26", description: "Limpeza", unit: "vb", totalQtyWithLoss: 1, totalCommercialPrice: 5000 },
    ]);

    expect(abc.items.map((i) => i.id)).toEqual(["1", "2", "3", "4"]);
    expect(abc.items[0].abcClass).toBe("A");
    expect(abc.items[1].abcClass).toBe("A");
    expect(abc.items[2].abcClass).toBe("B");
    expect(abc.items[3].abcClass).toBe("C");
    expect(abc.items[3].cumulativePercent).toBe(100);
    expect(abc.summaryByClass.A.sharePercent).toBe(80);
    expect(abc.summaryByClass.B.sharePercent).toBe(15);
    expect(abc.summaryByClass.C.sharePercent).toBe(5);
  });

  it("garante isolamento de privacidade no Modo Cliente (sem vazar custos internos nem BDI/Mark-Up)", () => {
    const tree = makeFixtureTree();
    const analytics = computeScheduleAnalytics({
      packages: [
        {
          packageNumber: 7,
          linkedStageCodes: ["04", "16", "26"],
          teamsCount: 2,
          segments: [{ startDate: "2026-04-01", endDate: "2026-06-30", workingDays: 60 }],
        },
      ],
      stageBudgets: tree.stages.map((st) => ({
        stageCode: st.code,
        totalMaterial: st.totalMaterial,
        totalLabor: st.totalLabor,
        totalThirdParty: st.totalThirdParty,
        totalDirectCost: st.totalDirectCost,
        totalCommercialPrice: st.totalCommercialPrice,
      })),
      holidays: [],
    });

    const clientReport = buildExecutiveReportPayload({
      audience: "CLIENT",
      projectName: "Residência Alphaville",
      clientName: "João Silva",
      latestBaselineLabel: "v1.0",
      tree,
      analytics,
      packages: [
        {
          waveName: "Onda 2 — Supraestrutura",
          segments: [{ startDate: "2026-04-01", endDate: "2026-06-30", workingDays: 60 }],
          procurementGates: [],
        },
      ],
      technicalSheets: [
        {
          id: "doc-1",
          code: "ARQ-PE-001",
          title: "Planta Baixa Térreo",
          discipline: "ARQUITETURA",
          revisionNumber: "R02",
          status: "BOM_PARA_OBRA",
          fileUrl: "/api/acervo/revisions/1/download",
          fileName: "ARQ-PE-001_R02.pdf",
        },
      ],
      galleryImages: [],
    });

    expect(clientReport.meta.bdiPercent).toBeUndefined();
    expect(clientReport.kpis.totalDirectCost).toBeUndefined();
    expect(clientReport.kpis.directCostPerM2).toBeUndefined();

    const stage04 = clientReport.stages.find((s) => s.code === "04")!;
    expect(stage04.totalDirectCost).toBeUndefined();
    expect(stage04.items[0].materialUnitCost).toBeUndefined();
    expect(stage04.items[0].laborUnitCost).toBeUndefined();
    expect(stage04.items[0].thirdPartyUnitCost).toBeUndefined();
    expect(stage04.items[0].markupMultiplier).toBeUndefined();
    expect(stage04.items[0].unitCommercialPrice).toBeGreaterThan(0);

    // Exportação PDF gera buffer %PDF- válido
    const pdfBytes = renderExecutiveReportPdf(clientReport);
    const header = Buffer.from(pdfBytes.subarray(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    expect(pdfBytes.length).toBeGreaterThan(500);
  });
});
