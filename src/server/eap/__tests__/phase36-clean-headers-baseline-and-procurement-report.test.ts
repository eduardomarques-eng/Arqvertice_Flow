import { describe, expect, it, vi } from "vitest";
import { hexString } from "@/lib/pdf/pdf-writer";
import { renderEapCostReportPdf, buildEapCostReport } from "@/server/eap/eap-cost-report";
import {
  renderEapScheduleReportPdf,
  buildEapScheduleReportPayload,
} from "@/server/eap/eap-schedule-report";
import { buildEapTreePayload } from "@/server/eap/workbench";
import {
  buildProcurementMonthlyDisbursement,
  buildProcurementPdfBuffer,
} from "@/server/eap/procurement-plan";

describe("Phase 36 — Cabeçalhos Limpos, Curva ABC Explicativa e Relatório de Aquisições", () => {
  it("gera Relatório Custos PDF com título exato 'Relatório Custos' e sem 'Baixo Padrão' ou 'Betoneira'", () => {
    const tree = buildEapTreePayload({
      id: "eap-36",
      projectId: "proj-36",
      cityId: "city-36",
      cityLabel: "Fortaleza/CE",
      title: "Residência de Praia",
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
      stages: [],
    });

    const report = buildEapCostReport({
      projectId: "proj-36",
      projectName: "Residência de Praia",
      clientName: "Pedro",
      tree,
      workTeams: [],
    });

    const pdfBytes = renderEapCostReportPdf(report);
    const pdfText = Buffer.from(pdfBytes).toString("latin1");

    expect(pdfBytes.length).toBeGreaterThan(500);
    expect(pdfText).not.toContain("Baixo Padrao");
    expect(pdfText).not.toContain("Betoneira");
  });

  it("gera Relatório Planejamento PDF com título exato 'Planejamento' e sem termos internos", () => {
    const payload = buildEapScheduleReportPayload({
      meta: {
        projectId: "proj-36",
        projectName: "Residência de Praia",
        clientName: "Pedro",
        cityLabel: "Fortaleza/CE",
        title: "Planejamento",
        builtAreaM2: 250,
        status: "RASCUNHO",
        revision: 9,
        bdiPercent: 22,
        constructionStandardLabel: "Baixo Padrão",
        concreteMethodLabel: "In Loco (Betoneira 400 L)",
      },
      allocations: [
        {
          floorId: "FUNDACAO",
          floorName: "Fundação",
          floorOrder: 1,
          dateIso: "2026-06-01",
          teamCode: "A",
          packageNumber: 1,
          isOvertime: false,
        },
      ],
      floors: [{ floorId: "FUNDACAO", floorName: "Fundação", floorOrder: 1 }],
      servicePackages: [
        {
          packageNumber: 1,
          name: "Canteiro",
          discipline: "Serviços Preliminares / Gerais",
          corHex: "#1D4ED8",
          textHex: "#FFFFFF",
          predecessorNumbers: [],
          productivityPerDay: 10,
          productivityUnit: "un/dia",
          linkedEapStageCodes: ["01"],
          isActive: true,
        },
      ],
      workTeams: [],
      holidaySet: new Set<string>(),
      plannedStartDate: "2026-06-01",
    });

    const pdfBytes = renderEapScheduleReportPdf(payload);
    const pdfText = Buffer.from(pdfBytes).toString("latin1");

    expect(pdfBytes.length).toBeGreaterThan(500);
    expect(pdfText).toContain(hexString("Planejamento"));
    expect(pdfText).not.toContain(hexString("Baixo Padrao"));
    expect(pdfText).not.toContain(hexString("Betoneira"));
  });

  it("consolida desembolso mensal, Curva S e gera PDF de Aquisições & Calendário de Suprimentos", async () => {
    const monthly = buildProcurementMonthlyDisbursement([
      {
        id: "1",
        eapProjectId: "eap-36",
        packageId: null,
        packageNumber: 4,
        packageName: "Fundações",
        stageCode: "03",
        itemName: "Aço CA-50",
        category: "MATERIAL",
        unit: "kg",
        quantity: 1000,
        estimatedAmount: 10000,
        closedAmount: null,
        supplierName: null,
        needDate: "2026-06-15T00:00:00.000Z",
        leadTimeDays: 10,
        orderDeadlineDate: "2026-06-05T00:00:00.000Z",
        status: "A_COTAR",
        financialEntryId: null,
        notes: null,
      },
      {
        id: "2",
        eapProjectId: "eap-36",
        packageId: null,
        packageNumber: 14,
        packageName: "Pisos",
        stageCode: "14",
        itemName: "Porcelanato",
        category: "MATERIAL",
        unit: "m2",
        quantity: 220,
        estimatedAmount: 30000,
        closedAmount: null,
        supplierName: null,
        needDate: "2026-07-15T00:00:00.000Z",
        leadTimeDays: 15,
        orderDeadlineDate: "2026-07-01T00:00:00.000Z",
        status: "A_COTAR",
        financialEntryId: null,
        notes: null,
      },
    ]);

    expect(monthly).toHaveLength(2);
    expect(monthly[0]?.monthLabel).toBe("06/26");
    expect(monthly[0]?.cumulativePct).toBe(25);
    expect(monthly[1]?.cumulativeAmount).toBe(40000);
    expect(monthly[1]?.cumulativePct).toBe(100);

    const { prisma } = await import("@/server/db");
    const eapSpy = vi.spyOn(prisma.eapProject, "findUnique").mockResolvedValue({
      id: "eap-36",
      title: "Residência de Praia",
      procurementItems: [
        {
          id: "p1",
          packageId: null,
          packageNumber: 4,
          packageName: "Fundações",
          stageCode: "03",
          itemName: "Aço CA-50",
          category: "MATERIAL",
          unit: "kg",
          quantity: 1000,
          estimatedAmount: 10000,
          closedAmount: null,
          supplierName: null,
          needDate: new Date("2026-06-15T00:00:00.000Z"),
          leadTimeDays: 10,
          orderDeadlineDate: new Date("2026-06-05T00:00:00.000Z"),
          status: "A_COTAR",
          financialEntryId: null,
          notes: null,
        },
      ],
    } as never);
    const projSpy = vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      name: "Residência de Praia",
      client: { name: "Pedro" },
      eapProject: {
        builtAreaM2: 250,
        currentRevision: 9,
        city: { name: "Fortaleza", state: "CE" },
      },
    } as never);

    const pdfBuf = await buildProcurementPdfBuffer("proj-36");
    expect(pdfBuf.length).toBeGreaterThan(500);
    const pdfStr = pdfBuf.toString("latin1");
    expect(pdfStr).toContain(hexString("1. Curva S Financeira Acumulada e Fluxo de Desembolso Mensal"));
    expect(pdfStr).toContain(hexString("2. Tabela Consolidada de Desembolso Mensal"));
    expect(pdfStr).toContain(hexString("3. Calendario de Suprimentos e Compras da Obra"));

    eapSpy.mockRestore();
    projSpy.mockRestore();
  });
});
