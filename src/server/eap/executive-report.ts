import { prisma } from "@/server/db";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import { round2 } from "./calculator";
import { buildEapTreePayload, type ComputedEapItemDTO } from "./workbench";
import { computeScheduleAnalytics, type MonthlyCashflowPoint } from "./scheduler";
import {
  buildComparativeProjectAnalytics,
  type ComparativeProjectAnalytics,
} from "./executive-analytics-ai";

export type ReportAudience = "INTERNAL" | "CLIENT";
export type AbcClass = "A" | "B" | "C";
export type ExecutiveStandardLevel = "ECONOMICO" | "MEDIO" | "ALTO";

export interface ExecutiveParametricOverrides {
  builtAreaM2?: number;
  standardLevel?: ExecutiveStandardLevel;
  bdiPercent?: number;
  durationMonths?: number;
}

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
  progressPercent?: number;
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
    isParametricFallback?: boolean;
    parametricStandard?: ExecutiveStandardLevel;
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
    embodiedCarbonKgCo2?: number;
    actualPhysicalPercent?: number;
    plannedPhysicalPercent?: number;
    spi?: number;
    cpi?: number;
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
  comparativeAnalytics?: ComparativeProjectAnalytics | null;
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
    segments: Array<{ startDate: string; endDate: string; workingDays: number; progressPercent?: number }>;
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
  embodiedCarbonKgCo2?: number;
  executionSummary?: {
    actualPhysicalPercent: number;
    plannedPhysicalPercent: number;
    spi: number;
    cpi: number;
  } | null;
  comparativeAnalytics?: ComparativeProjectAnalytics | null;
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
    {
      packagesCount: number;
      starts: string[];
      ends: string[];
      totalWorkingDays: number;
      weightedProgress: number;
    }
  >();
  for (const pkg of input.packages) {
    const curr = waveMap.get(pkg.waveName) || {
      packagesCount: 0,
      starts: [],
      ends: [],
      totalWorkingDays: 0,
      weightedProgress: 0,
    };
    curr.packagesCount += 1;
    for (const s of pkg.segments) {
      curr.starts.push(s.startDate);
      curr.ends.push(s.endDate);
      curr.totalWorkingDays += s.workingDays;
      curr.weightedProgress += s.workingDays * (s.progressPercent ?? 0);
    }
    waveMap.set(pkg.waveName, curr);
  }

  const waves: ExecutiveWaveSummaryDTO[] = [...waveMap.entries()].map(([waveName, v]) => ({
    waveName,
    packagesCount: v.packagesCount,
    startDate: v.starts.length > 0 ? v.starts.sort()[0] : null,
    endDate: v.ends.length > 0 ? v.ends.sort()[v.ends.length - 1] : null,
    totalWorkingDays: v.totalWorkingDays,
    progressPercent:
      v.totalWorkingDays > 0 ? round2(v.weightedProgress / v.totalWorkingDays) : 0,
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
    embodiedCarbonKgCo2:
      typeof input.embodiedCarbonKgCo2 === "number" ? round2(input.embodiedCarbonKgCo2) : undefined,
    actualPhysicalPercent: input.executionSummary?.actualPhysicalPercent,
    plannedPhysicalPercent: input.executionSummary?.plannedPhysicalPercent,
    spi: input.executionSummary?.spi,
    cpi: input.executionSummary?.cpi,
  };
  if (isInternal) {
    kpis.totalDirectCost = tree.indicators.totalDirectCost;
    kpis.directCostPerM2 = tree.indicators.directCostPerM2;
  }

  const safeMonthlySeries = isInternal
    ? analytics.monthlySeries
    : analytics.monthlySeries.map((pt) => {
      const directSum = pt.materialCost + pt.laborCost + pt.thirdPartyCost;
      const factor = directSum > 0 ? pt.commercialCost / directSum : 0;
      return {
        ...pt,
        directCost: 0,
        materialCost: round2(pt.materialCost * factor),
        laborCost: round2(pt.laborCost * factor),
        thirdPartyCost: round2(pt.thirdPartyCost * factor),
      };
    });

  const safeComparativeAnalytics: ComparativeProjectAnalytics | null = input.comparativeAnalytics
    ? isInternal
      ? input.comparativeAnalytics
      : {
        ...input.comparativeAnalytics,
        shortTerm: {
          ...input.comparativeAnalytics.shortTerm,
          teamUtilization: input.comparativeAnalytics.shortTerm.teamUtilization.map(
            ({ dailyCost: _d, totalEstimatedCost: _t, ...rest }) => rest
          ),
        },
        activeVersions: input.comparativeAnalytics.activeVersions.map((v) => ({
          discipline: v.discipline,
          fileName: "",
          versionCode: v.versionCode,
        })),
        bulletinsSummary: input.comparativeAnalytics.bulletinsSummary.filter(
          (b) => b.status === "APROVADO"
        ),
        aiSummary: {
          ...input.comparativeAnalytics.aiSummary,
          topBottlenecks: input.comparativeAnalytics.aiSummary.topBottlenecks.map((b) =>
            b.axis === "SUPRIMENTOS" || b.axis === "EQUIPES"
              ? {
                ...b,
                impact: "Ponto monitorado pela engenharia do ArqVértice OS.",
              }
              : b
          ),
        },
      }
    : null;

  return {
    audience: input.audience,
    meta,
    kpis,
    stages,
    abcCurve,
    schedule: {
      waves,
      monthlySeries: safeMonthlySeries,
      procurementMilestones,
    },
    acervoVisuals: {
      technicalSheets: input.technicalSheets,
      galleryImages: input.galleryImages,
    },
    premises: tree.premises,
    exclusions: tree.exclusions,
    comparativeAnalytics: safeComparativeAnalytics,
  };
}

const STANDARD_COST_PER_M2_CE: Record<ExecutiveStandardLevel, number> = {
  ECONOMICO: 2350,
  MEDIO: 3150,
  ALTO: 4450,
};

/**
 * Gera um Cenário Baseline Inteligente (Paramétrico Regional Fortaleza-CE) quando EAP, LOB
 * ou Medições ainda não possuem quantitativos lançados — mantendo cálculos proporcionais
 * e editáveis por Área (m²), Padrão Construtivo, BDI (%) e Prazo (meses).
 */
export function buildParametricExecutiveFallback(input: {
  basePayload: ExecutiveReportPayload;
  overrides?: ExecutiveParametricOverrides;
}): ExecutiveReportPayload {
  const { basePayload, overrides } = input;
  const area =
    overrides?.builtAreaM2 && overrides.builtAreaM2 > 0
      ? overrides.builtAreaM2
      : basePayload.meta.builtAreaM2 > 0
        ? basePayload.meta.builtAreaM2
        : 180;
  const standard: ExecutiveStandardLevel = overrides?.standardLevel ?? "MEDIO";
  const bdi =
    typeof overrides?.bdiPercent === "number" && overrides.bdiPercent >= 0
      ? overrides.bdiPercent
      : typeof basePayload.meta.bdiPercent === "number"
        ? basePayload.meta.bdiPercent
        : 22;
  const months =
    overrides?.durationMonths && overrides.durationMonths > 0
      ? Math.max(2, Math.min(36, Math.round(overrides.durationMonths)))
      : Math.max(4, Math.min(24, Math.round(area / 28)));

  const directCostPerM2 = STANDARD_COST_PER_M2_CE[standard];
  const markup = 1 + bdi / 100;
  const totalDirectCost = round2(area * directCostPerM2);
  const totalCommercialPrice = round2(totalDirectCost * markup);
  const commercialCostPerM2 = round2(totalCommercialPrice / area);
  const isInternal = basePayload.audience === "INTERNAL";

  const macroWeights: Array<{
    code: string;
    name: string;
    weightPct: number;
    unit: string;
    qtyFactor: number;
  }> = [
    { code: "01", name: "Serviços Preliminares & Canteiro", weightPct: 5, unit: "vb", qtyFactor: 1 },
    { code: "03", name: "Infraestrutura & Fundações", weightPct: 14, unit: "m²", qtyFactor: 0.45 },
    { code: "04", name: "Supraestrutura (Concreto, Aço & Fôrmas)", weightPct: 24, unit: "m²", qtyFactor: 1.0 },
    { code: "05", name: "Alvenaria, Vedações & Drywall", weightPct: 12, unit: "m²", qtyFactor: 1.55 },
    { code: "08", name: "Instalações Elétricas & Automação", weightPct: 11, unit: "pt", qtyFactor: 0.42 },
    { code: "09", name: "Instalações Hidrossanitárias & Drenagem", weightPct: 10, unit: "pt", qtyFactor: 0.28 },
    { code: "11", name: "Coberta & Impermeabilização", weightPct: 8, unit: "m²", qtyFactor: 0.58 },
    { code: "13", name: "Revestimentos, Esquadrias & Pintura", weightPct: 16, unit: "m²", qtyFactor: 1.85 },
  ];

  const stages: ExecutiveReportStageDTO[] = macroWeights.map((mw) => {
    const stageCommercial = round2((totalCommercialPrice * mw.weightPct) / 100);
    const stageDirect = round2((totalDirectCost * mw.weightPct) / 100);
    const qty = mw.unit === "vb" ? 1 : round2(area * mw.qtyFactor);
    const unitCommercial = round2(stageCommercial / Math.max(1, qty));
    const unitDirect = round2(stageDirect / Math.max(1, qty));

    const item: ExecutiveReportItemDTO = {
      id: `param-${mw.code}`,
      code: `PARAM-${mw.code}`,
      description: `${mw.name} (Estimativa Paramétrica Fortaleza-CE)`,
      unit: mw.unit,
      totalQtyWithLoss: qty,
      zoneQuantities: {
        FUND_TERREO: round2(qty * 0.45),
        PAV_SUPERIOR: round2(qty * 0.35),
        COBERTURA: round2(qty * 0.12),
        EXTERNO: round2(qty * 0.08),
      },
      unitCommercialPrice: unitCommercial,
      totalCommercialPrice: stageCommercial,
      weightPercent: mw.weightPct,
      ...(isInternal
        ? {
            materialUnitCost: round2(unitDirect * 0.58),
            laborUnitCost: round2(unitDirect * 0.32),
            thirdPartyUnitCost: round2(unitDirect * 0.1),
            unitDirectCost: unitDirect,
            totalDirectCost: stageDirect,
            markupMultiplier: round2(markup),
          }
        : {}),
    };

    return {
      code: mw.code,
      name: mw.name,
      itemsCount: 1,
      totalCommercialPrice: stageCommercial,
      weightPercent: mw.weightPct,
      ...(isInternal ? { totalDirectCost: stageDirect } : {}),
      items: [item],
    };
  });

  const abcCurve = computeAbcCurve(
    stages.flatMap((st) =>
      st.items.map((it) => ({
        id: it.id,
        code: it.code,
        stageCode: st.code,
        description: it.description,
        unit: it.unit,
        totalQtyWithLoss: it.totalQtyWithLoss,
        totalCommercialPrice: it.totalCommercialPrice,
      }))
    )
  );

  // Série mensal S-curve realista em bell-curve suave ao longo de `months`
  const baseDate = new Date();
  const startYear = baseDate.getUTCFullYear();
  const startMonth = baseDate.getUTCMonth();
  const rawWeights = Array.from({ length: months }, (_, i) => {
    const x = (i + 0.5) / months;
    return Math.sin(Math.PI * x) + 0.25;
  });
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);
  let cumulativeCommercialCost = 0;
  let cumulativePhysicalPercent = 0;
  const monthlySeries: MonthlyCashflowPoint[] = rawWeights.map((w, idx) => {
    const ratio = w / weightSum;
    const isLast = idx === months - 1;
    const mDirect = round2(totalDirectCost * ratio);
    const mCommercial = isLast
      ? round2(totalCommercialPrice - cumulativeCommercialCost)
      : round2(totalCommercialPrice * ratio);
    cumulativeCommercialCost = round2(cumulativeCommercialCost + mCommercial);
    const periodPct = isLast
      ? round2(100 - cumulativePhysicalPercent)
      : round2(ratio * 100);
    cumulativePhysicalPercent = isLast
      ? 100
      : round2(cumulativePhysicalPercent + periodPct);
    const d = new Date(Date.UTC(startYear, startMonth + idx, 1));
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
    return {
      monthKey: ym,
      label,
      materialCost: round2(mDirect * 0.58),
      laborCost: round2(mDirect * 0.32),
      thirdPartyCost: round2(mDirect * 0.1),
      directCost: mDirect,
      commercialCost: mCommercial,
      cumulativeCommercialCost,
      physicalPercentPeriod: periodPct,
      cumulativePhysicalPercent,
      cumulativeFinancialPercent:
        totalCommercialPrice > 0
          ? round2((cumulativeCommercialCost / totalCommercialPrice) * 100)
          : 0,
    };
  });

  const startIso = new Date(Date.UTC(startYear, startMonth, 1)).toISOString().slice(0, 10);
  const endIso = new Date(Date.UTC(startYear, startMonth + months, 0)).toISOString().slice(0, 10);
  const totalWorkingDays = months * 22;

  const waves: ExecutiveWaveSummaryDTO[] =
    basePayload.schedule.waves.length > 0
      ? basePayload.schedule.waves
      : [
          {
            waveName: "Equipe A · Infraestrutura & Estrutura",
            packagesCount: 4,
            startDate: startIso,
            endDate: endIso,
            totalWorkingDays: Math.round(totalWorkingDays * 0.45),
            progressPercent: 0,
          },
          {
            waveName: "Equipe B · Alvenaria & Instalações",
            packagesCount: 4,
            startDate: startIso,
            endDate: endIso,
            totalWorkingDays: Math.round(totalWorkingDays * 0.4),
            progressPercent: 0,
          },
          {
            waveName: "Equipe C · Coberta & Acabamentos",
            packagesCount: 4,
            startDate: startIso,
            endDate: endIso,
            totalWorkingDays: Math.round(totalWorkingDays * 0.35),
            progressPercent: 0,
          },
        ];

  const headline = `Cenário Paramétrico Fortaleza-CE (${standard} · ${area} m²) — ${fmtBRL(totalCommercialPrice)} em ${months} meses`;
  const overview = `Orçamento baseline gerado automaticamente pelo motor paramétrico regional para ${area} m² no padrão ${standard} (BDI ${bdi}%). As etapas de Supraestrutura (24%) e Revestimentos (16%) concentram 40% do investimento previsto, com equipes A, B e C distribuídas em ${months} meses (${totalWorkingDays} dias úteis).`;
  const actionPlan = [
    "Validar parâmetros regionais (área, padrão e BDI) no painel superior ou importar PDFs TQS/Revit na Etapa 1.",
    "Confirmar sequência de equipes A, B e C na Matriz LOB (Etapa 3) e travar compras críticas no Lookahead.",
    "Iniciar apontamento semanal na Medição no Canteiro (Etapa 4) para gerar o Boletim BM-01.",
  ];

  const comparativeAnalytics: ComparativeProjectAnalytics = basePayload.comparativeAnalytics
    ? {
        ...basePayload.comparativeAnalytics,
        financial: {
          ...basePayload.comparativeAnalytics.financial,
          budgetedEapTotal: totalCommercialPrice,
          plannedLobCumulative: round2(totalCommercialPrice * 0.12),
          eacCostProjection: totalCommercialPrice,
        },
        monthlyComparative:
          basePayload.comparativeAnalytics.monthlyComparative.length > 0
            ? basePayload.comparativeAnalytics.monthlyComparative
            : monthlySeries.slice(0, 6).map((m) => ({
                monthKey: m.monthKey,
                label: m.label,
                plannedCumulative: m.cumulativeCommercialCost,
                measuredCumulative: 0,
                billedCumulative: 0,
              })),
        aiSummary: {
          ...basePayload.comparativeAnalytics.aiSummary,
          source: "DETERMINISTIC",
          headline,
          executiveOverview: overview,
          actionPlan,
        },
      }
    : {
        referenceDate: new Date().toISOString().slice(0, 10),
        financial: {
          budgetedEapTotal: totalCommercialPrice,
          plannedLobCumulative: round2(totalCommercialPrice * 0.12),
          measuredFieldCumulative: 0,
          billedInstallmentsTotal: 0,
          receivedInstallmentsTotal: 0,
          cashBalanceBilledMinusMeasured: 0,
          physicalProgressPct: 0,
          plannedLobPct: 0,
          physicalDeviationPct: 0,
          spi: 1,
          cpi: 1,
          eacCostProjection: totalCommercialPrice,
        },
        shortTerm: {
          windowDays: 15,
          upcomingPackagesCount: 0,
          criticalConstraintsCount: 0,
          attentionConstraintsCount: 0,
          recentBulletinsCount: 0,
          teamUtilization: [],
        },
        monthlyComparative: monthlySeries.slice(0, 6).map((m) => ({
          monthKey: m.monthKey,
          label: m.label,
          plannedCumulative: m.cumulativeCommercialCost,
          measuredCumulative: 0,
          billedCumulative: 0,
        })),
        floorComparison: [],
        activeVersions: [],
        bulletinsSummary: [],
        aiSummary: {
          healthStatus: "SAUDAVEL",
          source: "DETERMINISTIC",
          generatedAt: new Date().toISOString(),
          headline,
          executiveOverview: overview,
          topBottlenecks: [],
          actionPlan,
        },
      };

  return {
    ...basePayload,
    meta: {
      ...basePayload.meta,
      builtAreaM2: area,
      ...(isInternal ? { bdiPercent: bdi } : {}),
      baselineLabel: `Estimativa Paramétrica IA · ${standard} (${area} m²)`,
      startDate: startIso,
      endDate: endIso,
      totalMonths: months,
      totalWorkingDays,
      isParametricFallback: true,
      parametricStandard: standard,
    },
    kpis: {
      ...basePayload.kpis,
      totalCommercialPrice,
      costPerM2: commercialCostPerM2,
      ...(isInternal
        ? {
            totalDirectCost,
            directCostPerM2: directCostPerM2,
          }
        : {}),
      materialSharePercent: 58,
      laborSharePercent: 32,
      thirdPartySharePercent: 10,
      steelRateKgPerM3: standard === "ALTO" ? 95 : standard === "MEDIO" ? 85 : 75,
      concreteM3PerM2: standard === "ALTO" ? 0.34 : standard === "MEDIO" ? 0.28 : 0.23,
      masonryM2PerM2: 1.55,
    },
    stages,
    abcCurve,
    schedule: {
      ...basePayload.schedule,
      waves,
      monthlySeries,
    },
    comparativeAnalytics,
  };
}

export async function loadExecutiveReportFromDb(
  projectId: string,
  audience: ReportAudience,
  overrides?: ExecutiveParametricOverrides
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
        sourceFiles: {
          where: { includedInMining: true },
          select: { extractedSummaryJson: true },
        },
        measurements: {
          orderBy: { referenceDate: "desc" },
          select: {
            physicalProgressPercent: true,
            realizedMaterialCost: true,
            realizedLaborCost: true,
            realizedThirdPartyCost: true,
          },
        },
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
          where: {
            isCurrent: true,
            ...(audience === "CLIENT" ? { status: "BOM_PARA_OBRA" } : {}),
          },
          take: 1,
          select: { revisionNumber: true, status: true, fileUrl: true, fileName: true },
        },
      },
    }),
    prisma.projectDeliverable.findMany({
      where: {
        projectId,
        ...(audience === "CLIENT" ? { isClientView: true } : {}),
      },
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
      progressPercent: s.progressPercent,
    })),
    procurementGates: p.procurementGates.map((g) => ({
      id: g.id,
      title: g.title,
      triggerDate: g.triggerDate.toISOString().slice(0, 10),
      leadTimeDays: g.leadTimeDays,
      status: g.status,
    })),
  }));

  const embodiedCarbonKgCo2 = round2(
    eap.sourceFiles.reduce((acc, sf) => {
      const raw = sf.extractedSummaryJson as { carbonKgCo2?: number | null } | null;
      return acc + (typeof raw?.carbonKgCo2 === "number" ? raw.carbonKgCo2 : 0);
    }, 0)
  );

  const allSegments = eap.schedulePackages.flatMap((p) => p.segments);
  const totalSegDays = allSegments.reduce((s, x) => s + x.workingDays, 0);
  const weightedSegProgress = allSegments.reduce(
    (s, x) => s + x.workingDays * (x.progressPercent || 0),
    0
  );
  const segAvgProgress = totalSegDays > 0 ? round2(weightedSegProgress / totalSegDays) : 0;
  const actualPhysicalPercent =
    eap.measurements[0]?.physicalProgressPercent ?? segAvgProgress;

  const todayMs = Date.now();
  const plannedSegDaysElapsed = allSegments.reduce((acc, s) => {
    const startMs = s.startDate.getTime();
    const endMs = s.endDate.getTime();
    if (todayMs <= startMs) return acc;
    if (todayMs >= endMs) return acc + s.workingDays;
    const ratio = (todayMs - startMs) / Math.max(86_400_000, endMs - startMs);
    return acc + s.workingDays * ratio;
  }, 0);
  const plannedPhysicalPercent =
    totalSegDays > 0 ? round2(Math.min(100, (plannedSegDaysElapsed / totalSegDays) * 100)) : 0;
  const realizedCostTotal = eap.measurements.reduce(
    (acc, m) =>
      acc +
      (m.realizedMaterialCost || 0) +
      (m.realizedLaborCost || 0) +
      (m.realizedThirdPartyCost || 0),
    0
  );
  const earnedValue = round2((actualPhysicalPercent / 100) * tree.indicators.totalCommercialPrice);
  const hasExecution =
    eap.status === "EM_EXECUCAO" ||
    eap.status === "CONCLUIDA" ||
    eap.measurements.length > 0 ||
    actualPhysicalPercent > 0;
  const executionSummary = hasExecution
    ? {
      actualPhysicalPercent,
      plannedPhysicalPercent,
      spi:
        plannedPhysicalPercent > 0
          ? round2(actualPhysicalPercent / plannedPhysicalPercent)
          : actualPhysicalPercent > 0
            ? 1
            : 0,
      cpi: realizedCostTotal > 0 ? round2(earnedValue / realizedCostTotal) : 0,
    }
    : null;

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

  const comparativeAnalytics = await buildComparativeProjectAnalytics(projectId, {
    allowExternalLlm: false,
  });

  const payload = buildExecutiveReportPayload({
    audience,
    projectName: project.name,
    clientName: project.client?.name || "Cliente",
    latestBaselineLabel: eap.baselineSnapshots[0]?.versionLabel ?? null,
    tree,
    analytics,
    packages,
    technicalSheets,
    galleryImages,
    embodiedCarbonKgCo2,
    executionSummary,
    comparativeAnalytics,
  });

  const hasExplicitOverrides = Boolean(
    overrides &&
      (overrides.builtAreaM2 ||
        overrides.standardLevel ||
        overrides.bdiPercent !== undefined ||
        overrides.durationMonths)
  );

  if (payload.kpis.totalCommercialPrice <= 0 || hasExplicitOverrides) {
    return buildParametricExecutiveFallback({
      basePayload: payload,
      overrides,
    });
  }

  return payload;
}

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Gera PDF corporativo determinístico (%PDF-1.4) com gráficos vetoriais sem dependências nativas (100% Vercel Serverless).
 */
export function renderExecutiveReportPdf(payload: ExecutiveReportPayload): Uint8Array {
  const pdf = new PdfWriter({
    title: `Relatorio Executivo Integral - ${payload.meta.projectName}`,
    author: "ArqVertice OS",
    subject: `ArqVertice OS: EAP, Comparativos, Desvios IA e Cronograma (${payload.meta.baselineLabel})`,
  });

  // 1. CAPA CORPORATIVA ARQVERTICE OS
  pdf.rect(0, 0, pdf.width, 130, { fill: "0.09 0.09 0.11" });
  pdf.drawText("ARQVERTICE OS", pdf.margin, 46, { size: 11, bold: true, color: "0.93 0.90 0.85" });
  pdf.drawText("DOSSIE EXECUTIVO INTEGRAL — EAP, COMPARATIVOS & IA", pdf.margin, 72, {
    size: 15,
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

  const comp = payload.comparativeAnalytics;

  if (comp && comp.activeVersions.length > 0) {
    pdf.flowText(
      `Versoes Vigentes: ${comp.activeVersions.map((v) => `${v.discipline} (${v.versionCode})`).join(" · ")}`,
      { size: 8.5, bold: true, gapAfter: 8 }
    );
  }

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
    `Engenharia: Taxa de Aco ${payload.kpis.steelRateKgPerM3} kg/m3 · Concreto ${payload.kpis.concreteM3PerM2} m3/m2 · Alvenaria ${payload.kpis.masonryM2PerM2} m2/m2${payload.kpis.embodiedCarbonKgCo2 ? ` · Carbono Embutido: ${payload.kpis.embodiedCarbonKgCo2.toFixed(0)} kgCO2` : ""
    }`,
    { size: 9, gapAfter: 8 }
  );

  // 2A. COMPARATIVO CUSTOS x PREVISOES x FATURAMENTO + GRAFICO VETORIAL + DIAGNOSTICO IA
  if (comp) {
    const fin = comp.financial;
    pdf.ensure(155);
    pdf.flowText("1B. COMPARATIVO CUSTOS x PREVISOES x FATURAMENTO", {
      size: 11,
      bold: true,
      gapAfter: 6,
    });
    pdf.flowText(
      `SPI: ${fin.spi.toFixed(2)}  |  CPI: ${fin.cpi.toFixed(2)}  |  Desvio Fisico: ${fin.physicalDeviationPct >= 0 ? "+" : ""}${fin.physicalDeviationPct.toFixed(1)} p.p.  |  Saldo Caixa (Fat.-Med.): ${fmtBRL(fin.cashBalanceBilledMinusMeasured)}`,
      { size: 8.5, bold: true, gapAfter: 6 }
    );

    const compBars: Array<{ label: string; value: number; fill: string }> = [
      { label: "Orcado EAP", value: fin.budgetedEapTotal, fill: "0.15 0.39 0.92" },
      { label: "Previsto LOB", value: fin.plannedLobCumulative, fill: "0.39 0.40 0.95" },
      { label: "Medido Canteiro", value: fin.measuredFieldCumulative, fill: "0.06 0.65 0.45" },
      { label: "Faturado (Parcelas)", value: fin.billedInstallmentsTotal, fill: "0.85 0.47 0.02" },
      { label: "Recebido (Pago)", value: fin.receivedInstallmentsTotal, fill: "0.05 0.50 0.40" },
    ];
    const maxComp = Math.max(...compBars.map((b) => b.value), 1);
    const labelW = 140;
    const valueW = 95;
    const barMaxW = pdf.contentWidth - labelW - valueW - 10;

    for (const bar of compBars) {
      const yRow = pdf.y;
      const ratio = Math.max(0.02, bar.value / maxComp);
      pdf.drawText(bar.label, pdf.margin, yRow + 10, { size: 8, color: "0.15 0.18 0.24" });
      pdf.rect(pdf.margin + labelW, yRow + 2, barMaxW, 10, { fill: "0.93 0.95 0.98" });
      pdf.rect(pdf.margin + labelW, yRow + 2, barMaxW * ratio, 10, { fill: bar.fill });
      pdf.drawText(fmtBRL(bar.value), pdf.margin + pdf.contentWidth, yRow + 10, {
        size: 7.5,
        bold: true,
        align: "right",
        color: "0.09 0.11 0.16",
      });
      pdf.y += 16;
    }
    pdf.y += 8;

    // Diagnostico de Desvios e Gargalos (IA / Deterministico)
    const ai = comp.aiSummary;
    pdf.ensure(90);
    pdf.flowText(
      `1C. RESUMO DE DESVIOS & GARGALOS (SEMAFORO: ${ai.healthStatus})`,
      { size: 11, bold: true, gapAfter: 4 }
    );
    pdf.flowText(ai.headline, { size: 9.5, bold: true, gapAfter: 3 });
    pdf.flowText(ai.executiveOverview, { size: 8.5, gapAfter: 6 });

    for (const b of ai.topBottlenecks.slice(0, 5)) {
      pdf.flowText(
        `• [${b.axis} / ${b.severity}] ${b.title} — Impacto: ${b.impact} | Acao: ${b.action}`,
        { size: 8, indent: 6, gapAfter: 2 }
      );
    }
    if (ai.actionPlan.length > 0) {
      pdf.y += 3;
      pdf.flowText("Plano de Acao Priorizado (Curto Prazo):", { size: 8.5, bold: true, gapAfter: 2 });
      for (const act of ai.actionPlan.slice(0, 4)) {
        pdf.flowText(`- ${act}`, { size: 8, indent: 8, gapAfter: 2 });
      }
    }
    pdf.y += 8;

    // Avanco Fisico por Pavimento (Feito x Pendente)
    if (comp.floorComparison.length > 0) {
      pdf.heading("1D. AVANCO FISICO POR PAVIMENTO (FEITO x PENDENTE)");
      pdf.table({
        columns: [
          { title: "Pavimento", weight: 2.2 },
          { title: "Avanco", weight: 1.5 },
          { title: "Orcado R$", weight: 1.4 },
          { title: "Medido R$", weight: 1.4 },
        ],
        rows: comp.floorComparison.map((f) => [
          f.floorName,
          `${f.progressPct.toFixed(1)}%`,
          fmtBRL(f.plannedAmount),
          fmtBRL(f.measuredAmount),
        ]),
        progressColumn: 1,
        progressValues: comp.floorComparison.map((f) => Math.round(f.progressPct)),
      });
      pdf.y += 8;
    }

    // Equipes A/B/C & Fases
    if (comp.shortTerm.teamUtilization.length > 0) {
      pdf.flowText("1E. ALOCACAO DE EQUIPES (A, B, C...)", { size: 10.5, bold: true, gapAfter: 4 });
      for (const tu of comp.shortTerm.teamUtilization) {
        const costSuffix =
          payload.audience === "INTERNAL" && typeof tu.totalEstimatedCost === "number"
            ? ` · Custo Est. ${fmtBRL(tu.totalEstimatedCost)}`
            : "";
        pdf.flowText(
          `• Equipe ${tu.teamCode} (${tu.name}): ${tu.workingDays} d.u. · ${tu.headcount} trab. · Ocupacao ${tu.occupancyPercent.toFixed(1)}%${costSuffix}`,
          { size: 8.5, gapAfter: 2 }
        );
      }
      pdf.y += 6;
    }

    if (comp.bulletinsSummary.length > 0) {
      pdf.flowText("1F. BOLETINS DE MEDICAO NO CANTEIRO", { size: 10.5, bold: true, gapAfter: 4 });
      for (const bm of comp.bulletinsSummary.slice(0, 8)) {
        pdf.flowText(
          `• ${bm.bulletinCode} (${bm.referenceDate} · ${bm.status}): ${bm.physicalProgressPct.toFixed(1)}% · Medido ${fmtBRL(bm.totalMeasuredValue)}`,
          { size: 8.5, gapAfter: 2 }
        );
      }
      pdf.y += 6;
    }
  } else if (payload.kpis.actualPhysicalPercent !== undefined) {
    pdf.flowText(
      `Andamento Fisico: ${payload.kpis.actualPhysicalPercent.toFixed(1)}% realizado (Prev. ${(payload.kpis.plannedPhysicalPercent ?? 0).toFixed(1)}%) · SPI ${(payload.kpis.spi ?? 0).toFixed(2)} · CPI ${(payload.kpis.cpi ?? 0).toFixed(2)}`,
      { size: 9, bold: true, gapAfter: 12 }
    );
  }

  // Cronograma por Fases (sem termo "Onda")
  if (payload.schedule.waves.length > 0) {
    pdf.flowText("1G. FASES CONSTRUTIVAS DO CRONOGRAMA", { size: 10.5, bold: true, gapAfter: 4 });
    for (const w of payload.schedule.waves) {
      const faseLabel = w.waveName.replace(/Onda/gi, "Fase");
      pdf.flowText(
        `• ${faseLabel} (${w.packagesCount} pct · ${w.totalWorkingDays} d.u.): ${w.startDate || "—"} a ${w.endDate || "—"}`,
        { size: 8.5, gapAfter: 2 }
      );
    }
    pdf.y += 6;
  }

  // 2B. GRAFICO VETORIAL — TOP MACRO-ETAPAS (BARRAS HORIZONTAIS PROPORCIONAIS)
  const topStages = [...payload.stages]
    .filter((s) => s.totalCommercialPrice > 0)
    .sort((a, b) => b.totalCommercialPrice - a.totalCommercialPrice)
    .slice(0, 8);

  if (topStages.length > 0) {
    const rowH = 18;
    const blockH = 26 + topStages.length * rowH;
    pdf.ensure(blockH);
    pdf.flowText("GRAFICO 1 — DISTRIBUICAO POR MACRO-ETAPA (TOP 8)", {
      size: 10.5,
      bold: true,
      gapAfter: 6,
    });
    const maxStageVal = Math.max(...topStages.map((s) => s.totalCommercialPrice), 1);
    const labelW = 165;
    const valueW = 110;
    const barMaxW = pdf.contentWidth - labelW - valueW - 12;

    for (const st of topStages) {
      const yRow = pdf.y;
      const ratio = Math.max(0.02, st.totalCommercialPrice / maxStageVal);
      pdf.drawText(`${st.code} ${st.name.slice(0, 26)}`, pdf.margin, yRow + 10, {
        size: 8,
        color: "0.15 0.18 0.24",
      });
      pdf.rect(pdf.margin + labelW, yRow + 2, barMaxW, 10, { fill: "0.93 0.95 0.98" });
      pdf.rect(pdf.margin + labelW, yRow + 2, barMaxW * ratio, 10, { fill: "0.15 0.39 0.92" });
      pdf.drawText(
        `${fmtBRL(st.totalCommercialPrice)} (${st.weightPercent.toFixed(1)}%)`,
        pdf.margin + pdf.contentWidth,
        yRow + 10,
        { size: 7.5, bold: true, align: "right", color: "0.09 0.11 0.16" }
      );
      pdf.y += rowH;
    }
    pdf.y += 8;
  }

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

  // 5. CRONOGRAMA & DESEMBOLSO MENSAL + GRAFICO VETORIAL (BARRAS VERTICAIS + CURVA S)
  pdf.flowText("4. CRONOGRAMA FISICO-FINANCEIRO & DESEMBOLSO MENSAL", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });

  const chartMonths = payload.schedule.monthlySeries.slice(0, 12);
  if (chartMonths.length > 0) {
    pdf.ensure(145);
    pdf.flowText("GRAFICO 2 — FLUXO DE DESEMBOLSO MENSAL & CURVA S (%)", {
      size: 10,
      bold: true,
      gapAfter: 6,
    });
    const frameY = pdf.y;
    const frameH = 100;
    const plotH = 68;
    pdf.rect(pdf.margin, frameY, pdf.contentWidth, frameH, {
      fill: "0.98 0.99 1.00",
      stroke: "0.84 0.87 0.91",
      lineWidth: 0.5,
    });
    const maxMonthly = Math.max(...chartMonths.map((m) => m.commercialCost), 1);
    const slotW = (pdf.contentWidth - 16) / chartMonths.length;
    const barW = Math.min(24, Math.max(8, slotW * 0.55));
    const baselineY = frameY + 80;

    chartMonths.forEach((m, idx) => {
      const centerX = pdf.margin + 8 + idx * slotW + slotW / 2;
      const barH = Math.max(2, (m.commercialCost / maxMonthly) * plotH);
      const barX = centerX - barW / 2;
      // Barra de desembolso mensal (azul corporativo)
      pdf.rect(barX, baselineY - barH, barW, barH, { fill: "0.15 0.39 0.92" });
      // Indicador Curva S acumulada (barra fina esmeralda ao lado)
      const sCurveH = Math.max(2, (m.cumulativePhysicalPercent / 100) * plotH);
      pdf.rect(barX + barW + 1, baselineY - sCurveH, 3, sCurveH, { fill: "0.06 0.72 0.51" });

      pdf.drawText(`${(m.commercialCost / 1000).toFixed(0)}k`, centerX, baselineY - barH - 3, {
        size: 6.5,
        align: "center",
        color: "0.15 0.18 0.24",
      });
      pdf.drawText(m.label.slice(0, 6), centerX, baselineY + 10, {
        size: 6.5,
        align: "center",
        color: "0.35 0.40 0.48",
      });
    });

    pdf.y = frameY + frameH + 10;
  }

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

  pdf.stampFooters(`ArqVértice OS · ${payload.meta.projectName} · ${payload.meta.baselineLabel}`);
  return pdf.build();
}
