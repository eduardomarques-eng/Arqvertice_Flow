import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PdfWriter, hexString } from "@/lib/pdf/pdf-writer";
import {
  drawPdfBrandedHeader,
  drawPdfGanttTimeline,
  PDF_PALETTE,
} from "@/lib/pdf/pdf-charts";
import { getOfficialArqVerticeLogoForPdf } from "@/lib/pdf/pdf-image";

describe("Phase 31 — Logo Oficial da Pasta nos PDFs & Cronograma sem Abreviações", () => {
  it("carrega public/logo.png e embute como Image XObject (/Subtype /Image) no PdfWriter", () => {
    const logo = getOfficialArqVerticeLogoForPdf();
    expect(logo).not.toBeNull();
    expect(logo!.width).toBeGreaterThan(0);
    expect(logo!.height).toBeGreaterThan(0);
    expect(logo!.rgbFlate?.length).toBeGreaterThan(100);

    const pdf = new PdfWriter({
      title: "Teste Logo Oficial",
      author: "ArqVértice OS",
      subject: "Validação de Imagem",
    });

    drawPdfBrandedHeader(pdf, {
      eyebrow: "ARQVERTICE OS · TESTE",
      title: "Relatorio com Logo Oficial",
      subtitle: "Cliente: Pedro · Residencia de Praia",
      metaLine: "Gerado automaticamente",
    });

    const bytes = pdf.build();
    const raw = Buffer.from(bytes).toString("latin1");

    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(raw).toContain("/Subtype /Image");
    expect(raw).toContain("/XObject");
    expect(raw).toContain("/Im1");
    expect(raw).toContain("/FlateDecode");
  });

  it("renderiza Cronograma Gantt sem truncar nomes de pacotes com reticências e com meses espaçados", () => {
    const pdf = new PdfWriter({
      title: "Cronograma Gantt",
      author: "ArqVértice OS",
      subject: "Teste Cronograma",
    });

    drawPdfBrandedHeader(pdf, {
      eyebrow: "ARQVERTICE OS · PLANEJAMENTO",
      title: "Relatorio de Planejamento",
      subtitle: "Cronograma Fisico",
      metaLine: "12 meses",
    });

    const months = [
      "Mai/27", "Jun/27", "Jul/27", "Ago/27", "Set/27", "Out/27",
      "Nov/27", "Dez/27", "Jan/28", "Fev/28", "Mar/28", "Abr/28",
    ];
    drawPdfGanttTimeline(pdf, {
      title: "Cronograma",
      totalSpanDays: 360,
      monthMarkers: months.map((label, idx) => ({
        label,
        offsetRatio: idx / months.length,
      })),
      bars: [
        {
          codeLabel: "Pacote 04 · Supraestrutura de Concreto Armado e Lajes Macicas",
          phaseLabel: "Fase 2 — Estrutura",
          phaseGroupTitle: "Fase 2 — Estrutura e Vedacoes",
          phaseGroupColorHex: PDF_PALETTE[0],
          startRatio: 0.1,
          widthRatio: 0.25,
          cureWidthRatio: 0.05,
          colorHex: PDF_PALETTE[0],
          durationLabel: "Equipe A · 18 Dias Uteis",
        },
      ],
    });

    const raw = Buffer.from(pdf.build()).toString("latin1").toLowerCase();
    // Nome completo do pacote sem "..." (quebrado em até 2 linhas limpas)
    const hexBody = (s: string) => hexString(s).slice(1, -1).toLowerCase();
    expect(raw).toContain(hexBody("Supraestrutura"));
    expect(raw).toContain(hexBody("Concreto"));
    expect(raw).toContain(hexBody("Macicas"));
    expect(raw).not.toContain(hexBody("..."));
    // Texto completo sem abreviações opacas
    expect(raw).toContain(hexBody("Equipe A"));
    expect(raw).toContain(hexBody("Dias Uteis"));
    expect(raw).not.toContain(hexBody("d.u."));
    expect(raw).not.toContain(hexBody("Onda"));
  });

  it("confirma uso de /logo.png nos componentes de relatório Web e ausência de d.u./d.c. nos relatórios principais", () => {
    const webFiles = [
      "src/components/admin/eap/eap-cost-report-view.tsx",
      "src/components/admin/eap/eap-schedule-report-view.tsx",
      "src/components/admin/eap/eap-procurement-view.tsx",
      "src/components/eap/eap-executive-report-view.tsx",
      "src/components/admin/eap/eap-field-measurement.tsx",
    ];

    for (const rel of webFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
      expect(content).toContain("/logo.png");
    }

    const schedReportView = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/admin/eap/eap-schedule-report-view.tsx"),
      "utf8"
    );
    expect(schedReportView).not.toMatch(/\bd\.u\./);
    expect(schedReportView).not.toMatch(/\bd\.c\./);
  });
});
