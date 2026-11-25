import { describe, expect, it } from "vitest";
import {
  analyzeFloorMatrixConflicts,
  DEFAULT_LOB_FLOORS,
  hasBrokenPhysicalSequence,
  type FloorMatrixServicePackage,
  type FloorMatrixWorkTeam,
} from "@/lib/eap-lob-grid";
import {
  computePreliminaryEapQuantities,
  generatePreliminary13MonthLobMatrix,
  normalizeDataOrigin,
} from "@/lib/eap-preliminary-13m";
import { planMiningMerge } from "@/server/eap/base-items";
import { MASTER_LOB_PACKAGES } from "@/server/eap/templates/residential-master";

function buildMasterPackages(): FloorMatrixServicePackage[] {
  return MASTER_LOB_PACKAGES.map((p) => ({
    packageNumber: p.packageNumber,
    name: p.name,
    discipline: p.waveName,
    corHex: "#1D4ED8",
    textHex: "#FFFFFF",
    predecessorNumbers: p.predecessorNumbers,
    productivityPerDay: 10,
    productivityUnit: "m²/dia",
    linkedEapStageCodes: p.linkedStageCodes,
    isActive: true,
  }));
}

function buildStandardTeams(): FloorMatrixWorkTeam[] {
  return [
    {
      teamCode: "A",
      name: "Equipe A — Estrutura & Bruta",
      specialty: "Obra Bruta",
      maxDailyHours: 8,
      maxSimultaneousFronts: 1,
      workers: [{ roleName: "Pedreiro", headcount: 2, dailyRate: 180, socialChargesPct: 0 }],
    },
    {
      teamCode: "B",
      name: "Equipe B — Acabamentos",
      specialty: "Acabamentos",
      maxDailyHours: 8,
      maxSimultaneousFronts: 1,
      workers: [{ roleName: "Acabador", headcount: 2, dailyRate: 180, socialChargesPct: 0 }],
    },
    {
      teamCode: "C",
      name: "Equipe C — Instalações",
      specialty: "Elétrica & Hidráulica",
      maxDailyHours: 8,
      maxSimultaneousFronts: 1,
      workers: [{ roleName: "Eletricista/Encanador", headcount: 2, dailyRate: 200, socialChargesPct: 0 }],
    },
  ];
}

describe("Phase 22 — Preliminary 13-Month Fill & Data Origin Tracking", () => {
  it("computes parametric EAP zone quantities coherent with builtAreaM2", () => {
    const concrete = computePreliminaryEapQuantities(
      {
        code: "CONC-SUPRA-25",
        stageCode: "04",
        unit: "m³",
        description: "Concreto Usinado Supraestrutura fck 25 MPa",
      },
      280
    );
    expect(concrete.FUND_TERREO).toBeGreaterThan(25);
    expect(concrete.PAV_SUPERIOR).toBeGreaterThan(20);
    expect(concrete.COBERTURA).toBeGreaterThan(5);
    expect(concrete.EXTERNO).toBe(0);

    const foundation = computePreliminaryEapQuantities(
      {
        code: "CONC-FCK25",
        stageCode: "03",
        unit: "m³",
        description: "Concreto Estrutural Fundações",
      },
      280
    );
    expect(foundation.FUND_TERREO).toBeGreaterThan(30);
    expect(foundation.PAV_SUPERIOR).toBe(0);
  });

  it("generates a coherent 13-month LOB schedule (~240-290 working days) with zero conflicts or sequence breaks", () => {
    const servicePackages = buildMasterPackages();
    const workTeams = buildStandardTeams();

    const result = generatePreliminary13MonthLobMatrix({
      startDate: "2026-04-06",
      builtAreaM2: 280,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages,
      workTeams,
      holidaySet: new Set<string>(),
    });

    expect(result.workingDaysSpan).toBeGreaterThanOrEqual(240);
    expect(result.workingDaysSpan).toBeLessThanOrEqual(290);
    expect(result.scheduledPackagesCount).toBe(38);
    expect(result.allocations.length).toBeGreaterThan(250);
    expect(result.allocations.every((a) => a.dataOrigin === "PRELIMINAR_PADRAO")).toBe(true);

    expect(hasBrokenPhysicalSequence(result.allocations, servicePackages)).toBe(false);

    const conflicts = analyzeFloorMatrixConflicts({
      allocations: result.allocations,
      floors: DEFAULT_LOB_FLOORS,
      servicePackages,
      workTeams,
      stageLoads: [],
      holidaySet: new Set<string>(),
    });
    expect(conflicts.isValid).toBe(true);
    expect(conflicts.conflicts).toHaveLength(0);
  });

  it("promotes PRELIMINAR_PADRAO to mined values while preserving 100% of EDITADO_USUARIO", () => {
    const groupByStage = new Map<string, string>([
      ["03", "grp-03"],
      ["04", "grp-04"],
    ]);

    const mergePlan = planMiningMerge({
      existingItems: [
        {
          id: "item-prelim",
          groupId: "grp-03",
          stageCode: "03",
          code: "CONC-FCK25",
          description: "Concreto Estrutural Fundações / Sapatas / Blocos fck 25 MPa",
          unit: "m³",
          sourceSoftware: "TEMPLATE",
          revisionTag: "ORIGINAL",
          dataOrigin: "PRELIMINAR_PADRAO",
          materialUnitCost: 480,
          laborUnitCost: 120,
          thirdPartyUnitCost: 0,
        },
        {
          id: "item-manual",
          groupId: "grp-04",
          stageCode: "04",
          code: "ACO-CA50",
          description: "Aço CA-50 Armação Supraestrutura",
          unit: "kg",
          sourceSoftware: "MANUAL",
          revisionTag: "ORIGINAL",
          dataOrigin: "EDITADO_USUARIO",
          materialUnitCost: 8.5,
          laborUnitCost: 3.2,
          thirdPartyUnitCost: 0,
        },
      ],
      acceptedItems: [
        {
          eapStageCode: "03",
          rawCategory: "CONCRETO",
          code: "CONC-FCK25",
          description: "Concreto Estrutural Fundações",
          unit: "m³",
          zoneQuantities: { FUND_TERREO: 42.5, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
          lossPercent: 5,
          materialCatalogId: null,
          laborRoleId: null,
          materialUnitCost: 480,
          laborUnitCost: 120,
          thirdPartyUnitCost: 0,
          sourceSoftware: "TQS",
          sourceFileId: "file-tqs",
          sourcePage: 1,
          sanityFlag: null,
        },
        {
          eapStageCode: "04",
          rawCategory: "ACO",
          code: "ACO-CA50",
          description: "Aço CA-50 Armação Supraestrutura",
          unit: "kg",
          zoneQuantities: { FUND_TERREO: 2200, PAV_SUPERIOR: 1800, COBERTURA: 400, EXTERNO: 0 },
          lossPercent: 10,
          materialCatalogId: null,
          laborRoleId: null,
          materialUnitCost: 8.5,
          laborUnitCost: 3.2,
          thirdPartyUnitCost: 0,
          sourceSoftware: "TQS",
          sourceFileId: "file-tqs",
          sourcePage: 2,
          sanityFlag: null,
        },
      ],
      groupByStageCode: groupByStage,
      fallbackGroupId: "grp-03",
      defaultMarkup: 1.22,
    });

    expect(mergePlan.preservedManualCount).toBe(1);
    expect(mergePlan.updates).toHaveLength(1);
    expect(mergePlan.updates[0].id).toBe("item-prelim");
    expect(mergePlan.updates[0].zoneQuantities.FUND_TERREO).toBe(42.5);
    expect(mergePlan.resetTemplateIds).not.toContain("item-manual");
  });

  it("normalizes dataOrigin deterministically from explicit value or legacy metadata", () => {
    expect(normalizeDataOrigin("PRELIMINAR_PADRAO")).toBe("PRELIMINAR_PADRAO");
    expect(normalizeDataOrigin("QUANTITATIVO_IMPORTADO")).toBe("QUANTITATIVO_IMPORTADO");
    expect(normalizeDataOrigin("EDITADO_USUARIO")).toBe("EDITADO_USUARIO");
    expect(normalizeDataOrigin(null, { sourceSoftware: "TQS", revisionTag: "ORIGINAL" })).toBe(
      "QUANTITATIVO_IMPORTADO"
    );
    expect(normalizeDataOrigin(null, { sourceSoftware: "TEMPLATE", revisionTag: "QUANTIDADE_ALTERADA" })).toBe(
      "EDITADO_USUARIO"
    );
    expect(normalizeDataOrigin(null, { sourceSoftware: "TEMPLATE", revisionTag: "ORIGINAL" })).toBe(
      "PRELIMINAR_PADRAO"
    );
  });
});
