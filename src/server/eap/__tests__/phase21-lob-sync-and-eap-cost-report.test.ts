import { describe, expect, it } from "vitest";
import {
  analyzeFloorMatrixConflicts,
  CANONICAL_LOB_PACKAGE_RULES,
  DEFAULT_LOB_FLOORS,
  generateIntelligentFloorLobMatrix,
  getLobPackageMeta,
  hasBrokenPhysicalSequence,
  summarizeLobAllocationsByPackage,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
  type LobFloorAllocationItem,
} from "@/lib/eap-lob-grid";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";
import {
  buildEapCostReport,
  renderEapCostReportPdf,
} from "@/server/eap/eap-cost-report";
import { buildEapTreePayload } from "@/server/eap/workbench";

describe("Fase 21 — Sequência Lógica (38 PCTs), Sync Tabela LOB e Relatório de Custos EAP", () => {
  it("mapeia explicitamente todos os 38 pacotes e impede acabamentos/pavimentos superiores na Semana 1", () => {
    expect(Object.keys(CANONICAL_LOB_PACKAGE_RULES)).toHaveLength(38);

    const servicePackages: FloorMatrixServicePackage[] = MASTER_LOB_PACKAGES.map((p) => {
      const meta = getLobPackageMeta(p.packageNumber, {
        name: p.name,
        waveName: p.waveName,
        teamsCount: p.defaultTeamsCount,
        predecessorNumbers: p.predecessorNumbers,
      });
      return {
        packageNumber: p.packageNumber,
        name: p.name,
        discipline: p.waveName,
        corHex: meta.corHex,
        textHex: meta.textHex,
        predecessorNumbers: p.predecessorNumbers,
        productivityPerDay: 25,
        productivityUnit: "m2/dia",
        linkedEapStageCodes: p.linkedStageCodes,
        isActive: true,
      };
    });

    const workTeams: FloorMatrixWorkTeam[] = [
      {
        teamCode: "A",
        name: "Equipe A — Estrutura & Geral",
        specialty: "Estrutural",
        maxDailyHours: 8,
        maxSimultaneousFronts: 1,
        workers: [{ roleName: "Pedreiro Estrutural", headcount: 4, dailyRate: 180, socialChargesPct: 40 }],
      },
      {
        teamCode: "B",
        name: "Equipe B — Revestimentos & Acabamentos",
        specialty: "Acabamentos",
        maxDailyHours: 8,
        maxSimultaneousFronts: 1,
        workers: [{ roleName: "Azulejista / Gesseiro", headcount: 4, dailyRate: 190, socialChargesPct: 40 }],
      },
      {
        teamCode: "C",
        name: "Equipe C — Instalações MEP",
        specialty: "Instalações",
        maxDailyHours: 8,
        maxSimultaneousFronts: 1,
        workers: [{ roleName: "Eletricista / Encanador", headcount: 3, dailyRate: 210, socialChargesPct: 40 }],
      },
    ];

    const result = generateIntelligentFloorLobMatrix({
      startDate: "2026-04-06",
      builtAreaM2: 300,
      holidaySet: new Set(),
      floors: DEFAULT_LOB_FLOORS,
      servicePackages,
      workTeams,
      stageLoads: [],
    });

    const scheduledPkgNumbers = new Set(result.allocations.map((a) => a.packageNumber));
    expect(scheduledPkgNumbers.size).toBe(38);

    // Semana 1: 2026-04-06 a 2026-04-10
    const week1Allocs = result.allocations.filter(
      (a) => a.dateIso >= "2026-04-06" && a.dateIso <= "2026-04-10"
    );
    expect(week1Allocs.length).toBeGreaterThan(0);

    // Nenhum acabamento (19, 20, 24, 27, 34) ou Pavimento Superior na Semana 1
    for (const a of week1Allocs) {
      expect(a.floorId).toBe("FUNDACAO");
      expect(a.packageNumber).toBeLessThanOrEqual(4);
      expect([19, 20, 24, 27, 34]).not.toContain(a.packageNumber);
    }

    const summary = summarizeLobAllocationsByPackage(result.allocations);
    const pct01 = summary.get(1);
    const pct04 = summary.get(4);
    const pct06 = summary.get(6);
    const pct07 = summary.get(7);
    const pct09 = summary.get(9);
    const pct19 = summary.get(19);

    expect(pct01?.startDate).toBe("2026-04-06");
    expect(pct04 && pct01 ? pct04.startDate! >= pct01.endDate! : false).toBe(true);
    expect(pct07 && pct06 ? pct07.startDate! > pct06.endDate! : false).toBe(true);
    expect(pct19 && pct09 ? pct19.startDate! > pct09.endDate! : false).toBe(true);

    // Zero conflitos críticos de sequência física
    const analysis = analyzeFloorMatrixConflicts({
      allocations: result.allocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages,
      workTeams,
      stageLoads: [],
      holidaySet: new Set(),
    });
    const seqErrors = analysis.conflicts.filter(
      (c) => c.severity === "critical" && c.type === "PRECEDENCE_VIOLATION"
    );
    expect(seqErrors).toHaveLength(0);
    expect(hasBrokenPhysicalSequence(result.allocations, servicePackages)).toBe(false);

    // Detecta matriz incoerente (ex.: C19 no Térreo ou A1 no Pavimento Superior no Dia 1)
    const brokenAllocations: LobFloorAllocationItem[] = [
      {
        floorId: "FUNDACAO",
        floorName: "Infraestrutura / Fundação",
        floorOrder: 0,
        dateIso: "2027-02-01",
        teamCode: "A",
        packageNumber: 1,
        isOvertime: false,
      },
      {
        floorId: "TERREO",
        floorName: "Térreo",
        floorOrder: 1,
        dateIso: "2027-02-01",
        teamCode: "C",
        packageNumber: 19,
        isOvertime: false,
      },
      {
        floorId: "PAV_SUPERIOR",
        floorName: "Pavimento Superior",
        floorOrder: 2,
        dateIso: "2027-02-01",
        teamCode: "A",
        packageNumber: 1,
        isOvertime: false,
      },
    ];
    expect(hasBrokenPhysicalSequence(brokenAllocations, servicePackages)).toBe(true);
  });

  it("resume equipes e dias úteis em tempo real exatamente como estão alocados na matriz LOB", () => {
    const sampleAllocs: LobFloorAllocationItem[] = [
      {
        floorId: "FUNDACAO",
        floorName: "Infraestrutura / Fundação",
        floorOrder: 0,
        dateIso: "2026-04-06",
        teamCode: "A",
        packageNumber: 1,
        isOvertime: false,
      },
      {
        floorId: "FUNDACAO",
        floorName: "Infraestrutura / Fundação",
        floorOrder: 0,
        dateIso: "2026-04-07",
        teamCode: "A",
        packageNumber: 1,
        isOvertime: false,
      },
      {
        floorId: "TERREO",
        floorName: "Térreo",
        floorOrder: 1,
        dateIso: "2026-05-10",
        teamCode: "B",
        packageNumber: 19,
        isOvertime: false,
      },
      {
        floorId: "PAV_SUPERIOR",
        floorName: "Pavimento Superior",
        floorOrder: 2,
        dateIso: "2026-05-10",
        teamCode: "C",
        packageNumber: 19,
        isOvertime: false,
      },
      {
        floorId: "PAV_SUPERIOR",
        floorName: "Pavimento Superior",
        floorOrder: 2,
        dateIso: "2026-05-11",
        teamCode: "C",
        packageNumber: 19,
        isOvertime: false,
      },
    ];

    const summary = summarizeLobAllocationsByPackage(sampleAllocs);
    expect(summary.get(1)).toEqual({
      packageNumber: 1,
      teamsCount: 1,
      teamCodes: ["A"],
      workingDaysCount: 2,
      startDate: "2026-04-06",
      endDate: "2026-04-07",
      floors: ["FUNDACAO"],
    });
    expect(summary.get(19)).toEqual({
      packageNumber: 19,
      teamsCount: 2,
      teamCodes: ["B", "C"],
      workingDaysCount: 3,
      startDate: "2026-05-10",
      endDate: "2026-05-11",
      floors: ["PAV_SUPERIOR", "TERREO"],
    });
  });

  it("gera o Relatório Dedicado de Custos da EAP (por Pavimento, Disciplina, Fase, Curva ABC e PDF %PDF-1.4)", () => {
    const tree = buildEapTreePayload({
      id: "eap-1",
      projectId: "proj-1",
      cityId: "city-1",
      cityLabel: "Fortaleza/CE",
      title: "Residência Alto Padrão",
      builtAreaM2: 300,
      bdiPercent: 20,
      plannedStartDate: "2026-04-06",
      status: "EM_CONFERENCIA",
      currentRevision: 1,
      premisesJson: ["Concreto FCK 30 MPa usinado"],
      exclusionsJson: ["Mobiliário solto"],
      zones: [
        { id: "z1", code: "FUND_TERREO", name: "Fundação & Térreo", orderIndex: 1 },
        { id: "z2", code: "PAV_SUPERIOR", name: "Pavimento Superior", orderIndex: 2 },
        { id: "z3", code: "COBERTURA", name: "Cobertura", orderIndex: 3 },
        { id: "z4", code: "EXTERNO", name: "Área Externa", orderIndex: 4 },
      ],
      conflicts: [],
      stages: [
        {
          id: "st-03",
          code: "03",
          name: "Infraestrutura & Fundações",
          orderIndex: 3,
          groups: [
            {
              id: "g-03",
              code: "03.1",
              name: "Blocos e Estacas",
              orderIndex: 1,
              items: [
                {
                  id: "i-1",
                  groupId: "g-03",
                  materialCatalogId: null,
                  laborRoleId: null,
                  code: "EST-01",
                  description: "Concreto usinado FCK 30 MPa para sapatas",
                  unit: "m3",
                  zoneQuantitiesJson: { FUND_TERREO: 40, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
                  lossPercent: 5,
                  materialUnitCost: 500,
                  laborUnitCost: 200,
                  thirdPartyUnitCost: 0,
                  markupMultiplier: 1.2,
                  teamsCount: 1,
                  sourceSoftware: "TQS",
                  sourceFileId: null,
                  sourcePage: 1,
                  sanityFlag: null,
                  revisionTag: "ORIGINAL",
                  orderIndex: 1,
                },
              ],
            },
          ],
        },
        {
          id: "st-08",
          code: "08",
          name: "Instalações Elétricas",
          orderIndex: 8,
          groups: [
            {
              id: "g-08",
              code: "08.1",
              name: "Cabeamento & Quadros",
              orderIndex: 1,
              items: [
                {
                  id: "i-2",
                  groupId: "g-08",
                  materialCatalogId: null,
                  laborRoleId: null,
                  code: "ELE-01",
                  description: "Pontos elétricos completos",
                  unit: "un",
                  zoneQuantitiesJson: { FUND_TERREO: 50, PAV_SUPERIOR: 50, COBERTURA: 0, EXTERNO: 0 },
                  lossPercent: 0,
                  materialUnitCost: 150,
                  laborUnitCost: 100,
                  thirdPartyUnitCost: 50,
                  markupMultiplier: 1.2,
                  teamsCount: 1,
                  sourceSoftware: "REVIT",
                  sourceFileId: null,
                  sourcePage: 2,
                  sanityFlag: null,
                  revisionTag: "ORIGINAL",
                  orderIndex: 1,
                },
              ],
            },
          ],
        },
      ],
    });

    const report = buildEapCostReport({
      projectId: "proj-1",
      projectName: "Casa Aldeota",
      clientName: "Carlos Silva",
      tree,
      workTeams: [],
    });

    expect(report.meta.isParametricFallback).toBe(false);
    expect(report.kpis.concreteM3).toBe(42); // 40 * 1.05
    expect(report.byFloor.find((f) => f.code === "INFRAESTRUTURA")?.commercialPrice).toBeGreaterThan(0);
    expect(report.byFloor.find((f) => f.code === "TERREO")?.commercialPrice).toBeGreaterThan(0);
    expect(report.byFloor.find((f) => f.code === "PAV_SUPERIOR")?.commercialPrice).toBeGreaterThan(0);
    expect(report.byDiscipline.map((d) => d.discipline)).toEqual(
      expect.arrayContaining(["Estrutural", "Elétrico"])
    );
    expect(report.byPhase.map((p) => p.phaseCode)).toEqual(
      expect.arrayContaining(["F1", "F3"])
    );
    expect(report.abcCurve.items).toHaveLength(2);

    const pdfBytes = renderEapCostReportPdf(report);
    const header = Buffer.from(pdfBytes.slice(0, 8)).toString("latin1");
    expect(header.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfBytes.length).toBeGreaterThan(1500);
  });

  it("gera estimativa paramétrica e PDF válido mesmo quando a Planilha EAP ainda está vazia", () => {
    const emptyTree = buildEapTreePayload({
      id: "eap-empty",
      projectId: "proj-empty",
      cityId: "city-1",
      cityLabel: "Fortaleza/CE",
      title: "Obra Nova",
      builtAreaM2: 200,
      bdiPercent: 22,
      plannedStartDate: null,
      status: "RASCUNHO",
      currentRevision: 0,
      premisesJson: [],
      exclusionsJson: [],
      zones: [],
      conflicts: [],
      stages: [],
    });

    const fallbackReport = buildEapCostReport({
      projectId: "proj-empty",
      projectName: "Obra Nova",
      clientName: "Cliente",
      tree: emptyTree,
      workTeams: [],
    });

    expect(fallbackReport.meta.isParametricFallback).toBe(true);
    expect(fallbackReport.kpis.totalCommercialPrice).toBeGreaterThan(0);
    expect(fallbackReport.byFloor).toHaveLength(5);
    expect(fallbackReport.byDiscipline.length).toBeGreaterThan(3);

    const pdfBytes = renderEapCostReportPdf(fallbackReport);
    expect(Buffer.from(pdfBytes.slice(0, 8)).toString("latin1").startsWith("%PDF-1.4")).toBe(true);
  });
});
