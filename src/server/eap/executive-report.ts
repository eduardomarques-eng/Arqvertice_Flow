import { prisma } from "@/server/db";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import { round2 } from "./calculator";
import { buildEapTreePayload, type ComputedEapItemDTO } from "./workbench";
import { computeScheduleAnalytics, type MonthlyCashflowPoint } from "./scheduler";

export type ReportAudience = "INTERNAL" | "CLIENT";
export type AbcClass = "A" | "B" | "C";

export interface AbcCurveItemDTO {
  id: string;
  code: string | null;
  stageCode: string;
  description: string;
  unit: string;
  quantity: number;
  totalCommercialPrice: number;
  sharePercent: number;
  cumulativePercent: number;
  abcClass: AbcClass;
}

export interface AbcClassSummaryDTO {
  itemsCount: number;
  totalCommercialPrice: number;
  sharePercent: number;
}

export interface ExecutiveReportItemDTO {
  id: string;
  code: string | null;
  description: string;
  unit: string;
  totalQtyWithLoss: number;
  zoneQuantities: ComputedEapItemDTO["zoneQuantities"];
  unitCommercialPrice: number;
  totalCommercialPrice: number;
  weightPercent: number;
  // Campos internos omitidos (undefined) quando audience === "CLIENT"
  materialUnitCost?: number;
  laborUnitCost?: number;
  thirdPartyUnitCost?: number;
  unitDirectCost?: number;
  totalDirectCost?: number;
  markupMultiplier?: number;
}

export interface ExecutiveReportStageDTO {
  code: string;
  name: string;
  itemsCount: number;
  totalCommercialPrice: number;
  weightPercent: number;
  totalDirectCost?: number;
  items: ExecutiveReportItemDTO[];
}

export interface ExecutiveWaveSummaryDTO {
  waveName: string;
  packagesCount: number;
  startDate: string | null;
  endDate: string | null;
  totalWorkingDays: number;
}

export interface ExecutiveAcervoSheetDTO {
  id: string;
  code: string;
  title: string;
  discipline: string;
  revisionNumber: string;
  status: string;
  fileUrl: string;
  fileName: string;
}

export interface ExecutiveGalleryImageDTO {
  id: string;
  title: string;
  discipline: string;
  fileUrl: string;
  version: string;
}

export interface ExecutiveReportPayload {
  audience: ReportAudience;
  meta: {
    projectId: string;
    projectName: string;
    clientName: string;
    cityLabel: string;
    builtAreaM2: number;
    bdiPercent?: number;
    status: string;
    baselineLabel: string;
    startDate: string | null;
    endDate: string | null;
    totalMonths: number;
    totalWorkingDays: number;
    isPublishedToClient: boolean;
  };
  kpis: {
    totalCommercialPrice: number;
    costPerM2: number;
    totalDirectCost?: number;
    directCostPerM2?: number;
    materialSharePercent: number;
    laborSharePercent: number;
    thirdPartySharePercent: number;
    steelRateKgPerM3: number;
    concreteM3PerM2: number;
    masonryM2PerM2: number;
  };
  stages: ExecutiveReportStageDTO[];
  abcCurve: {
    items: AbcCurveItemDTO[];
    summaryByClass: Record<AbcClass, AbcClassSummaryDTO>;
  };
  schedule: {
    waves: ExecutiveWaveSummaryDTO[];
    monthlySeries: MonthlyCashflowPoint[];
    procurementMilestones: Array<{
      id: string;
      title: string;
      triggerDate: string;
      leadTimeDays: number;
      status: string;
    }>;
  };
  acervoVisuals: {
    technicalSheets: ExecutiveAcervoSheetDTO[];
    galleryImages: ExecutiveGalleryImageDTO[];
  };
  premises: string[];
  exclusions: string[];
}

const PUBLISHED_STATUSES = new Set(["BASELINE_APROVADA", "EM_EXECUCAO", "CONCLUIDA"]);

export function computeAbcCurve(
  items: Array<{
    id: string;
    code: string | null;
    stageCode: string;
    description: string;
    unit: string;
    totalQtyWithLoss: number;
    totalCommercialPrice: number;
  }>
): ExecutiveReportPayload["abcCurve"] {
  const active = items
    .filter((i) => i.totalQtyWithLoss > 0 && i.totalCommercialPrice > 0)
    .sort((a, b) => b.totalCommercialPrice - a.totalCommercialPrice);

  const grandTotal = round2(active.reduce((acc, i) => acc + i.totalCommercialPrice, 0));

  let runningTotal = 0;
  let prevCumulative = 0;

  const abcItems: AbcCurveItemDTO[] = active.map((item, idx) => {
    runningTotal = round2(runningTotal + item.totalCommercialPrice);
    const sharePercent = grandTotal > 0 ? round2((item.totalCommercialPrice / grandTotal) * 100) : 0;
    const isLast = idx === active.length - 1;
    const cumulativePercent =
      grandTotal > 0 ? (isLast ? 100 : round2((runningTotal / grandTotal) * 100)) : 0;

    let abcClass: AbcClass;
    if (prevCumulative < 80) {
      abcClass = "A";
    } else if (prevCumulative < 95) {
      abcClass = "B";
    } else {
      abcClass = "C";
    }
    prevCumulative = cumulativePercent;

    return {
      id: item.id,
      code: item.code,
      stageCode: item.stageCode,
      description: item.description,
      unit: item.unit,
      quantity: item.totalQtyWithLoss,
      totalCommercialPrice: round2(item.totalCommercialPrice),
      sharePercent,
      cumulativePercent,
      abcClass,
    };
  });

  const makeSummary = (cls: AbcClass): AbcClassSummaryDTO => {
    const list = abcItems.filter((i) => i.abcClass === cls);
    const total = round2(list.reduce((s, i) => s + i.totalCommercialPrice, 0));
    return {
      itemsCount: list.length,
      totalCommercialPrice: total,
      sharePercent: grandTotal > 0 ? round2((total / grandTotal) * 100) : 0,
    };
  };

  return {
    items: abcItems,
    summaryByClass: {
      A: makeSummary("A"),
      B: makeSummary("B"),
      C: makeSummary("C"),
    },
  };
}

export function buildExecutiveReportPayload(input: {
  audience: ReportAudience;
  projectName: string;
  clientName: string;
  latestBaselineLabel?: string | null;
  tree: ReturnType<typeof buildEapTreePayload>;
  analytics: ReturnType<typeof computeScheduleAnalytics>;
  packages: Array<{
    waveName: string;
    segments: Array<{ startDate: string; endDate: string; workingDays: number }>;
    procurementGates: Array<{
      id: string;
      title: string;
      triggerDate: string;
      leadTimeDays: number;
      status: string;
    }>;
  }>;
  technicalSheets: ExecutiveAcervoSheetDTO[];
  galleryImages: ExecutiveGalleryImageDTO[];
}): ExecutiveReportPayload {
  const isInternal = input.audience === "INTERNAL";
  const { tree, analytics } = input;

  const stages: ExecutiveReportStageDTO[] = tree.stages.map((st) => {
    const flatItems = st.groups.flatMap((g) => g.items);
    const mappedItems: ExecutiveReportItemDTO[] = flatItems.map((it) => {
      const base: ExecutiveReportItemDTO = {
        id: it.id,
        code: it.code,
        description: it.description,
        unit: it.unit,
        totalQtyWithLoss: it.totalQtyWithLoss,
        zoneQuantities: it.zoneQuantities,
        unitCommercialPrice: it.unitCommercialPrice,
        totalCommercialPrice: it.totalCommercialPrice,
        weightPercent: it.weightPercent,
      };
      if (isInternal) {
        base.materialUnitCost = it.materialUnitCost;
        base.laborUnitCost = it.laborUnitCost;
        base.thirdPartyUnitCost = it.thirdPartyUnitCost;
        base.unitDirectCost = it.unitDirectCost;
        base.totalDirectCost = it.totalDirectCost;
        base.markupMultiplier = it.markupMultiplier;
      }
      return base;
    });

    const stageDto: ExecutiveReportStageDTO = {
      code: st.code,
      name: st.name,
      itemsCount: st.itemsCount,
      totalCommercialPrice: st.totalCommercialPrice,
      weightPercent: st.weightPercent,
      items: mappedItems,
    };
    if (isInternal) {
      stageDto.totalDirectCost = st.totalDirectCost;
    }
    return stageDto;
  });

  const allFlatItems = tree.stages.flatMap((s) => s.groups.flatMap((g) => g.items));
  const abcCurve = computeAbcCurve(allFlatItems);

  // Agrupamento de ondas do cronograma
  const waveMap = new Map<
    string,
    { packagesCount: number; starts: string[]; ends: string[]; totalWorkingDays: number }
  >();
  for (const pkg of input.packages) {
    const curr = waveMap.get(pkg.waveName) || {
      packagesCount: 0,
      starts: [],
      ends: [],
      totalWorkingDays: 0,
    };
    curr.packagesCount += 1;
    for (const s of pkg.segments) {
      curr.starts.push(s.startDate);
      curr.ends.push(s.endDate);
      curr.totalWorkingDays += s.workingDays;
    }
    waveMap.set(pkg.waveName, curr);
  }

  const waves: ExecutiveWaveSummaryDTO[] = [...waveMap.entries()].map(([waveName, v]) => ({
    waveName,
    packagesCount: v.packagesCount,
    startDate: v.starts.length > 0 ? v.starts.sort()[0] : null,
    endDate: v.ends.length > 0 ? v.ends.sort()[v.ends.length - 1] : null,
    totalWorkingDays: v.totalWorkingDays,
  }));

  const procurementMilestones = input.packages
    .flatMap((p) => p.procurementGates)
    .sort((a, b) => a.triggerDate.localeCompare(b.triggerDate))
    .slice(0, 12);

  const meta: ExecutiveReportPayload["meta"] = {
    projectId: tree.projectId,
    projectName: input.projectName,
    clientName: input.clientName,
    cityLabel: tree.cityLabel,
    builtAreaM2: tree.builtAreaM2,
    status: tree.status,
    baselineLabel: input.latestBaselineLabel || `Rascunho r${tree.currentRevision}`,
    startDate: analytics.startDate,
    endDate: analytics.endDate,
    totalMonths: analytics.totalMonths,
    totalWorkingDays: analytics.totalWorkingDays,
    isPublishedToClient: PUBLISHED_STATUSES.has(tree.status),
  };
  if (isInternal) {
    meta.bdiPercent = tree.bdiPercent;
  }

  const kpis: ExecutiveReportPayload["kpis"] = {
    totalCommercialPrice: tree.indicators.totalCommercialPrice,
    costPerM2: tree.indicators.costPerM2,
    materialSharePercent: tree.indicators.materialSharePercent,
    laborSharePercent: tree.indicators.laborSharePercent,
    thirdPartySharePercent: tree.indicators.thirdPartySharePercent,
    steelRateKgPerM3: tree.indicators.steelRateKgPerM3,
    concreteM3PerM2: tree.indicators.concreteM3PerM2,
    masonryM2PerM2: tree.indicators.masonryM2PerM2,
  };
  if (isInternal) {
    kpis.totalDirectCost = tree.indicators.totalDirectCost;
    kpis.directCostPerM2 = tree.indicators.directCostPerM2;
  }

  return {
    audience: input.audience,
    meta,
    kpis,
    stages,
    abcCurve,
    schedule: {
      waves,
      monthlySeries: analytics.monthlySeries,
      procurementMilestones,
    },
    acervoVisuals: {
      technicalSheets: input.technicalSheets,
      galleryImages: input.galleryImages,
    },
    premises: tree.premises,
    exclusions: tree.exclusions,
  };
}

export async function loadExecutiveReportFromDb(
  projectId: string,
  audience: ReportAudience
): Promise<ExecutiveReportPayload | null> {
  const [project, eap, acervoDocs, deliverables] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
    prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        city: { include: { holidays: true } },
        zones: { orderBy: { orderIndex: "asc" } },
        conflictLogs: { select: { id: true, status: true } },
        baselineSnapshots: { orderBy: { approvedAt: "desc" }, take: 1 },
        stages: {
          orderBy: { orderIndex: "asc" },
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              include: { items: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        schedulePackages: {
          orderBy: { orderIndex: "asc" },
          include: {
            segments: { orderBy: { segmentOrder: "asc" } },
            procurementGates: { orderBy: { triggerDate: "asc" } },
          },
        },
      },
    }),
    prisma.acervoDocument.findMany({
      where: { projectId, isArchived: false },
      orderBy: [{ discipline: "asc" }, { code: "asc" }],
      take: 24,
      select: {
        id: true,
        code: true,
        title: true,
        discipline: true,
        revisions: {
          where: { isCurrent: true },
          take: 1,
          select: { revisionNumber: true, status: true, fileUrl: true, fileName: true },
        },
      },
    }),
    prisma.projectDeliverable.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, discipline: true, fileUrl: true, version: true, category: true },
    }),
  ]);

  if (!project || !eap) return null;

  const tree = buildEapTreePayload({
    id: eap.id,
    projectId: eap.projectId,
    cityId: eap.cityId,
    cityLabel: `${eap.city.name}/${eap.city.state}`,
    title: eap.title,
    builtAreaM2: eap.builtAreaM2,
    bdiPercent: eap.bdiPercent,
    plannedStartDate: eap.plannedStartDate,
    status: eap.status,
    currentRevision: eap.currentRevision,
    premisesJson: eap.premisesJson,
    exclusionsJson: eap.exclusionsJson,
    zones: eap.zones,
    stages: eap.stages,
    conflicts: eap.conflictLogs,
  });

  const packages = eap.schedulePackages.map((p) => ({
    packageNumber: p.packageNumber,
    waveName: p.waveName,
    linkedStageCodes: Array.isArray(p.linkedStageCodesJson)
      ? p.linkedStageCodesJson.map(String)
      : [],
    teamsCount: p.teamsCount,
    segments: p.segments.map((s) => ({
      startDate: s.startDate.toISOString().slice(0, 10),
      endDate: s.endDate.toISOString().slice(0, 10),
      workingDays: s.workingDays,
    })),
    procurementGates: p.procurementGates.map((g) => ({
      id: g.id,
      title: g.title,
      triggerDate: g.triggerDate.toISOString().slice(0, 10),
      leadTimeDays: g.leadTimeDays,
      status: g.status,
    })),
  }));

  const analytics = computeScheduleAnalytics({
    packages,
    stageBudgets: tree.stages.map((st) => ({
      stageCode: st.code,
      totalMaterial: st.totalMaterial,
      totalLabor: st.totalLabor,
      totalThirdParty: st.totalThirdParty,
      totalDirectCost: st.totalDirectCost,
      totalCommercialPrice: st.totalCommercialPrice,
    })),
    holidays: eap.city.holidays.map((h) => h.date),
  });

  const technicalSheets: ExecutiveAcervoSheetDTO[] = acervoDocs
    .map((d) => {
      const rev = d.revisions[0];
      if (!rev) return null;
      return {
        id: d.id,
        code: d.code,
        title: d.title,
        discipline: String(d.discipline),
        revisionNumber: rev.revisionNumber,
        status: String(rev.status),
        fileUrl: rev.fileUrl,
        fileName: rev.fileName,
      };
    })
    .filter((x): x is ExecutiveAcervoSheetDTO => x !== null);

  const galleryImages: ExecutiveGalleryImageDTO[] = deliverables
    .filter(
      (d) =>
        d.category === "IMAGEM_RENDER" ||
        /\.(png|jpe?g|webp)$/i.test(d.fileUrl || "")
    )
    .map((d) => ({
      id: d.id,
      title: d.title,
      discipline: String(d.discipline),
      fileUrl: d.fileUrl,
      version: d.version,
    }));

  return buildExecutiveReportPayload({
    audience,
    projectName: project.name,
    clientName: project.client?.name || "Cliente",
    latestBaselineLabel: eap.baselineSnapshots[0]?.versionLabel ?? null,
    tree,
    analytics,
    packages,
    technicalSheets,
    galleryImages,
  });
}

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Gera PDF corporativo determinístico (%PDF-1.4) sem dependências nativas (100% Vercel Serverless).
 */
export function renderExecutiveReportPdf(payload: ExecutiveReportPayload): Uint8Array {
  const pdf = new PdfWriter({
    title: `Relatorio Executivo EAP - ${payload.meta.projectName}`,
    author: "ArqVertice Studio",
    subject: `EAP, Orcamento Regional e Cronograma (${payload.meta.baselineLabel})`,
  });

  // 1. CAPA CORPORATIVA
  pdf.rect(0, 0, pdf.width, 130, { fill: "0.09 0.09 0.11" });
  pdf.drawText("ARQVERTICE STUDIO", pdf.margin, 46, { size: 11, bold: true, color: "0.93 0.90 0.85" });
  pdf.drawText("DOSSIE EXECUTIVO — EAP, ORCAMENTO & CRONOGRAMA", pdf.margin, 72, {
    size: 16,
    bold: true,
    color: "1 1 1",
  });
  pdf.drawText(`${payload.meta.projectName} · Cliente: ${payload.meta.clientName}`, pdf.margin, 98, {
    size: 11,
    color: "0.85 0.87 0.90",
  });
  pdf.drawText(
    `Praca: ${payload.meta.cityLabel} · Area: ${payload.meta.builtAreaM2} m2 · Baseline: ${payload.meta.baselineLabel}`,
    pdf.margin,
    116,
    { size: 9, color: "0.75 0.78 0.82" }
  );

  pdf.y = 152;

  // 2. RESUMO EXECUTIVO & KPIs
  pdf.flowText("1. RESUMO EXECUTIVO & INDICADORES DE ENGENHARIA", { size: 12, bold: true, gapAfter: 8 });
  pdf.flowText(
    `Investimento Comercial Total: ${fmtBRL(payload.kpis.totalCommercialPrice)}  |  Custo/m2: ${fmtBRL(payload.kpis.costPerM2)}/m2`,
    { size: 10, bold: true, gapAfter: 4 }
  );
  if (payload.audience === "INTERNAL" && payload.kpis.totalDirectCost !== undefined) {
    pdf.flowText(
      `[Interno] Custo Direto: ${fmtBRL(payload.kpis.totalDirectCost)}  |  BDI: ${payload.meta.bdiPercent ?? 0}%`,
      { size: 9, gapAfter: 4 }
    );
  }
  pdf.flowText(
    `Prazo Previsto: ${payload.meta.startDate || "A definir"} a ${payload.meta.endDate || "A definir"} (${payload.meta.totalMonths} meses / ${payload.meta.totalWorkingDays} dias uteis)`,
    { size: 9, gapAfter: 4 }
  );
  pdf.flowText(
    `Composicao: Material ${payload.kpis.materialSharePercent}% · Mao de Obra ${payload.kpis.laborSharePercent}% · Terceiros ${payload.kpis.thirdPartySharePercent}%`,
    { size: 9, gapAfter: 4 }
  );
  pdf.flowText(
    `Engenharia: Taxa de Aco ${payload.kpis.steelRateKgPerM3} kg/m3 · Concreto ${payload.kpis.concreteM3PerM2} m3/m2 · Alvenaria ${payload.kpis.masonryM2PerM2} m2/m2`,
    { size: 9, gapAfter: 12 }
  );

  // 3. MACRO-ETAPAS DA EAP (26 ETAPAS)
  pdf.flowText("2. ORCAMENTO CONSOLIDADO POR MACRO-ETAPA (26 ETAPAS EAP)", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });
  for (const st of payload.stages) {
    if (st.totalCommercialPrice <= 0 && st.itemsCount === 0) continue;
    pdf.flowText(
      `${st.code} - ${st.name}: ${fmtBRL(st.totalCommercialPrice)} (${st.weightPercent.toFixed(1)}%)`,
      { size: 9, gapAfter: 2 }
    );
  }

  pdf.y += 8;

  // 4. CURVA ABC — CLASSE A (80/20)
  pdf.flowText(
    `3. CURVA ABC — CLASSE A (${payload.abcCurve.summaryByClass.A.itemsCount} itens · ${payload.abcCurve.summaryByClass.A.sharePercent}% do investimento)`,
    { size: 12, bold: true, gapAfter: 6 }
  );
  for (const item of payload.abcCurve.items.filter((i) => i.abcClass === "A").slice(0, 15)) {
    pdf.flowText(
      `[A] ${item.description} (${item.quantity.toFixed(2)} ${item.unit}) — ${fmtBRL(item.totalCommercialPrice)} (${item.sharePercent}% | Acum. ${item.cumulativePercent}%)`,
      { size: 8.5, gapAfter: 2 }
    );
  }

  pdf.y += 8;

  // 5. CRONOGRAMA & DESEMBOLSO MENSAL
  pdf.flowText("4. CRONOGRAMA FISICO-FINANCEIRO & DESEMBOLSO MENSAL", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });
  for (const m of payload.schedule.monthlySeries) {
    pdf.flowText(
      `${m.label}: ${fmtBRL(m.commercialCost)} (Acumulado: ${fmtBRL(m.cumulativeCommercialCost)} · Curva S: ${m.cumulativePhysicalPercent.toFixed(1)}%)`,
      { size: 8.5, gapAfter: 2 }
    );
  }

  pdf.y += 8;

  // 6. PLANTAS DE REFERÊNCIA & PREMISSAS/EXCLUSÕES
  pdf.flowText("5. PLANTAS TECNICAS (ACERVO MANAGER) & PREMISSAS / EXCLUSOES", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });
  for (const sheet of payload.acervoVisuals.technicalSheets.slice(0, 12)) {
    pdf.flowText(
      `• ${sheet.code} (${sheet.discipline} · ${sheet.revisionNumber} · ${sheet.status}) — ${sheet.title}`,
      { size: 8.5, gapAfter: 2 }
    );
  }
  if (payload.premises.length > 0) {
    pdf.y += 4;
    pdf.flowText("Premissas Tecnicas:", { size: 9.5, bold: true, gapAfter: 3 });
    for (const p of payload.premises) {
      pdf.flowText(`- ${p}`, { size: 8.5, indent: 8, gapAfter: 2 });
    }
  }
  if (payload.exclusions.length > 0) {
    pdf.y += 4;
    pdf.flowText("Itens Nao Inclusos na Proposta:", { size: 9.5, bold: true, gapAfter: 3 });
    for (const e of payload.exclusions) {
      pdf.flowText(`- ${e}`, { size: 8.5, indent: 8, gapAfter: 2 });
    }
  }

  pdf.stampFooters(`ArqVertice Flow · ${payload.meta.projectName} · ${payload.meta.baselineLabel}`);
  return pdf.build();
}
