import { describe, expect, it } from "vitest";
import {
  extractBriefingScopeContext,
  SCOPE_TEMPLATES,
} from "@/lib/scope-templates";
import { buildEapCostReport, renderEapCostReportPdf } from "@/server/eap/eap-cost-report";
import { renderFieldMeasurementBulletinPdf } from "@/server/eap/field-measurement";
import { buildEapTreePayload } from "@/server/eap/workbench";

describe("Phase 23 — Rodada B: Scope Templates, Briefing Import & Colored Vector PDFs", () => {
  it("extracts briefing context (area, city, disciplines, template) for Proposals & Contracts", () => {
    const ctx = extractBriefingScopeContext({
      projectType: "Residencial Alto Padrão",
      clientPhone: "(85) 99999-1234",
      clientCity: "Fortaleza - CE",
      briefingResponses: {
        areaTotal: "320 m²",
        cidade: "Eusébio - CE",
        tipologia: "Residência Unifamiliar",
        disciplinas: ["Arquitetônico", "Estrutural", "Elétrico", "Hidrossanitário"],
        programaNecessidades: "4 suítes, piscina, área gourmet",
      },
    });

    expect(ctx.hasBriefing).toBe(true);
    expect(ctx.areaM2).toBe(320);
    expect(ctx.cityState).toBe("Eusébio - CE");
    expect(ctx.disciplines).toContain("Estrutural");
    expect(ctx.suggestedTemplate).toBe("COMPLETO");
    expect(SCOPE_TEMPLATES.INTERIORES.defaultLines.length).toBeGreaterThan(0);
    expect(SCOPE_TEMPLATES.FACHADAS_BIM.disciplines).toContain("Fachadas BIM");
  });

  it("renders colored vector charts and KPI cards in EAP Cost Report PDF (%PDF-1.4)", () => {
    const tree = buildEapTreePayload({
      id: "eap-test",
      projectId: "proj-test",
      cityId: "city-for",
      cityLabel: "Fortaleza/CE",
      title: "EAP Residencial",
      builtAreaM2: 260,
      bdiPercent: 22,
      plannedStartDate: "2026-04-06",
      status: "EM_CONFERENCIA",
      currentRevision: 2,
      premisesJson: ["Premissa 1"],
      exclusionsJson: ["Exclusão 1"],
      zones: [],
      stages: [],
      conflicts: [],
    });

    const report = buildEapCostReport({
      projectId: "proj-test",
      projectName: "Casa Aldeota",
      clientName: "Cliente Teste",
      tree,
      workTeams: [],
    });

    const bytes = renderEapCostReportPdf(report);
    const pdfStr = Buffer.from(bytes).toString("latin1");

    expect(pdfStr.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfStr).toContain("re\nf");
    expect(pdfStr).toContain("0.145 0.388 0.922 rg");
    expect(pdfStr).toContain("%%EOF");
  });

  it("renders colored vector evolution chart and KPI cards in Field Measurement Bulletin PDF", () => {
    const bytes = renderFieldMeasurementBulletinPdf({
      projectName: "Casa Meireles",
      bulletinCode: "BM-01",
      referenceDate: "2026-11-25",
      status: "APROVADO",
      inspectorName: "Eng. Emanoel Luan",
      weatherCondition: "SOL",
      summary: {
        totalPlannedValue: 380000,
        totalAccumulatedValue: 185000,
        physicalProgressPct: 48.5,
        plannedLobPct: 45.0,
        deviationPct: 3.5,
        totalMeasuredValue: 185000,
        totalPendingValue: 195000,
        completedItemsCount: 11,
        totalItemsCount: 16,
      },
      floorSummaries: [
        {
          floorId: "FUNDACAO",
          floorName: "Infraestrutura / Fundação",
          floorOrder: 1,
          itemsCount: 6,
          completedCount: 6,
          progressPct: 100,
          plannedAmount: 95000,
          accumulatedAmount: 95000,
          pendingAmount: 0,
        },
        {
          floorId: "TERREO",
          floorName: "Térreo",
          floorOrder: 2,
          itemsCount: 10,
          completedCount: 5,
          progressPct: 45,
          plannedAmount: 200000,
          accumulatedAmount: 90000,
          pendingAmount: 110000,
        },
      ],
      items: [],
    });

    const pdfStr = Buffer.from(bytes).toString("latin1");
    expect(pdfStr.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfStr).toContain("re\nf");
  });
});
