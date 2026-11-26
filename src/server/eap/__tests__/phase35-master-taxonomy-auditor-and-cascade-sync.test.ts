import { describe, expect, it, vi } from "vitest";
import { CANONICAL_LOB_PACKAGE_RULES } from "@/lib/eap-lob-grid";
import {
  MASTER_EAP_TAXONOMY,
  resolveOfficialDiscipline,
  resolveOfficialTeamCodeForStage,
} from "@/server/eap/master-taxonomy";
import { auditEapCoherence } from "@/server/eap/eap-coherence-auditor";
import { computeCanonicalEapTotals } from "@/server/eap/cascade-sync";
import { round2 } from "@/server/eap/calculator";
import { buildEapCostReport, resolveDisciplineForStageCode } from "@/server/eap/eap-cost-report";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { getStandardWorkTeamsForProfile } from "@/server/eap/teams-and-packages";
import { calibrateRoofLaborProportional } from "@/server/eap/regional-standards-catalog";

describe("Phase 35 — Taxonomia Travada, Auditor de Coerência e Sincronização em Cascata", () => {
  it("trava todas as 26 macro-etapas em MASTER_EAP_TAXONOMY (Etapa 20=Hidrossanitário, Etapa 24=Arquitetônico, Equipes A/B/C)", () => {
    expect(Object.keys(MASTER_EAP_TAXONOMY)).toHaveLength(26);
    expect(resolveOfficialDiscipline("20")).toBe("Hidrossanitário");
    expect(resolveOfficialDiscipline("24")).toBe("Arquitetônico");
    expect(resolveDisciplineForStageCode("20")).toBe("Hidrossanitário");
    expect(resolveDisciplineForStageCode("24")).toBe("Arquitetônico");
    expect(resolveOfficialDiscipline("08")).toBe("Elétrico");
    expect(resolveOfficialDiscipline("21")).toBe("Luminotécnico");
    expect(resolveOfficialDiscipline("23")).toBe("Paisagismo");

    // Equipes padrão coerentes com A/B/C
    expect(resolveOfficialTeamCodeForStage("04")).toBe("A");
    expect(resolveOfficialTeamCodeForStage("06")).toBe("A");
    expect(resolveOfficialTeamCodeForStage("08")).toBe("B");
    expect(resolveOfficialTeamCodeForStage("09")).toBe("B");
    expect(resolveOfficialTeamCodeForStage("20")).toBe("B");
    expect(resolveOfficialTeamCodeForStage("21")).toBe("B");
    expect(resolveOfficialTeamCodeForStage("14")).toBe("C");
    expect(resolveOfficialTeamCodeForStage("16")).toBe("C");
    expect(resolveOfficialTeamCodeForStage("19")).toBe("C");
  });

  it("calibra diárias exatas das equipes por padrão (Baixo 375/415/385, Médio 435/490/460, Alto 558/642/576) e hourly = daily/8", () => {
    const checkProfile = (
      std: "BAIXO_PADRAO" | "MEDIO_PADRAO" | "ALTO_PADRAO",
      expected: { A: number; B: number; C: number }
    ) => {
      const teams = getStandardWorkTeamsForProfile(std);
      for (const t of teams) {
        const sum = t.workers.reduce((s, w) => s + w.headcount * w.dailyRate, 0);
        expect(sum).toBe(expected[t.teamCode as "A" | "B" | "C"]);
        for (const w of t.workers) {
          expect(w.hourlyRate).toBe(round2(w.dailyRate / 8));
        }
      }
    };
    checkProfile("BAIXO_PADRAO", { A: 375, B: 415, C: 385 });
    checkProfile("MEDIO_PADRAO", { A: 435, B: 490, C: 460 });
    checkProfile("ALTO_PADRAO", { A: 558, B: 642, C: 576 });
  });

  it("calibra coberta/telhado com MO proporcional (~R$ 45-55/m² na projeção) sem duplicar MO em peças lineares", () => {
    const calibrated = calibrateRoofLaborProportional(
      [
        { description: "Terças 8x16", materialUnitCost: 50, laborUnitCost: 30 },
        { description: "Caibros 5x8", materialUnitCost: 20, laborUnitCost: 18 },
        { description: "Ripas 2x4", materialUnitCost: 8, laborUnitCost: 10 },
        { description: "Telhamento cerâmico", materialUnitCost: 60, laborUnitCost: 45 },
      ],
      "BAIXO_PADRAO"
    );
    expect(calibrated[0]).toMatchObject({ materialUnitCost: 31, laborUnitCost: 9 });
    expect(calibrated[1]).toMatchObject({ materialUnitCost: 10.5, laborUnitCost: 5.5 });
    expect(calibrated[2]).toMatchObject({ materialUnitCost: 3.8, laborUnitCost: 2.5 });
    expect(calibrated[3]).toMatchObject({ materialUnitCost: 44, laborUnitCost: 20.2 });
  });

  it("auditor detecta etapa obrigatória zerada, MO anômala, duplicidade e divergência de equipe LOB", () => {
    const result = auditEapCoherence(
      { builtAreaM2: 250, bdiPercent: 22, cityLabel: "Fortaleza / CE" },
      [
        {
          stageCode: "01",
          description: "Tapume e canteiro",
          zoneQuantities: { FUND_TERREO: 1 },
          totalMaterial: 3000,
          totalLabor: 4000,
          totalDirectCost: 7000,
        },
        // Etapa 02..05, 08, 09 zeradas -> devem gerar CRITICAL
        // Etapa 06 com MO multiplicada indevidamente (80% MO -> acima da faixa 25%-42%)
        {
          stageCode: "06",
          description: "Telhamento cerâmico",
          zoneQuantities: { COBERTURA: 165 },
          totalMaterial: 3000,
          totalLabor: 12000,
          totalDirectCost: 15000,
        },
        // Etapa 22 com material alto e MO zerada -> CRITICAL
        {
          stageCode: "22",
          description: "Piscina",
          zoneQuantities: { EXTERNO: 1 },
          totalMaterial: 10000,
          totalLabor: 0,
          totalDirectCost: 10000,
        },
        // Duplicidade na Etapa 14 no Térreo
        {
          stageCode: "14",
          code: "EAP-14.01",
          description: "Porcelanato 90x90",
          zoneQuantities: { FUND_TERREO: 100 },
          totalMaterial: 6200,
          totalLabor: 3800,
          totalDirectCost: 10000,
        },
        {
          stageCode: "14",
          code: "EAP-14.01",
          description: "Porcelanato 90x90",
          zoneQuantities: { FUND_TERREO: 100 },
          totalMaterial: 6200,
          totalLabor: 3800,
          totalDirectCost: 10000,
        },
      ],
      [{ packageNumber: 15, teamCode: "C" }] // Pacote 15 deve ser Equipe B
    );

    const ids = result.alerts.map((a) => a.id);
    expect(ids).toContain("REQUIRED_STAGE_EMPTY_04");
    expect(ids).toContain("LABOR_SHARE_ANOMALY_06");
    expect(ids).toContain("ZERO_LABOR_HIGH_MAT_22");
    expect(ids.some((id) => id.startsWith("DUPLICATE_14_FUND_TERREO"))).toBe(true);
    expect(ids).toContain("LOB_TEAM_TAXONOMY_MISMATCH");
    expect(result.summary.critical).toBeGreaterThanOrEqual(7); // 6 etapas obrigatórias + Etapa 22
    expect(result.summary.autoFixableCount).toBeGreaterThanOrEqual(1);
    expect(result.benchmark.sinapiDirectPerM2).toBe(1890);
    expect(result.benchmark.cubWithBdiPerM2).toBe(2500);
  });

  it("garante fechamento matemático canônico (Σ Pavimentos === Σ Disciplinas === Total Direto e Total Geral === Total Direto × 1,22)", () => {
    const totals = computeCanonicalEapTotals({
      items: [
        { totalMaterial: 100000, totalLabor: 60000, totalThirdParty: 10000 },
        { totalMaterial: 50000, totalLabor: 30000, totalThirdParty: 0 },
      ],
      bdiPercent: 22,
      builtAreaM2: 250,
    });

    expect(totals.totalDirectCost).toBe(250000);
    expect(totals.bdiValue).toBe(55000);
    expect(totals.totalCommercialPrice).toBe(305000);
    expect(totals.directCostPerM2).toBe(1000);
    expect(totals.costPerM2).toBe(1220);

    const tree = buildEapTreePayload({
      id: "eap-1",
      projectId: "proj-1",
      cityId: "city-1",
      cityLabel: "Fortaleza/CE",
      title: "Obra Teste Canônico",
      builtAreaM2: 250,
      bdiPercent: 22,
      constructionStandard: "BAIXO_PADRAO",
      concreteMethod: "IN_LOCO_BETONEIRA",
      plannedStartDate: "2026-06-01",
      status: "RASCUNHO",
      currentRevision: 9,
      premisesJson: [],
      exclusionsJson: [],
      zones: [{ id: "z1", code: "FUND_TERREO", name: "Fundação & Térreo", orderIndex: 1 }],
      conflicts: [],
      stages: [
        {
          id: "s04",
          code: "04",
          name: "Supraestrutura",
          orderIndex: 4,
          groups: [
            {
              id: "g4",
              code: "04.1",
              name: "Concreto",
              orderIndex: 1,
              items: [
                {
                  id: "i1",
                  groupId: "g4",
                  materialCatalogId: null,
                  laborRoleId: null,
                  code: "STR-01",
                  description: "Concreto in loco",
                  unit: "m³",
                  zoneQuantitiesJson: { FUND_TERREO: 20, PAV_SUPERIOR: 10, COBERTURA: 0, EXTERNO: 0 },
                  lossPercent: 0,
                  materialUnitCost: 410,
                  laborUnitCost: 135,
                  thirdPartyUnitCost: 0,
                  markupMultiplier: 1.0, // testa BDI 22% do projeto aplicado automaticamente
                  teamsCount: 1,
                  sourceSoftware: "TQS",
                  sourceFileId: null,
                  sourcePage: null,
                  sanityFlag: null,
                  revisionTag: "ORIGINAL",
                  orderIndex: 1,
                },
              ],
            },
          ],
        },
        {
          id: "s20",
          code: "20",
          name: "Louças e Metais",
          orderIndex: 20,
          groups: [
            {
              id: "g20",
              code: "20.1",
              name: "Louças",
              orderIndex: 1,
              items: [
                {
                  id: "i2",
                  groupId: "g20",
                  materialCatalogId: null,
                  laborRoleId: null,
                  code: "HID-20",
                  description: "Bacias e torneiras",
                  unit: "vb",
                  zoneQuantitiesJson: { FUND_TERREO: 1, PAV_SUPERIOR: 0, COBERTURA: 0, EXTERNO: 0 },
                  lossPercent: 0,
                  materialUnitCost: 5000,
                  laborUnitCost: 1200,
                  thirdPartyUnitCost: 0,
                  markupMultiplier: 1.0,
                  teamsCount: 1,
                  sourceSoftware: "REVIT",
                  sourceFileId: null,
                  sourcePage: null,
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
      projectName: "Obra Teste",
      clientName: "Pedro",
      tree,
      workTeams: [],
    });

    const sumFloorsDirect = Number(
      report.byFloor.reduce((s, f) => s + f.directCost, 0).toFixed(2)
    );
    const sumDiscDirect = Number(
      report.byDiscipline.reduce((s, d) => s + d.directCost, 0).toFixed(2)
    );
    expect(sumFloorsDirect).toBe(report.kpis.totalDirectCost);
    expect(sumDiscDirect).toBe(report.kpis.totalDirectCost);
    expect(report.kpis.bdiValue).toBeCloseTo(report.kpis.totalDirectCost * 0.22, 2);
    expect(report.kpis.totalCommercialPrice).toBeCloseTo(
      report.kpis.totalDirectCost * 1.22,
      2
    );
    expect(report.meta.constructionStandardLabel).toBe("Baixo Padrão");
    expect(report.meta.concreteMethodLabel).toBe("In Loco (Betoneira 400 L)");
    expect(CANONICAL_LOB_PACKAGE_RULES[15].defaultTeam).toBe("B");
  });

  it("sincronização em cascata preserva pedidos emitidos/fornecedores e nunca altera boletins APROVADO", async () => {
    // Mock inline apenas para validar as cláusulas de proteção do cascadeSyncEapProject
    const { prisma } = await import("@/server/db");
    const deleteManySpy = vi
      .spyOn(prisma.eapProcurementItem, "deleteMany")
      .mockResolvedValue({ count: 0 });
    const bulletinFindSpy = vi
      .spyOn(prisma.eapFieldMeasurementBulletin, "findMany")
      .mockResolvedValue([]);
    const eapFindSpy = vi
      .spyOn(prisma.eapProject, "findUnique")
      .mockResolvedValue({
        id: "eap-mock",
        projectId: "proj-mock",
        bdiPercent: 22,
        plannedStartDate: new Date(),
        stages: [],
        lobFloorAllocations: [],
        servicePackages: [],
        schedulePackages: [],
        fieldMeasurementBulletins: [],
        procurementItems: [
          {
            id: "proc-1",
            stageCode: "04",
            itemName: "Aço CA-50",
            status: "PEDIDO_EMITIDO",
            financialEntryId: "fin-1",
            supplierName: "Gerdau",
            closedAmount: 15000,
          },
        ],
      } as never);

    vi.spyOn(prisma.eapProcurementItem, "findMany").mockResolvedValue([] as never);
    vi.spyOn(prisma.eapWorkTeam, "findMany").mockResolvedValue([] as never);

    const { cascadeSyncEapProject } = await import("@/server/eap/cascade-sync");
    await cascadeSyncEapProject("proj-mock");

    // Garante que apenas A_COTAR sem supplier/closedAmount/financialEntryId são substituídos
    if (deleteManySpy.mock.calls.length > 0) {
      const where = deleteManySpy.mock.calls[0]?.[0]?.where as Record<string, unknown>;
      expect(where).toMatchObject({
        status: "A_COTAR",
        financialEntryId: null,
        supplierName: null,
        closedAmount: null,
      });
    }

    // Garante que cascadeSync busca somente boletins status: "RASCUNHO" (nunca APROVADO)
    const eapFindArgs = eapFindSpy.mock.calls[0]?.[0] as {
      include?: { fieldMeasurementBulletins?: { where?: { status?: string } } };
    };
    expect(eapFindArgs?.include?.fieldMeasurementBulletins?.where?.status).toBe("RASCUNHO");

    deleteManySpy.mockRestore();
    bulletinFindSpy.mockRestore();
    eapFindSpy.mockRestore();
  });
});
