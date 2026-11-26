import { describe, expect, it } from "vitest";
import { hexString } from "@/lib/pdf/pdf-writer";
import {
  decodeImageBufferToPdfImage,
  decodeJpegToPdfImage,
} from "@/lib/pdf/pdf-image";
import { buildFieldMeasurementChartData } from "@/lib/eap-measurement-charts";
import {
  renderFieldMeasurementBulletinPdf,
  toEvidenceDto,
  type PdfBulletinEvidenceInput,
} from "@/server/eap/field-measurement";

/**
 * Gera um buffer JPEG mínimo sintético contendo SOI (FFD8) + SOF0 (FFC0, 120x80) + EOI (FFD9)
 * suficiente para validar o parser de dimensões SOF e o stream /DCTDecode no PdfWriter.
 */
function buildMinimalSyntheticJpeg(width: number, height: number): Buffer {
  return Buffer.from([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    0x00, 0x0b, // length = 11
    0x08, // precision
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03, // components
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xda, // SOS
    0x00, 0x08,
    0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xaa, 0xbb,
    0xff, 0xd9, // EOI
  ]);
}

describe("Phase 32 — Medição em Obra: Evidências Foto/Vídeo, Gráficos e Preview do Boletim PDF", () => {
  it("mapeia evidências IMAGE e VIDEO para DTO e decodifica JPEG/PNG para embutimento em PDF", () => {
    const imgDto = toEvidenceDto("proj-123", {
      id: "ev-img-1",
      eapProjectId: "eap-1",
      bulletinId: "bm-1",
      rowKey: "TERREO::item-1",
      floorId: "TERREO",
      floorName: "Térreo",
      eapItemId: "item-1",
      serviceLabel: "05 · Alvenaria de Vedação",
      mediaType: "IMAGE",
      fileName: "alvenaria-terreo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 42000,
      storageKey: "db://ev-img-1",
      durationSec: null,
      capturedAt: new Date("2026-11-26T12:00:00.000Z"),
    });
    expect(imgDto.mediaType).toBe("IMAGE");
    expect(imgDto.url).toBe(
      "/api/eap/projects/proj-123/measurements/evidence/ev-img-1"
    );

    const vidDto = toEvidenceDto("proj-123", {
      id: "ev-vid-1",
      eapProjectId: "eap-1",
      bulletinId: null,
      rowKey: "PAV_SUPERIOR::item-2",
      floorId: "PAV_SUPERIOR",
      floorName: "Pavimento Superior",
      eapItemId: "item-2",
      serviceLabel: "04 · Concretagem Laje Superior",
      mediaType: "VIDEO",
      fileName: "concretagem.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1850000,
      storageKey: "db://ev-vid-1",
      durationSec: 18.5,
      capturedAt: "2026-11-26T12:05:00.000Z",
    });
    expect(vidDto.mediaType).toBe("VIDEO");
    expect(vidDto.durationSec).toBe(18.5);

    const jpg = buildMinimalSyntheticJpeg(320, 240);
    const decoded = decodeJpegToPdfImage(jpg);
    expect(decoded).not.toBeNull();
    expect(decoded?.width).toBe(320);
    expect(decoded?.height).toBe(240);
    expect(decoded?.jpegBytes?.byteLength).toBe(jpg.byteLength);

    const autoDecoded = decodeImageBufferToPdfImage(jpg, "image/jpeg");
    expect(autoDecoded?.width).toBe(320);
  });

  it("consolida dados dos 3 gráficos de evolução (Pavimentos, Financeiro e Status dos Serviços)", () => {
    const chartData = buildFieldMeasurementChartData({
      summary: {
        totalPlannedValue: 100000,
        totalAccumulatedValue: 45000,
        totalMeasuredValue: 15000,
        totalPendingValue: 55000,
        plannedLobPct: 50,
      },
      floorSummaries: [
        { floorId: "FUNDACAO", floorName: "Infraestrutura e Fundação", progressPct: 100 },
        { floorId: "TERREO", floorName: "Térreo", progressPct: 40 },
      ],
      items: [
        { status: "CONCLUIDO" },
        { status: "EM_ANDAMENTO" },
        { status: "EM_ANDAMENTO" },
        { status: "PENDENTE" },
      ],
      plannedLobPctByFloor: {
        FUNDACAO: 100,
        TERREO: 60,
      },
    });

    expect(chartData.floorComparison).toEqual([
      { floorId: "FUNDACAO", floorName: "Infraestrutura e Fundação", plannedPct: 100, realizedPct: 100 },
      { floorId: "TERREO", floorName: "Térreo", plannedPct: 60, realizedPct: 40 },
    ]);

    expect(chartData.financialComposition.previousAccumulated).toBe(30000);
    expect(chartData.financialComposition.currentPeriod).toBe(15000);
    expect(chartData.financialComposition.pendingRemaining).toBe(55000);
    expect(chartData.financialComposition.slices.map((s) => s.percent)).toEqual([30, 15, 55]);

    const statusCounts = Object.fromEntries(
      chartData.serviceStatusDistribution.map((s) => [s.key, s.count])
    );
    expect(statusCounts).toEqual({
      CONCLUIDO: 1,
      EM_ANDAMENTO: 2,
      PENDENTE: 1,
      IMPEDIDO: 0,
    });
  });

  it("renderiza PDF do Boletim com logo oficial, gráficos, registro fotográfico JPEG e sem abreviações opacas", () => {
    const syntheticJpg = buildMinimalSyntheticJpeg(200, 150);
    const evidences: PdfBulletinEvidenceInput[] = [
      {
        id: "ev-photo-1",
        eapProjectId: "eap-1",
        bulletinId: "bm-1",
        rowKey: "TERREO::item-1",
        floorId: "TERREO",
        floorName: "Térreo",
        eapItemId: "item-1",
        serviceLabel: "05 · Alvenaria Estrutural",
        mediaType: "IMAGE",
        fileName: "foto-alvenaria.jpg",
        mimeType: "image/jpeg",
        sizeBytes: syntheticJpg.byteLength,
        storageKey: "db://ev-photo-1",
        durationSec: null,
        capturedAt: "2026-11-26T12:00:00.000Z",
        url: "/api/eap/projects/proj-1/measurements/evidence/ev-photo-1",
        imageBytes: syntheticJpg,
      },
      {
        id: "ev-vid-1",
        eapProjectId: "eap-1",
        bulletinId: "bm-1",
        rowKey: "TERREO::item-1",
        floorId: "TERREO",
        floorName: "Térreo",
        eapItemId: "item-1",
        serviceLabel: "05 · Alvenaria Estrutural",
        mediaType: "VIDEO",
        fileName: "vistoria.mp4",
        mimeType: "video/mp4",
        sizeBytes: 900000,
        storageKey: "db://ev-vid-1",
        durationSec: 12,
        capturedAt: "2026-11-26T12:02:00.000Z",
        url: "/api/eap/projects/proj-1/measurements/evidence/ev-vid-1",
        imageBytes: null,
      },
    ];

    const pdfBytes = renderFieldMeasurementBulletinPdf({
      projectName: "Residência de Praia - Pedro",
      bulletinCode: "BM-01",
      referenceDate: "2026-11-26",
      status: "APROVADO",
      inspectorName: "Eng. Eduardo Marques",
      weatherCondition: "SOL",
      generalNotes: "Vistoria realizada com equipe completa.",
      summary: {
        totalPlannedValue: 120000,
        totalAccumulatedValue: 60000,
        totalMeasuredValue: 25000,
        totalPendingValue: 60000,
        physicalProgressPct: 50,
        plannedLobPct: 48,
        deviationPct: 2,
        completedItemsCount: 1,
        totalItemsCount: 2,
      },
      floorSummaries: [
        {
          floorId: "TERREO",
          floorName: "Térreo",
          floorOrder: 2,
          itemsCount: 2,
          completedCount: 1,
          plannedAmount: 120000,
          accumulatedAmount: 60000,
          pendingAmount: 60000,
          progressPct: 50,
        },
      ],
      items: [
        {
          rowKey: "TERREO::item-1",
          floorId: "TERREO",
          floorName: "Térreo",
          floorOrder: 2,
          packageNumber: 5,
          teamCode: "A",
          eapItemId: "item-1",
          serviceLabel: "05 · Alvenaria Estrutural",
          unit: "m²",
          fieldNote: null,
          plannedQty: 100,
          previousExecutedQty: 35,
          currentExecutedQty: 25,
          accumulatedQty: 60,
          pendingQty: 40,
          accumulatedPct: 60,
          unitPrice: 1000,
          plannedAmount: 100000,
          measuredAmount: 25000,
          accumulatedAmount: 60000,
          pendingAmount: 40000,
          status: "EM_ANDAMENTO",
        },
      ],
      evidences,
    });

    const raw = Buffer.from(pdfBytes).toString("latin1").toLowerCase();
    expect(raw.startsWith("%pdf-1.4")).toBe(true);
    expect(raw).toContain("/subtype /image");
    expect(raw).toContain("/filter /dctdecode");
    const hexBody = (s: string) => hexString(s).slice(1, -1).toLowerCase();
    expect(raw).toContain(hexBody("Registro Fotografico e Evidencias de Campo"));
    expect(raw).toContain(hexBody("Videos anexados no portal da obra (1)"));
    expect(raw).not.toContain(hexBody("d.u."));
    expect(raw).not.toContain(hexBody("Eq."));
  });
});
