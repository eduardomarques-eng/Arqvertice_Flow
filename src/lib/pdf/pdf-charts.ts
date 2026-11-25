import type { PdfWriter } from "@/lib/pdf/pdf-writer";

/** Converte `#rrggbb` para `"r g b"` (0..1) compatível com o operador `rg`/`RG` do PDF 1.4. */
export function hexToPdfRgb(hex: string): string {
  const clean = hex.trim();
  if (!clean.startsWith("#")) return clean;
  const h = clean.slice(1);
  if (h.length !== 6) return "0.09 0.11 0.16";
  const r = (parseInt(h.slice(0, 2), 16) / 255).toFixed(3);
  const g = (parseInt(h.slice(2, 4), 16) / 255).toFixed(3);
  const b = (parseInt(h.slice(4, 6), 16) / 255).toFixed(3);
  return `${r} ${g} ${b}`;
}

export const PDF_PALETTE = [
  "#2563EB", // Azul Royal
  "#059669", // Esmeralda
  "#D97706", // Âmbar
  "#7C3AED", // Roxo
  "#0891B2", // Ciano
  "#DC2626", // Vermelho
  "#4F46E5", // Índigo
  "#65A30D", // Oliva
];

export function drawPdfBrandedHeader(
  pdf: PdfWriter,
  opts: {
    eyebrow: string;
    title: string;
    subtitle: string;
    metaLine: string;
    accentHex?: string;
  }
): void {
  const accent = hexToPdfRgb(opts.accentHex ?? "#2563EB");
  pdf.rect(0, 0, pdf.width, 94, { fill: hexToPdfRgb("#11131A") });
  pdf.rect(0, 94, pdf.width, 4, { fill: accent });

  pdf.drawText(opts.eyebrow.toUpperCase(), pdf.margin, 24, {
    size: 8.5,
    bold: true,
    color: hexToPdfRgb("#93C5FD"),
  });
  pdf.drawText(opts.title, pdf.margin, 46, {
    size: 14.5,
    bold: true,
    color: "1 1 1",
  });
  pdf.drawText(opts.subtitle, pdf.margin, 65, {
    size: 9.5,
    color: hexToPdfRgb("#E2E8F0"),
  });
  pdf.drawText(opts.metaLine, pdf.margin, 81, {
    size: 8,
    color: hexToPdfRgb("#94A3B8"),
  });

  pdf.y = 110;
}

export function drawPdfKpiCardsRow(
  pdf: PdfWriter,
  cards: Array<{
    label: string;
    value: string;
    sub?: string;
    accentHex: string;
    bgHex?: string;
  }>
): void {
  if (cards.length === 0) return;
  const gap = 8;
  const cardH = 48;
  pdf.ensure(cardH + 8);
  const totalGap = gap * (cards.length - 1);
  const cardW = (pdf.contentWidth - totalGap) / cards.length;
  const y0 = pdf.y;

  cards.forEach((c, idx) => {
    const x = pdf.margin + idx * (cardW + gap);
    pdf.rect(x, y0, cardW, cardH, {
      fill: hexToPdfRgb(c.bgHex ?? "#F8FAFC"),
      stroke: hexToPdfRgb("#CBD5E1"),
      lineWidth: 0.5,
    });
    pdf.rect(x, y0, cardW, 3.5, { fill: hexToPdfRgb(c.accentHex) });
    pdf.drawText(c.label.toUpperCase(), x + 8, y0 + 15, {
      size: 7,
      bold: true,
      color: hexToPdfRgb("#475569"),
    });
    pdf.drawText(c.value, x + 8, y0 + 31, {
      size: 11,
      bold: true,
      color: hexToPdfRgb("#0F172A"),
    });
    if (c.sub) {
      pdf.drawText(c.sub, x + 8, y0 + 42, {
        size: 7,
        color: hexToPdfRgb("#64748B"),
      });
    }
  });

  pdf.y = y0 + cardH + 10;
}

export function drawPdfHorizontalBarChart(
  pdf: PdfWriter,
  opts: {
    title: string;
    items: Array<{
      label: string;
      value: number;
      formattedValue: string;
      colorHex?: string;
      percent?: number;
    }>;
  }
): void {
  if (opts.items.length === 0) return;
  const rowH = 16;
  const headerH = 18;
  pdf.ensure(headerH + opts.items.length * rowH + 12);

  pdf.drawText(opts.title, pdf.margin, pdf.y + 11, {
    size: 9.5,
    bold: true,
    color: hexToPdfRgb("#0F172A"),
  });
  pdf.y += headerH;

  const maxVal = Math.max(...opts.items.map((i) => i.value), 1);
  const labelW = 148;
  const valueW = 112;
  const barMaxW = Math.max(80, pdf.contentWidth - labelW - valueW - 10);

  opts.items.forEach((item, idx) => {
    pdf.ensure(rowH + 4);
    const yRow = pdf.y;
    const ratio = item.value > 0 ? Math.max(0.025, Math.min(1, item.value / maxVal)) : 0;
    const color = hexToPdfRgb(item.colorHex ?? PDF_PALETTE[idx % PDF_PALETTE.length]);

    const truncatedLabel =
      item.label.length > 28 ? `${item.label.slice(0, 26)}..` : item.label;
    pdf.drawText(truncatedLabel, pdf.margin, yRow + 10, {
      size: 8,
      color: hexToPdfRgb("#1E293B"),
    });

    pdf.rect(pdf.margin + labelW, yRow + 2, barMaxW, 10, { fill: hexToPdfRgb("#E2E8F0") });
    if (ratio > 0) {
      pdf.rect(pdf.margin + labelW, yRow + 2, barMaxW * ratio, 10, { fill: color });
    }

    const rightText =
      typeof item.percent === "number"
        ? `${item.formattedValue} (${item.percent.toFixed(1)}%)`
        : item.formattedValue;
    pdf.drawText(rightText, pdf.margin + pdf.contentWidth, yRow + 10, {
      size: 7.5,
      bold: true,
      align: "right",
      color: hexToPdfRgb("#0F172A"),
    });

    pdf.y += rowH;
  });

  pdf.y += 8;
}

export function drawPdfStackedDistributionBar(
  pdf: PdfWriter,
  opts: {
    title: string;
    segments: Array<{
      label: string;
      value: number;
      colorHex: string;
    }>;
  }
): void {
  const total = opts.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  if (total <= 0) return;

  pdf.ensure(46);
  pdf.drawText(opts.title, pdf.margin, pdf.y + 10, {
    size: 9,
    bold: true,
    color: hexToPdfRgb("#0F172A"),
  });
  pdf.y += 15;

  const barY = pdf.y;
  const barH = 12;
  let cursorX = pdf.margin;

  opts.segments.forEach((seg, idx) => {
    const share = Math.max(0, seg.value) / total;
    const segW =
      idx === opts.segments.length - 1
        ? pdf.margin + pdf.contentWidth - cursorX
        : pdf.contentWidth * share;
    if (segW > 0.5) {
      pdf.rect(cursorX, barY, segW, barH, { fill: hexToPdfRgb(seg.colorHex) });
      cursorX += segW;
    }
  });

  pdf.y = barY + barH + 7;

  let legX = pdf.margin;
  const legY = pdf.y;
  opts.segments.forEach((seg) => {
    const pct = ((Math.max(0, seg.value) / total) * 100).toFixed(1);
    const labelStr = `${seg.label} (${pct}%)`;
    const estW = labelStr.length * 4.2 + 18;
    if (legX + estW > pdf.margin + pdf.contentWidth) {
      legX = pdf.margin;
      pdf.y += 12;
    }
    pdf.rect(legX, pdf.y + 1, 7, 7, { fill: hexToPdfRgb(seg.colorHex) });
    pdf.drawText(labelStr, legX + 10, pdf.y + 7.5, {
      size: 7.5,
      color: hexToPdfRgb("#334155"),
    });
    legX += estW;
  });

  pdf.y = Math.max(legY + 16, pdf.y + 14);
}
