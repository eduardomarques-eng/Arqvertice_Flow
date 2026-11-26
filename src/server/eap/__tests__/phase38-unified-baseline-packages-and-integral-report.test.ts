import { describe, expect, it, vi } from "vitest";
import { hexString } from "@/lib/pdf/pdf-writer";
import {
  buildExecutiveReportPayload,
  renderExecutiveReportPdf,
} from "@/server/eap/executive-report";
import { buildEapTreePayload } from "@/server/eap/workbench";
import { buildProcurementPdfBuffer } from "@/server/eap/procurement-plan";

describe("Phase 38 — Relatório Integral de Obra, Baseline & Pacotes e Aquisições", () => {
  it("gera Relatório Integral de Obra com título atualizado e cabeçalho limpo", () => {
    const tree = buildEapTreePayload({
      id: "eap-38",
      projectId: "proj-38",
      cityId: "city-38",
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

    const payload = buildExecutiveReportPayload({
      audience: "CLIENT",
      projectName: "Residência de Praia",
      clientName: "Pedro",
      tree,
      packages: [],
      analytics: {
        startDate: "2026-06-01",
        endDate: "2026-12-01",
        totalMonths: 6,
        totalWorkingDays: 130,
        holidaysAppliedCount: 0,
        peakFronts: 1,
        peakTeams: 1,
        totalCommercialPrice: 0,
        weeklyHistogram: [],
        monthlySeries: [],
      },
      technicalSheets: [],
      galleryImages: [],
      latestBaselineLabel: "R09",
    });

    const pdfBytes = renderExecutiveReportPdf(payload);
    const pdfStr = Buffer.from(pdfBytes).toString("latin1");

    expect(pdfStr.startsWith("%PDF-")).toBe(true);
    expect(pdfStr).toContain(hexString("RELATORIO INTEGRAL DE OBRA"));
    expect(pdfStr).toContain(hexString("STATUS & SAUDE DA OBRA"));
    expect(pdfStr).not.toContain(hexString("DOSSIE EXECUTIVO INTEGRAL"));
    expect(pdfStr).not.toContain(hexString("INDICADORES TQS/BIM"));
  });

  it("gera PDF enquadrado de Aquisições & Calendário de Suprimentos com cabeçalho padrão", async () => {
    const { prisma } = await import("@/server/db");
    const eapSpy = vi.spyOn(prisma.eapProject, "findUnique").mockResolvedValue({
      id: "eap-38",
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

    const pdfBuf = await buildProcurementPdfBuffer("proj-38");
    const pdfStr = pdfBuf.toString("latin1");
    expect(pdfStr.startsWith("%PDF-")).toBe(true);
    expect(pdfStr).toContain(hexString("Aquisicoes & Calendario de Suprimentos"));

    eapSpy.mockRestore();
    projSpy.mockRestore();
  });
});
