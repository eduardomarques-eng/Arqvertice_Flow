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

/**
 * Gráfico Donut / Rosca vetorial colorido com legenda lateral detalhada.
 */
export function drawPdfDonutChart(
  pdf: PdfWriter,
  opts: {
    title: string;
    centerLabel: string;
    centerSubLabel?: string;
    segments: Array<{
      label: string;
      value: number;
      formattedValue: string;
      colorHex: string;
    }>;
  }
): void {
  const total = opts.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  if (total <= 0) return;

  const boxH = Math.max(122, 28 + opts.segments.length * 20);
  pdf.ensure(boxH + 14);

  pdf.drawText(opts.title, pdf.margin, pdf.y + 10, {
    size: 9.5,
    bold: true,
    color: hexToPdfRgb("#0F172A"),
  });
  pdf.y += 16;

  const startY = pdf.y;
  pdf.rect(pdf.margin, startY, pdf.contentWidth, boxH, {
    fill: hexToPdfRgb("#F8FAFC"),
    stroke: hexToPdfRgb("#E2E8F0"),
    lineWidth: 0.6,
  });

  const cx = pdf.margin + 72;
  const cy = startY + boxH / 2;
  const rOuter = 44;
  const rInner = 25;

  let currentAngle = -Math.PI / 2;
  for (const seg of opts.segments) {
    const val = Math.max(0, seg.value);
    if (val <= 0) continue;
    const sweep = (val / total) * Math.PI * 2;
    const steps = Math.max(8, Math.ceil((sweep / (Math.PI * 2)) * 72));
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const a = currentAngle + (sweep * i) / steps;
      pts.push({ x: cx + Math.cos(a) * rOuter, y: cy + Math.sin(a) * rOuter });
    }
    for (let i = steps; i >= 0; i--) {
      const a = currentAngle + (sweep * i) / steps;
      pts.push({ x: cx + Math.cos(a) * rInner, y: cy + Math.sin(a) * rInner });
    }
    pdf.polygon(pts, { fill: hexToPdfRgb(seg.colorHex), stroke: hexToPdfRgb("#FFFFFF"), lineWidth: 0.7 });
    currentAngle += sweep;
  }

  // Centro do Donut
  pdf.drawText(opts.centerLabel, cx, cy - 1, {
    size: 7.5,
    bold: true,
    align: "center",
    color: hexToPdfRgb("#0F172A"),
  });
  if (opts.centerSubLabel) {
    pdf.drawText(opts.centerSubLabel, cx, cy + 9, {
      size: 6.5,
      align: "center",
      color: hexToPdfRgb("#64748B"),
    });
  }

  // Legenda lateral
  const legX = pdf.margin + 148;
  const legW = pdf.contentWidth - 160;
  let legY = startY + 18;
  for (const seg of opts.segments) {
    const pct = ((Math.max(0, seg.value) / total) * 100).toFixed(1);
    pdf.rect(legX, legY - 7, 9, 9, { fill: hexToPdfRgb(seg.colorHex) });
    pdf.drawText(seg.label, legX + 14, legY, {
      size: 8.5,
      bold: true,
      color: hexToPdfRgb("#1E293B"),
    });
    pdf.drawText(`${seg.formattedValue} (${pct}%)`, legX + legW, legY, {
      size: 8,
      bold: true,
      align: "right",
      color: hexToPdfRgb("#334155"),
    });
    legY += 20;
  }

  pdf.y = startY + boxH + 10;
}

/**
 * Gráfico de barras agrupadas (2 séries comparativas, ex.: Material x Mão de Obra).
 */
export function drawPdfGroupedBarChart(
  pdf: PdfWriter,
  opts: {
    title: string;
    seriesA: { label: string; colorHex: string };
    seriesB: { label: string; colorHex: string };
    items: Array<{
      label: string;
      valueA: number;
      valueB: number;
      formattedA: string;
      formattedB: string;
    }>;
  }
): void {
  if (opts.items.length === 0) return;

  const rowH = 26;
  const headerH = 22;
  const totalH = headerH + opts.items.length * rowH + 10;
  pdf.ensure(totalH + 10);

  pdf.drawText(opts.title, pdf.margin, pdf.y + 10, {
    size: 9.5,
    bold: true,
    color: hexToPdfRgb("#0F172A"),
  });

  // Legenda topo direito
  const legX = pdf.margin + pdf.contentWidth - 180;
  pdf.rect(legX, pdf.y + 3, 8, 8, { fill: hexToPdfRgb(opts.seriesA.colorHex) });
  pdf.drawText(opts.seriesA.label, legX + 11, pdf.y + 10, {
    size: 7.5,
    color: hexToPdfRgb("#334155"),
  });
  pdf.rect(legX + 85, pdf.y + 3, 8, 8, { fill: hexToPdfRgb(opts.seriesB.colorHex) });
  pdf.drawText(opts.seriesB.label, legX + 96, pdf.y + 10, {
    size: 7.5,
    color: hexToPdfRgb("#334155"),
  });

  pdf.y += 18;

  const labelW = 128;
  const valueW = 92;
  const barAreaW = Math.max(80, pdf.contentWidth - labelW - valueW - 12);
  const maxVal = Math.max(
    1,
    ...opts.items.flatMap((i) => [i.valueA, i.valueB])
  );

  for (const item of opts.items) {
    pdf.ensure(rowH);
    const y0 = pdf.y;

    pdf.drawText(
      item.label.length > 24 ? `${item.label.slice(0, 22)}..` : item.label,
      pdf.margin,
      y0 + 13,
      { size: 8, bold: true, color: hexToPdfRgb("#1E293B") }
    );

    const trackX = pdf.margin + labelW;
    const wA = Math.max(2, (Math.max(0, item.valueA) / maxVal) * barAreaW);
    const wB = Math.max(2, (Math.max(0, item.valueB) / maxVal) * barAreaW);

    pdf.rect(trackX, y0 + 2, barAreaW, 8, { fill: hexToPdfRgb("#F1F5F9") });
    pdf.rect(trackX, y0 + 2, wA, 8, { fill: hexToPdfRgb(opts.seriesA.colorHex) });

    pdf.rect(trackX, y0 + 12, barAreaW, 8, { fill: hexToPdfRgb("#F1F5F9") });
    pdf.rect(trackX, y0 + 12, wB, 8, { fill: hexToPdfRgb(opts.seriesB.colorHex) });

    const valX = pdf.margin + pdf.contentWidth;
    pdf.drawText(item.formattedA, valX, y0 + 9, {
      size: 7,
      align: "right",
      color: hexToPdfRgb(opts.seriesA.colorHex),
    });
    pdf.drawText(item.formattedB, valX, y0 + 19, {
      size: 7,
      align: "right",
      color: hexToPdfRgb(opts.seriesB.colorHex),
    });

    pdf.y += rowH;
  }

  pdf.y += 6;
}

/**
 * Gráfico Pareto / Curva ABC (Top 10 etapas ou itens + barra de % acumulado 80/20).
 */
export function drawPdfParetoAbcChart(
  pdf: PdfWriter,
  opts: {
    title: string;
    items: Array<{
      label: string;
      formattedValue: string;
      value: number;
      cumulativePercent: number;
      abcClass: "A" | "B" | "C";
    }>;
  }
): void {
  if (opts.items.length === 0) return;

  const slice = opts.items.slice(0, 10);
  const rowH = 19;
  pdf.ensure(26 + slice.length * rowH + 10);

  pdf.drawText(opts.title, pdf.margin, pdf.y + 10, {
    size: 9.5,
    bold: true,
    color: hexToPdfRgb("#0F172A"),
  });
  pdf.y += 16;

  const labelW = 165;
  const valW = 110;
  const barAreaW = Math.max(80, pdf.contentWidth - labelW - valW - 10);
  const maxVal = Math.max(1, ...slice.map((i) => i.value));

  for (const item of slice) {
    pdf.ensure(rowH);
    const y0 = pdf.y;
    const colorHex =
      item.abcClass === "A"
        ? "#059669"
        : item.abcClass === "B"
          ? "#D97706"
          : "#64748B";

    pdf.rect(pdf.margin, y0 + 3, 12, 10, { fill: hexToPdfRgb(colorHex) });
    pdf.drawText(item.abcClass, pdf.margin + 6, y0 + 10.5, {
      size: 7,
      bold: true,
      align: "center",
      color: hexToPdfRgb("#FFFFFF"),
    });

    const cleanLabel = item.label.length > 29 ? `${item.label.slice(0, 27)}..` : item.label;
    pdf.drawText(cleanLabel, pdf.margin + 16, y0 + 11, {
      size: 7.5,
      color: hexToPdfRgb("#1E293B"),
    });

    const trackX = pdf.margin + labelW;
    pdf.rect(trackX, y0 + 4, barAreaW, 9, { fill: hexToPdfRgb("#F1F5F9") });
    const barW = Math.max(3, (Math.max(0, item.value) / maxVal) * barAreaW);
    pdf.rect(trackX, y0 + 4, barW, 9, { fill: hexToPdfRgb(colorHex) });

    // Marcador de 80% Pareto
    const x80 = trackX + barAreaW * 0.8;
    pdf.line(x80, y0 + 2, x80, y0 + 15, { stroke: "#DC2626", lineWidth: 0.6 });

    // Ponto do acumulado
    const cumX = trackX + Math.min(1, Math.max(0, item.cumulativePercent / 100)) * barAreaW;
    pdf.rect(cumX - 2, y0 + 6, 4, 5, { fill: hexToPdfRgb("#0F172A") });

    pdf.drawText(
      `${item.formattedValue} (${item.cumulativePercent.toFixed(0)}%)`,
      pdf.margin + pdf.contentWidth,
      y0 + 11,
      { size: 7, bold: true, align: "right", color: hexToPdfRgb("#334155") }
    );

    pdf.y += rowH;
  }

  pdf.y += 6;
}

/**
 * Gráfico Gantt vetorial colorido para cronograma de pacotes por fase.
 */
export function drawPdfGanttTimeline(
  pdf: PdfWriter,
  opts: {
    title: string;
    totalSpanDays: number;
    monthMarkers: Array<{ label: string; offsetRatio: number }>;
    bars: Array<{
      codeLabel: string;
      phaseLabel: string;
      phaseGroupTitle?: string;
      phaseGroupColorHex?: string;
      startRatio: number;
      widthRatio: number;
      cureWidthRatio?: number;
      colorHex: string;
      durationLabel: string;
    }>;
  }
): void {
  if (opts.bars.length === 0) return;

  pdf.ensure(64);
  pdf.drawText(opts.title, pdf.margin, pdf.y + 10, {
    size: 9.5,
    bold: true,
    color: hexToPdfRgb("#0F172A"),
  });
  pdf.y += 16;

  const labelW = 195;
  const rightW = 54;
  const chartW = Math.max(120, pdf.contentWidth - labelW - rightW - 8);
  const trackX = pdf.margin + labelW;

  const drawHeader = () => {
    pdf.rect(pdf.margin, pdf.y, pdf.contentWidth, 16, {
      fill: hexToPdfRgb("#0F172A"),
    });
    pdf.drawText("Pacote / Fase Construtiva", pdf.margin + 6, pdf.y + 11, {
      size: 7.5,
      bold: true,
      color: hexToPdfRgb("#FFFFFF"),
    });
    for (const m of opts.monthMarkers) {
      const mx = trackX + Math.min(0.95, Math.max(0, m.offsetRatio)) * chartW;
      pdf.drawText(m.label, mx, pdf.y + 11, {
        size: 6.5,
        bold: true,
        color: hexToPdfRgb("#CBD5E1"),
      });
    }
    pdf.drawText("Eq. / D.U.", pdf.margin + pdf.contentWidth - 4, pdf.y + 11, {
      size: 7.5,
      bold: true,
      align: "right",
      color: hexToPdfRgb("#FFFFFF"),
    });
    pdf.y += 17;
  };

  drawHeader();

  const rowH = 14;
  const groupHeaderH = 15;
  let lastGroupTitle = "";

  for (let i = 0; i < opts.bars.length; i++) {
    const bar = opts.bars[i];
    const hasNewGroup = Boolean(bar.phaseGroupTitle && bar.phaseGroupTitle !== lastGroupTitle);
    const neededH = rowH + (hasNewGroup ? groupHeaderH : 0);

    if (pdf.y + neededH > pdf.height - pdf.margin) {
      pdf.newPage();
      drawHeader();
      lastGroupTitle = "";
    }

    if (bar.phaseGroupTitle && bar.phaseGroupTitle !== lastGroupTitle) {
      lastGroupTitle = bar.phaseGroupTitle;
      const gColor = bar.phaseGroupColorHex ?? bar.colorHex;
      pdf.rect(pdf.margin, pdf.y, pdf.contentWidth, groupHeaderH, {
        fill: hexToPdfRgb("#F1F5F9"),
      });
      pdf.rect(pdf.margin, pdf.y, 4, groupHeaderH, {
        fill: hexToPdfRgb(gColor),
      });
      pdf.drawText(bar.phaseGroupTitle, pdf.margin + 9, pdf.y + 10.5, {
        size: 7.5,
        bold: true,
        color: hexToPdfRgb(gColor),
      });
      pdf.y += groupHeaderH;
    }

    const y0 = pdf.y;

    if (i % 2 === 1) {
      pdf.rect(pdf.margin, y0, pdf.contentWidth, rowH, {
        fill: hexToPdfRgb("#F8FAFC"),
      });
    }

    const txt =
      bar.codeLabel.length > 38
        ? `${bar.codeLabel.slice(0, 36)}..`
        : bar.codeLabel;
    pdf.drawText(txt, pdf.margin + 4, y0 + 10, {
      size: 6.8,
      color: hexToPdfRgb("#1E293B"),
    });

    // Linhas verticais suaves de mês
    for (const m of opts.monthMarkers) {
      const mx = trackX + Math.min(1, Math.max(0, m.offsetRatio)) * chartW;
      pdf.line(mx, y0, mx, y0 + rowH, { stroke: "#E2E8F0", lineWidth: 0.4 });
    }

    const bx = trackX + Math.min(0.98, Math.max(0, bar.startRatio)) * chartW;
    const bw = Math.max(4, Math.min(chartW - (bx - trackX), bar.widthRatio * chartW));
    pdf.rect(bx, y0 + 3, bw, rowH - 6, { fill: hexToPdfRgb(bar.colorHex) });

    // Marcador sutil de janela de cura / lag após a barra
    if (bar.cureWidthRatio && bar.cureWidthRatio > 0) {
      const cx = bx + bw;
      const cw = Math.max(2, Math.min(chartW - (cx - trackX), bar.cureWidthRatio * chartW));
      if (cw > 1.5) {
        pdf.rect(cx, y0 + 5, cw, rowH - 10, {
          fill: hexToPdfRgb("#FEF3C7"),
          stroke: hexToPdfRgb("#D97706"),
          lineWidth: 0.4,
        });
      }
    }

    pdf.drawText(bar.durationLabel, pdf.margin + pdf.contentWidth - 4, y0 + 10, {
      size: 6.8,
      bold: true,
      align: "right",
      color: hexToPdfRgb("#334155"),
    });

    pdf.y += rowH;
  }

  pdf.y += 8;
}

/**
 * Histograma vertical de carga mensal de equipes.
 */
export function drawPdfMonthlyHistogram(
  pdf: PdfWriter,
  opts: {
    title: string;
    teamSeries: Array<{ teamCode: string; label: string; colorHex: string }>;
    months: Array<{
      monthLabel: string;
      teamDays: Record<string, number>;
      totalDays: number;
    }>;
  }
): void {
  if (opts.months.length === 0) return;

  const boxH = 128;
  pdf.ensure(boxH + 28);

  pdf.drawText(opts.title, pdf.margin, pdf.y + 10, {
    size: 9.5,
    bold: true,
    color: hexToPdfRgb("#0F172A"),
  });

  // Legenda equipes
  let lx = pdf.margin + pdf.contentWidth - opts.teamSeries.length * 68;
  for (const ts of opts.teamSeries) {
    pdf.rect(lx, pdf.y + 3, 8, 8, { fill: hexToPdfRgb(ts.colorHex) });
    pdf.drawText(ts.label, lx + 11, pdf.y + 10, {
      size: 7.5,
      color: hexToPdfRgb("#334155"),
    });
    lx += 68;
  }

  pdf.y += 18;
  const startY = pdf.y;

  pdf.rect(pdf.margin, startY, pdf.contentWidth, boxH, {
    fill: hexToPdfRgb("#F8FAFC"),
    stroke: hexToPdfRgb("#E2E8F0"),
    lineWidth: 0.6,
  });

  const padX = 18;
  const plotW = pdf.contentWidth - padX * 2;
  const plotTop = startY + 14;
  const plotH = boxH - 36;
  const maxDays = Math.max(1, ...opts.months.map((m) => m.totalDays));

  const colSlotW = plotW / opts.months.length;
  const barW = Math.min(24, Math.max(8, colSlotW * 0.58));

  opts.months.forEach((m, idx) => {
    const cx = pdf.margin + padX + colSlotW * idx + colSlotW / 2;
    const bx = cx - barW / 2;
    let currentBottom = plotTop + plotH;

    for (const ts of opts.teamSeries) {
      const val = Math.max(0, m.teamDays[ts.teamCode] ?? 0);
      if (val <= 0) continue;
      const segH = (val / maxDays) * plotH;
      pdf.rect(bx, currentBottom - segH, barW, segH, {
        fill: hexToPdfRgb(ts.colorHex),
      });
      currentBottom -= segH;
    }

    if (m.totalDays > 0) {
      pdf.drawText(String(m.totalDays), cx, currentBottom - 3, {
        size: 6.5,
        bold: true,
        align: "center",
        color: hexToPdfRgb("#334155"),
      });
    }

    pdf.drawText(m.monthLabel, cx, plotTop + plotH + 12, {
      size: 6.5,
      align: "center",
      color: hexToPdfRgb("#475569"),
    });
  });

  pdf.y = startY + boxH + 10;
}
