import { describe, expect, it } from "vitest";
import { parseTqsHtml } from "@/server/eap/parsers/tqs-html-parser";
import { parseRevitHtml } from "@/server/eap/parsers/revit-parser";
import {
  reconcileMinedCandidates,
  type RegionalLaborLookup,
  type RegionalMaterialLookup,
} from "@/server/eap/reconciler";
import {
  buildExecutiveReportPayload,
  renderExecutiveReportPdf,
} from "@/server/eap/executive-report";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { computeScheduleAnalytics } from "@/server/eap/scheduler";
import { DEFAULT_EAP_ZONES, MASTER_EAP_STAGES } from "@/server/eap/templates/residential-master";

const MOCK_FORTALEZA_MATERIALS: RegionalMaterialLookup[] = [
  {
    id: "mat-conc-35",
    code: "CONC-FCK35",
    name: "Concreto Usinado fck 35 MPa",
    category: "CONCRETO",
    unit: "m³",
    defaultLossPercent: 5,
    eapStageCode: "04",
    materialUnitCost: 640,
    thirdPartyUnitCost: 65,
  },
  {
    id: "mat-forma",
    code: "FORM-MAD-COMP",
    name: "Fôrma de Madeira Compensado",
    category: "FORMAS",
    unit: "m²",
    defaultLossPercent: 8,
    eapStageCode: "04",
    materialUnitCost: 58,
    thirdPartyUnitCost: 14,
  },
  {
    id: "mat-eps",
    code: "LAJE-EPS-H12",
    name: "Bloco Enchimento EPS H12/40/120",
    category: "LAJE_EPS",
    unit: "unid",
    defaultLossPercent: 5,
    eapStageCode: "04",
    materialUnitCost: 14.5,
    thirdPartyUnitCost: 0,
  },
  {
    id: "mat-vigota",
    code: "LAJE-VIGOTA-TR",
    name: "Vigota Treliçada TR12645",
    category: "VIGOTA_TRELICADA",
    unit: "m",
    defaultLossPercent: 3,
    eapStageCode: "04",
    materialUnitCost: 34,
    thirdPartyUnitCost: 0,
  },
  {
    id: "mat-aco-comp",
    code: "ACO-CA50-63",
    name: "Aço CA-50/CA-60 Complementar",
    category: "ACO_COMPLEMENTAR",
    unit: "kg",
    defaultLossPercent: 10,
    eapStageCode: "04",
    materialUnitCost: 7.9,
    thirdPartyUnitCost: 0,
  },
];

const MOCK_FORTALEZA_LABOR: RegionalLaborLookup[] = [
  { id: "lab-conc", code: "MO-CONCRETAGEM", name: "Concretagem", unit: "m³", laborUnitCost: 68 },
  { id: "lab-carp", code: "MO-CARPINTEIRO", name: "Carpinteiro", unit: "m²", laborUnitCost: 42 },
  { id: "lab-pedr", code: "MO-PEDREIRO-EQ", name: "Pedreiro + Servente", unit: "unid", laborUnitCost: 18 },
  { id: "lab-arm", code: "MO-ARMADOR", name: "Armador", unit: "kg", laborUnitCost: 3.1 },
];

const SAMPLE_RESDES_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>RESDES.HTM — TQS</title></head>
<body>
  <h2>Resumo Estrutural Geral - Area estrutural: 280,50 m2</h2>
  <p>Carbono Incorporado: 11250 kgCO2</p>
  <table>
    <tr><th colspan="4">Piso 1: Terreo</th></tr>
    <tr><td>Concreto C35</td><td>19,10 m3</td><td>R$ 655,00</td></tr>
    <tr><td>Forma de Madeira</td><td>186,41 m2</td><td>R$ 6,80</td></tr>
    <tr><td>Forma EPS H12/40/120</td><td>142 unid</td><td>R$ 15,00</td></tr>
    <tr><td>Vigota Trelicada TR12645</td><td>136,00 m</td><td>R$ 35,00</td></tr>
    <tr><td>Aco Complementar 50A/60A</td><td>68,00 kg</td><td>R$ 8,10</td></tr>
  </table>
  <table>
    <tr><th colspan="4">Piso 2: Pav_Superior</th></tr>
    <tr><td>Concreto C35</td><td>18,26 m3</td><td>R$ 655,00</td></tr>
    <tr><td>Forma de Madeira</td><td>180,50 m2</td><td>R$ 6,80</td></tr>
    <tr><td>Forma EPS H12/40/120</td><td>135 unid</td><td>R$ 15,00</td></tr>
    <tr><td>Vigota Trelicada TR12645</td><td>130,00 m</td><td>R$ 35,00</td></tr>
    <tr><td>Aco Complementar 50A/60A</td><td>65,00 kg</td><td>R$ 8,10</td></tr>
  </table>
</body>
</html>
`;

describe("EAP Fase 7 — Parser HTML TQS/Revit, Auditoria de Preços e Relatório PDF Vetorial", () => {
  it("extrai corretamente RESDES.HTM do TQS (Concreto C35 37,36 m³, Fôrma 366,91 m², EPS 277, Vigota 266m e Aço Compl. 133kg)", () => {
    const parsed = parseTqsHtml(SAMPLE_RESDES_HTML, "sf-resdes");

    expect(parsed.sourceSoftware).toBe("TQS");
    expect(parsed.detectedAreaM2).toBeCloseTo(280.5, 1);
    expect(parsed.carbonKgCo2).toBe(11250);

    const concreteTotal = parsed.candidates
      .filter((c) => c.rawCategory === "CONCRETO")
      .reduce(
        (s, c) =>
          s + c.zoneQuantities.FUND_TERREO + c.zoneQuantities.PAV_SUPERIOR + c.zoneQuantities.COBERTURA,
        0
      );
    expect(concreteTotal).toBeCloseTo(37.36, 2);

    const formItem = parsed.candidates.find((c) => c.rawCategory === "FORMAS");
    expect(formItem).toBeDefined();
    expect(formItem!.zoneQuantities.FUND_TERREO).toBeCloseTo(186.41, 2);
    expect(formItem!.zoneQuantities.PAV_SUPERIOR).toBeCloseTo(180.5, 2);
    expect(
      formItem!.zoneQuantities.FUND_TERREO + formItem!.zoneQuantities.PAV_SUPERIOR
    ).toBeCloseTo(366.91, 2);
    expect(formItem!.sourceUnitPrice).toBeCloseTo(6.8, 2);

    const epsTotal = parsed.candidates
      .filter((c) => c.rawCategory === "LAJE_EPS")
      .reduce((s, c) => s + c.zoneQuantities.FUND_TERREO + c.zoneQuantities.PAV_SUPERIOR, 0);
    expect(epsTotal).toBe(277);

    const joistTotal = parsed.candidates
      .filter((c) => c.rawCategory === "VIGOTA_TRELICADA")
      .reduce((s, c) => s + c.zoneQuantities.FUND_TERREO + c.zoneQuantities.PAV_SUPERIOR, 0);
    expect(joistTotal).toBeCloseTo(266, 2);

    const compSteelTotal = parsed.candidates
      .filter((c) => c.rawCategory === "ACO_COMPLEMENTAR")
      .reduce((s, c) => s + c.zoneQuantities.FUND_TERREO + c.zoneQuantities.PAV_SUPERIOR, 0);
    expect(compSteelTotal).toBeCloseTo(133, 2);

    // Zero aço principal com concreto > 0 gera alerta automático com sugestão de 85 kg/m³
    expect(parsed.zeroSteelAlert).not.toBeNull();
    expect(parsed.zeroSteelAlert!.concreteM3).toBeCloseTo(37.36, 2);
    expect(parsed.zeroSteelAlert!.suggestedKg).toBe(Math.round(37.36 * 85));
  });

  it("rejeita preço HTML divergente (>50%) em Fôrmas (R$ 6,80/m²) aplicando catálogo regional de Fortaleza + emite aviso de aço zerado", () => {
    const parsed = parseTqsHtml(SAMPLE_RESDES_HTML, "sf-resdes");
    const reconciled = reconcileMinedCandidates({
      candidates: parsed.candidates,
      hasTqsSource: true,
      cityMaterials: MOCK_FORTALEZA_MATERIALS,
      cityLabor: MOCK_FORTALEZA_LABOR,
      builtAreaM2: 280.5,
    });

    const formAccepted = reconciled.acceptedItems.find((i) =>
      i.description.toLowerCase().includes("fôrmas")
    );
    expect(formAccepted).toBeDefined();
    // Deve ignorar R$ 6,80 do HTML e manter o custo unitário do catálogo regional de Fortaleza (R$ 58 + R$ 14 terc)
    expect(formAccepted!.materialUnitCost).toBe(58);
    expect(formAccepted!.thirdPartyUnitCost).toBe(14);
    expect(formAccepted!.sanityFlag).toContain("6,80");

    // Deve conter alerta global de aço principal zerado e aviso PRECO_HTML_IGNORADO
    expect(
      reconciled.sanityWarnings.some((w) => w.toLowerCase().includes("aço principal"))
    ).toBe(true);
    expect(
      reconciled.sanityWarnings.some((w) => w.includes("PRECO_HTML_IGNORADO"))
    ).toBe(true);
  });

  it("extrai Schedules HTML de Revit por disciplina (Elétrico e Hidrossanitário)", () => {
    const revitHtml = `
      <table>
        <tr><th>Tabela de Pontos Elétricos</th><th>Pavimento</th><th>Qtd</th></tr>
        <tr><td>Ponto de Tomada 2P+T 10A</td><td>Térreo</td><td>42 unid</td></tr>
        <tr><td>Quadro de Distribuição 24 Disjuntores</td><td>Térreo</td><td>1 unid</td></tr>
      </table>
    `;
    const parsed = parseRevitHtml(revitHtml, {
      discipline: "ELETRICO",
      sourceFileId: "sf-revit-ele",
    });
    expect(parsed.sourceSoftware).toBe("REVIT");
    expect(parsed.candidates.length).toBeGreaterThanOrEqual(1);
    expect(parsed.candidates.every((c) => c.eapStageCode === "08" || c.eapStageCode === "21")).toBe(
      true
    );
  });

  it("gera PDF Executivo (%PDF-) válido contendo gráficos vetoriais de Macro-Etapas e Desembolso Mensal", () => {
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
                  id: "i-conc35",
                  groupId: `grp-${g.code}`,
                  materialCatalogId: null,
                  laborRoleId: null,
                  code: "CONC-FCK35",
                  description: "Concreto Usinado C35",
                  unit: "m³",
                  zoneQuantitiesJson: {
                    FUND_TERREO: 19.1,
                    PAV_SUPERIOR: 18.26,
                    COBERTURA: 0,
                    EXTERNO: 0,
                  },
                  lossPercent: 5,
                  materialUnitCost: 640,
                  laborUnitCost: 68,
                  thirdPartyUnitCost: 65,
                  markupMultiplier: 1.25,
                  teamsCount: 1,
                  sourceSoftware: "TQS",
                  sourceFileId: null,
                  sourcePage: 1,
                  sanityFlag: null,
                  revisionTag: "ORIGINAL",
                  orderIndex: 1,
                },
              ]
            : [],
      })),
    }));

    const tree = buildEapTreePayload({
      id: "eap-p7",
      projectId: "proj-p7",
      cityId: "city-for",
      cityLabel: "Fortaleza/CE",
      title: "Residência Praia",
      builtAreaM2: 280.5,
      bdiPercent: 25,
      plannedStartDate: "2026-12-07",
      status: "EM_EXECUCAO",
      currentRevision: 1,
      premisesJson: ["Base Regional Fortaleza"],
      exclusionsJson: ["Paisagismo"],
      zones: DEFAULT_EAP_ZONES.map((z, idx) => ({ id: `z-${idx}`, ...z })),
      stages,
      conflicts: [],
    });

    const analytics = computeScheduleAnalytics({
      packages: [
        {
          packageNumber: 7,
          linkedStageCodes: ["04"],
          teamsCount: 2,
          segments: [
            { startDate: "2026-12-07", endDate: "2027-02-26", workingDays: 58 },
          ],
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

    const payload = buildExecutiveReportPayload({
      audience: "CLIENT",
      projectName: "Residência de Praia",
      clientName: "Pedro",
      latestBaselineLabel: "v1.0",
      tree,
      analytics,
      packages: [
        {
          waveName: "Onda 2 — Supraestrutura",
          segments: [
            {
              startDate: "2026-12-07",
              endDate: "2027-02-26",
              workingDays: 58,
              progressPercent: 45,
            },
          ],
          procurementGates: [],
        },
      ],
      technicalSheets: [],
      galleryImages: [],
      embodiedCarbonKgCo2: 11250,
      executionSummary: {
        actualPhysicalPercent: 45,
        plannedPhysicalPercent: 40,
        spi: 1.13,
        cpi: 1.05,
      },
    });

    expect(payload.kpis.embodiedCarbonKgCo2).toBe(11250);
    expect(payload.kpis.actualPhysicalPercent).toBe(45);
    expect(payload.schedule.waves[0]?.progressPercent).toBe(45);

    const bytes = renderExecutiveReportPdf(payload);
    const pdfAscii = Buffer.from(bytes).toString("latin1");
    expect(pdfAscii.startsWith("%PDF-")).toBe(true);
    // Verifica comandos de retângulos vetoriais (operador "re" / "f") e seções dos gráficos vetoriais
    expect(pdfAscii).toContain("re\nf");
    expect(pdfAscii).toContain("EOF");
  });
});
