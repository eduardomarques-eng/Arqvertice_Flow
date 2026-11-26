import { describe, expect, it, vi } from "vitest";
import { hexString } from "@/lib/pdf/pdf-writer";
import {
  renderSiteDiaryPdfBuffer,
  summarizeSiteDiaryPeriod,
  type SiteDiaryEntryDTO,
} from "@/server/eap/site-diary";
import { renderFieldMeasurementBulletinPdf } from "@/server/eap/field-measurement";

describe("Phase 37 — Diário de Obra Integrado à Medição & Experiência do Cliente", () => {
  it("resume período do Diário de Obra e gera PDF limpo com ocorrências", async () => {
    const mockEntries: SiteDiaryEntryDTO[] = [
      {
        id: "d1",
        eapProjectId: "eap-37",
        bulletinId: null,
        entryDate: "2026-06-10",
        weatherMorning: "SOL",
        weatherAfternoon: "CHUVA",
        siteCondition: "PARCIAL",
        workforceSummary: { teamA: 3, teamB: 2, teamC: 2, thirdParty: 1, total: 8 },
        activitiesExecuted: "Concretagem de pilares do térreo",
        occurrencesAndNotes: "Chuva leve após 15h; entrega de aço CA-50",
        mediaItems: [],
        createdAt: "2026-06-10T18:00:00.000Z",
      },
    ];

    const summary = summarizeSiteDiaryPeriod(mockEntries);
    expect(summary.totalDays).toBe(1);
    expect(summary.rainDays).toBe(1);
    expect(summary.avgWorkforce).toBe(8);
    expect(summary.latestOccurrences).toHaveLength(1);

    const { prisma } = await import("@/server/db");
    const projSpy = vi.spyOn(prisma.project, "findUnique").mockResolvedValue({
      name: "Residência de Praia",
      client: { name: "Pedro" },
      eapProject: {
        builtAreaM2: 250,
        currentRevision: 9,
        city: { name: "Fortaleza", state: "CE" },
      },
    } as never);
    const eapSpy = vi.spyOn(prisma.eapProject, "findUnique").mockResolvedValue({
      id: "eap-37",
    } as never);
    const diarySpy = vi.spyOn(prisma.eapSiteDiaryEntry, "findMany").mockResolvedValue([
      {
        id: "d1",
        eapProjectId: "eap-37",
        bulletinId: null,
        entryDate: new Date("2026-06-10T12:00:00.000Z"),
        weatherMorning: "SOL",
        weatherAfternoon: "CHUVA",
        siteCondition: "PARCIAL",
        workforceSummary: { teamA: 3, teamB: 2, teamC: 2, thirdParty: 1, total: 8 },
        activitiesExecuted: "Concretagem de pilares do térreo",
        occurrencesAndNotes: "Chuva leve após 15h; entrega de aço CA-50",
        mediaItems: [],
        createdAt: new Date("2026-06-10T18:00:00.000Z"),
      },
    ] as never);

    const pdfBuf = await renderSiteDiaryPdfBuffer("proj-37");
    const pdfStr = pdfBuf.toString("latin1");
    expect(pdfBuf.length).toBeGreaterThan(500);
    expect(pdfStr).toContain(hexString("Diário de Obra"));
    expect(pdfStr).not.toContain(hexString("Baixo Padrao"));
    expect(pdfStr).not.toContain(hexString("Betoneira"));

    projSpy.mockRestore();
    eapSpy.mockRestore();
    diarySpy.mockRestore();
  });

  it("inclui Resumo do Diário de Obra e Curva S de Evolução no Boletim de Medição PDF", () => {
    const pdfBytes = renderFieldMeasurementBulletinPdf({
      projectName: "Residência de Praia",
      bulletinCode: "BM-02",
      referenceDate: "2026-06-15",
      status: "RASCUNHO",
      inspectorName: "Eng. Eduardo",
      weatherCondition: "SOL",
      summary: {
        physicalProgressPct: 24.5,
        plannedLobPct: 22.0,
        deviationPct: 2.5,
        totalPlannedValue: 499875.44,
        totalMeasuredValue: 42500,
        totalAccumulatedValue: 122500,
        totalPendingValue: 377375.44,
        completedItemsCount: 4,
        totalItemsCount: 20,
      },
      floorSummaries: [
        {
          floorId: "FUNDACAO",
          floorName: "Fundação",
          floorOrder: 1,
          itemsCount: 5,
          completedCount: 4,
          plannedAmount: 100000,
          accumulatedAmount: 95000,
          pendingAmount: 5000,
          progressPct: 95,
        },
      ],
      items: [],
      siteDiarySummary: {
        totalDays: 12,
        operableDays: 10,
        rainDays: 2,
        avgWorkforce: 7.5,
        latestOccurrences: [
          { entryDate: "2026-06-10", text: "Entrega de aço CA-50 concluída" },
        ],
      },
      evolutionCurve: [
        { code: "BM-01", plannedPct: 12.0, realizedPct: 16.0 },
        { code: "BM-02", plannedPct: 22.0, realizedPct: 24.5 },
      ],
    });

    const pdfStr = Buffer.from(pdfBytes).toString("latin1");
    expect(pdfBytes.length).toBeGreaterThan(500);
    expect(pdfStr).toContain(hexString("Resumo do Diario de Obra no Periodo"));
    expect(pdfStr).toContain(
      hexString("Curva S de Evolucao Fisica (% Planejado Acumulado x % Medido Acumulado)")
    );
  });
});
