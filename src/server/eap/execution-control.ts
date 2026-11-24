import { prisma } from "@/server/db";
import { PdfWriter } from "@/lib/pdf/pdf-writer";
import { round2 } from "./calculator";
import { buildEapTreePayload } from "./workbench";
import { computeScheduleAnalytics, type MonthlyCashflowPoint } from "./scheduler";

export type StageTrafficLight = "SAUDAVEL" | "ATENCAO" | "ESTOURO";

export interface StageCostEntry {
  stageCode: string;
  material: number;
  labor: number;
  thirdParty: number;
}

export interface SegmentProgressUpdate {
  segmentId: string;
  progressPercent: number;
}

export interface StageExecutionRowDTO {
  code: string;
  name: string;
  budgetedCommercial: number;
  budgetedMaterial: number;
  budgetedLabor: number;
  budgetedThirdParty: number;
  realizedMaterial: number;
  realizedLabor: number;
  realizedThirdParty: number;
  realizedTotal: number;
  physicalProgressPercent: number;
  earnedValue: number;
  varianceAmount: number;
  variancePercent: number;
  consumptionPercent: number;
  cpi: number;
  status: StageTrafficLight;
}

export interface DualSCurvePointDTO {
  monthKey: string;
  label: string;
  plannedPhysicalPct: number;
  realizedPhysicalPct: number | null;
  plannedFinancialAccumulated: number;
  realizedFinancialAccumulated: number | null;
  plannedMonthly: number;
  realizedMonthly: number;
}

export interface ZoneProgressDTO {
  zoneCode: string;
  zoneName: string;
  plannedPercent: number;
  realizedPercent: number;
  segmentsCount: number;
}

export interface BaselineRevisionSummaryDTO {
  id: string;
  versionLabel: string;
  approvedAt: string;
  totalDirectCost: number;
  totalCommercialPrice: number;
  costPerM2: number;
  reason: string | null;
  deltaCommercialAmount: number;
  deltaCommercialPercent: number;
}

export interface MeasurementSummaryDTO {
  id: string;
  referenceDate: string;
  periodLabel: string;
  physicalProgressPercent: number;
  realizedMaterialCost: number;
  realizedLaborCost: number;
  realizedThirdPartyCost: number;
  totalRealizedCost: number;
  notes: string | null;
  stageCosts: StageCostEntry[];
}

export interface ExecutionPackageDTO {
  id: string;
  packageNumber: number;
  name: string;
  waveName: string;
  linkedStageCodes: string[];
  segments: Array<{
    id: string;
    zoneCode: string;
    startDate: string;
    endDate: string;
    workingDays: number;
    progressPercent: number;
  }>;
}

export interface ExecutionProcurementDTO {
  id: string;
  packageName: string;
  title: string;
  triggerDate: string;
  leadTimeDays: number;
  status: string;
}

export interface ExecutionDashboardPayload {
  meta: {
    projectId: string;
    projectName: string;
    clientName: string;
    cityLabel: string;
    builtAreaM2: number;
    status: string;
    currentRevision: number;
    activeBaselineLabel: string;
    referenceDate: string;
    startDate: string | null;
    endDate: string | null;
    totalWorkingDays: number;
    isPublishedToClient: boolean;
  };
  kpis: {
    plannedPhysicalPercent: number;
    realizedPhysicalPercent: number;
    spi: number;
    scheduleVarianceWorkingDays: number;
    budgetedTotal: number;
    realizedMaterialTotal: number;
    realizedLaborTotal: number;
    realizedThirdPartyTotal: number;
    realizedTotal: number;
    earnedValue: number;
    cpi: number;
    remainingBudget: number;
    financialPaymentsTotal: number;
  };
  dualSCurve: DualSCurvePointDTO[];
  zoneProgress: ZoneProgressDTO[];
  stageMatrix: StageExecutionRowDTO[];
  packages: ExecutionPackageDTO[];
  measurements: MeasurementSummaryDTO[];
  baselineHistory: BaselineRevisionSummaryDTO[];
  upcomingProcurement: ExecutionProcurementDTO[];
}

export interface ExecutionDashboardInput {
  projectId: string;
  projectName: string;
  clientName: string;
  cityLabel: string;
  builtAreaM2: number;
  status: string;
  currentRevision: number;
  referenceDate?: Date | string;
  zones: Array<{ code: string; name: string }>;
  stages: Array<{
    code: string;
    name: string;
    totalMaterial: number;
    totalLabor: number;
    totalThirdParty: number;
    totalDirectCost: number;
    totalCommercialPrice: number;
  }>;
  packages: ExecutionPackageDTO[];
  monthlySeries: MonthlyCashflowPoint[];
  totalWorkingDays: number;
  startDate: string | null;
  endDate: string | null;
  measurements: Array<{
    id: string;
    referenceDate: Date | string;
    periodLabel: string;
    physicalProgressPercent: number;
    realizedMaterialCost: number;
    realizedLaborCost: number;
    realizedThirdPartyCost: number;
    notes: string | null;
    detailsJson?: unknown;
  }>;
  baselineSnapshots: Array<{
    id: string;
    versionLabel: string;
    totalDirectCost: number;
    totalCommercialPrice: number;
    costPerM2: number;
    approvedAt: Date | string;
    snapshotJson?: unknown;
  }>;
  procurementGates: ExecutionProcurementDTO[];
  financialPaymentsTotal: number;
}

const PUBLISHED_STATUSES = new Set(["BASELINE_APROVADA", "EM_EXECUCAO", "CONCLUIDA"]);

function toIsoDate(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, round2(v)));
}

/**
 * Classifica o semáforo financeiro e de prazo de uma macro-etapa:
 * - ESTOURO: > 100% do teto orçado da etapa
 * - ATENCAO: 85% a 100% do orçamento consumido OU SPI < 0.95 (com etapa ainda não concluída)
 * - SAUDAVEL: < 85% do orçamento e prazo em dia
 */
export function classifyStageTrafficLight(params: {
  budgetedCommercial: number;
  realizedTotal: number;
  spi: number;
  physicalProgressPercent: number;
}): StageTrafficLight {
  const { budgetedCommercial, realizedTotal, spi, physicalProgressPercent } = params;
  if (budgetedCommercial <= 0) {
    return realizedTotal > 0 ? "ESTOURO" : "SAUDAVEL";
  }
  const consumptionPct = (realizedTotal / budgetedCommercial) * 100;
  if (consumptionPct > 100.001) {
    return "ESTOURO";
  }
  if (consumptionPct >= 85 || (spi < 0.95 && physicalProgressPercent < 100 && realizedTotal > 0)) {
    return "ATENCAO";
  }
  return "SAUDAVEL";
}

function parseStageCostsFromDetails(detailsJson: unknown): StageCostEntry[] {
  if (!detailsJson || typeof detailsJson !== "object") return [];
  const raw = (detailsJson as Record<string, unknown>).stageCosts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
    .map((x) => ({
      stageCode: String(x.stageCode ?? "").padStart(2, "0"),
      material: Number(x.material ?? 0) || 0,
      labor: Number(x.labor ?? 0) || 0,
      thirdParty: Number(x.thirdParty ?? 0) || 0,
    }))
    .filter((x) => x.stageCode.length > 0);
}

function computePlannedPctAtDate(
  monthlySeries: MonthlyCashflowPoint[],
  referenceIso: string
): number {
  if (monthlySeries.length === 0) return 0;
  const refMonth = referenceIso.slice(0, 7);
  let planned = 0;
  for (const m of monthlySeries) {
    if (m.monthKey <= refMonth) {
      planned = m.cumulativePhysicalPercent;
    }
  }
  return clampPct(planned);
}

function computeSegmentPlannedPctAtDate(
  startDate: string,
  endDate: string,
  referenceIso: string
): number {
  if (referenceIso <= startDate) return 0;
  if (referenceIso >= endDate) return 100;
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
  const endMs = new Date(`${endDate}T00:00:00Z`).getTime();
  const refMs = new Date(`${referenceIso}T00:00:00Z`).getTime();
  if (endMs <= startMs) return 100;
  return clampPct(((refMs - startMs) / (endMs - startMs)) * 100);
}

export function computeExecutionDashboard(
  input: ExecutionDashboardInput
): ExecutionDashboardPayload {
  const sortedMeasurements = [...input.measurements].sort((a, b) =>
    toIsoDate(a.referenceDate).localeCompare(toIsoDate(b.referenceDate))
  );

  const latestMeasurement =
    sortedMeasurements.length > 0
      ? sortedMeasurements[sortedMeasurements.length - 1]
      : null;

  const referenceIso = input.referenceDate
    ? toIsoDate(input.referenceDate)
    : latestMeasurement
      ? toIsoDate(latestMeasurement.referenceDate)
      : toIsoDate(new Date());

  // Histórico de baselines ordenado do mais antigo para o mais novo para calcular deltas
  const ascBaselines = [...input.baselineSnapshots].sort((a, b) =>
    toIsoDate(a.approvedAt).localeCompare(toIsoDate(b.approvedAt))
  );
  const baselineHistory: BaselineRevisionSummaryDTO[] = ascBaselines.map((snap, idx) => {
    const prev = idx > 0 ? ascBaselines[idx - 1] : null;
    const deltaAmount = prev ? round2(snap.totalCommercialPrice - prev.totalCommercialPrice) : 0;
    const deltaPct =
      prev && prev.totalCommercialPrice > 0
        ? round2((deltaAmount / prev.totalCommercialPrice) * 100)
        : 0;
    const snapMeta =
      snap.snapshotJson && typeof snap.snapshotJson === "object"
        ? (snap.snapshotJson as Record<string, unknown>)
        : {};
    return {
      id: snap.id,
      versionLabel: snap.versionLabel,
      approvedAt: toIsoDate(snap.approvedAt),
      totalDirectCost: round2(snap.totalDirectCost),
      totalCommercialPrice: round2(snap.totalCommercialPrice),
      costPerM2: round2(snap.costPerM2),
      reason: typeof snapMeta.reason === "string" ? snapMeta.reason : null,
      deltaCommercialAmount: deltaAmount,
      deltaCommercialPercent: deltaPct,
    };
  });

  const latestBaseline =
    baselineHistory.length > 0 ? baselineHistory[baselineHistory.length - 1] : null;

  const stageBudgetSum = round2(
    input.stages.reduce((acc, s) => acc + s.totalCommercialPrice, 0)
  );
  const budgetedTotal =
    latestBaseline && latestBaseline.totalCommercialPrice > 0
      ? latestBaseline.totalCommercialPrice
      : stageBudgetSum;

  // Avanço físico por segmento/pacote
  const stageProgressAccum = new Map<string, { weightedSum: number; weightTotal: number }>();
  let globalWeightedProgress = 0;
  let globalWeightSum = 0;

  const stageBudgetByCode = new Map<string, number>(
    input.stages.map((s) => [s.code, s.totalCommercialPrice])
  );

  for (const pkg of input.packages) {
    const totalDays = pkg.segments.reduce((s, seg) => s + Math.max(1, seg.workingDays), 0);
    const pkgProgress =
      totalDays > 0
        ? pkg.segments.reduce(
            (s, seg) => s + clampPct(seg.progressPercent) * Math.max(1, seg.workingDays),
            0
          ) / totalDays
        : 0;

    // Peso financeiro do pacote (soma das etapas vinculadas ou dias úteis como fallback)
    const linkedBudget = pkg.linkedStageCodes.reduce(
      (s, code) => s + (stageBudgetByCode.get(code) ?? 0),
      0
    );
    const pkgWeight = linkedBudget > 0 ? linkedBudget : Math.max(1, totalDays);

    globalWeightedProgress += pkgProgress * pkgWeight;
    globalWeightSum += pkgWeight;

    for (const code of pkg.linkedStageCodes) {
      const curr = stageProgressAccum.get(code) ?? { weightedSum: 0, weightTotal: 0 };
      curr.weightedSum += pkgProgress * Math.max(1, totalDays);
      curr.weightTotal += Math.max(1, totalDays);
      stageProgressAccum.set(code, curr);
    }
  }

  const segmentDrivenPhysicalPct =
    globalWeightSum > 0 ? clampPct(globalWeightedProgress / globalWeightSum) : 0;

  const realizedPhysicalPercent =
    segmentDrivenPhysicalPct > 0
      ? segmentDrivenPhysicalPct
      : latestMeasurement
        ? clampPct(latestMeasurement.physicalProgressPercent)
        : 0;

  const plannedPhysicalPercent = computePlannedPctAtDate(input.monthlySeries, referenceIso);

  const spi =
    plannedPhysicalPercent > 0
      ? round2(realizedPhysicalPercent / plannedPhysicalPercent)
      : realizedPhysicalPercent > 0
        ? 1
        : 1;

  const scheduleVarianceWorkingDays = Math.round(
    ((realizedPhysicalPercent - plannedPhysicalPercent) / 100) *
      Math.max(1, input.totalWorkingDays)
  );

  // Custos realizados acumulados (por medição + alocação por macro-etapa)
  const realizedMaterialTotal = round2(
    sortedMeasurements.reduce((acc, m) => acc + (Number(m.realizedMaterialCost) || 0), 0)
  );
  const realizedLaborTotal = round2(
    sortedMeasurements.reduce((acc, m) => acc + (Number(m.realizedLaborCost) || 0), 0)
  );
  const realizedThirdPartyTotal = round2(
    sortedMeasurements.reduce((acc, m) => acc + (Number(m.realizedThirdPartyCost) || 0), 0)
  );
  const realizedTotal = round2(
    realizedMaterialTotal + realizedLaborTotal + realizedThirdPartyTotal
  );

  const earnedValue = round2((budgetedTotal * realizedPhysicalPercent) / 100);
  const cpi = realizedTotal > 0 ? round2(earnedValue / realizedTotal) : 1;
  const remainingBudget = round2(budgetedTotal - realizedTotal);

  // Alocação de custos realizados por macro-etapa (explícito no detailsJson ou rateado pelo peso das etapas)
  const stageRealizedMap = new Map<
    string,
    { material: number; labor: number; thirdParty: number }
  >();

  let unallocatedMat = 0;
  let unallocatedLab = 0;
  let unallocatedThird = 0;

  for (const m of sortedMeasurements) {
    const parsed = parseStageCostsFromDetails(m.detailsJson);
    if (parsed.length > 0) {
      let sumM = 0;
      let sumL = 0;
      let sumT = 0;
      for (const sc of parsed) {
        const curr = stageRealizedMap.get(sc.stageCode) ?? {
          material: 0,
          labor: 0,
          thirdParty: 0,
        };
        curr.material += sc.material;
        curr.labor += sc.labor;
        curr.thirdParty += sc.thirdParty;
        stageRealizedMap.set(sc.stageCode, curr);
        sumM += sc.material;
        sumL += sc.labor;
        sumT += sc.thirdParty;
      }
      unallocatedMat += Math.max(0, (Number(m.realizedMaterialCost) || 0) - sumM);
      unallocatedLab += Math.max(0, (Number(m.realizedLaborCost) || 0) - sumL);
      unallocatedThird += Math.max(0, (Number(m.realizedThirdPartyCost) || 0) - sumT);
    } else {
      unallocatedMat += Number(m.realizedMaterialCost) || 0;
      unallocatedLab += Number(m.realizedLaborCost) || 0;
      unallocatedThird += Number(m.realizedThirdPartyCost) || 0;
    }
  }

  // Rateio proporcional do saldo não alocado explicitamente entre etapas com orçamento
  const stageMatrix: StageExecutionRowDTO[] = input.stages.map((st) => {
    const explicit = stageRealizedMap.get(st.code) ?? { material: 0, labor: 0, thirdParty: 0 };
    const weightRatio = stageBudgetSum > 0 ? st.totalCommercialPrice / stageBudgetSum : 0;

    const realizedMaterial = round2(explicit.material + unallocatedMat * weightRatio);
    const realizedLabor = round2(explicit.labor + unallocatedLab * weightRatio);
    const realizedThirdParty = round2(explicit.thirdParty + unallocatedThird * weightRatio);
    const stRealizedTotal = round2(realizedMaterial + realizedLabor + realizedThirdParty);

    const prog = stageProgressAccum.get(st.code);
    const stPhysicalPct =
      prog && prog.weightTotal > 0
        ? clampPct(prog.weightedSum / prog.weightTotal)
        : st.totalCommercialPrice > 0 && stRealizedTotal > 0
          ? clampPct((stRealizedTotal / st.totalCommercialPrice) * 100)
          : 0;

    const stEarnedValue = round2((st.totalCommercialPrice * stPhysicalPct) / 100);
    const stCpi = stRealizedTotal > 0 ? round2(stEarnedValue / stRealizedTotal) : 1;
    const varianceAmount = round2(stRealizedTotal - st.totalCommercialPrice);
    const variancePercent =
      st.totalCommercialPrice > 0
        ? round2((varianceAmount / st.totalCommercialPrice) * 100)
        : 0;
    const consumptionPercent =
      st.totalCommercialPrice > 0
        ? round2((stRealizedTotal / st.totalCommercialPrice) * 100)
        : stRealizedTotal > 0
          ? 100
          : 0;

    const stStatus = classifyStageTrafficLight({
      budgetedCommercial: st.totalCommercialPrice,
      realizedTotal: stRealizedTotal,
      spi,
      physicalProgressPercent: stPhysicalPct,
    });

    return {
      code: st.code,
      name: st.name,
      budgetedCommercial: round2(st.totalCommercialPrice),
      budgetedMaterial: round2(st.totalMaterial),
      budgetedLabor: round2(st.totalLabor),
      budgetedThirdParty: round2(st.totalThirdParty),
      realizedMaterial,
      realizedLabor,
      realizedThirdParty,
      realizedTotal: stRealizedTotal,
      physicalProgressPercent: stPhysicalPct,
      earnedValue: stEarnedValue,
      varianceAmount,
      variancePercent,
      consumptionPercent,
      cpi: stCpi,
      status: stStatus,
    };
  });

  // Série Temporal da Curva S Dupla (Previsto x Realizado)
  const monthlyRealizedMap = new Map<
    string,
    { cost: number; maxPhysicalPct: number }
  >();
  for (const m of sortedMeasurements) {
    const mk = toIsoDate(m.referenceDate).slice(0, 7);
    const cost =
      (Number(m.realizedMaterialCost) || 0) +
      (Number(m.realizedLaborCost) || 0) +
      (Number(m.realizedThirdPartyCost) || 0);
    const curr = monthlyRealizedMap.get(mk) ?? { cost: 0, maxPhysicalPct: 0 };
    curr.cost = round2(curr.cost + cost);
    curr.maxPhysicalPct = Math.max(curr.maxPhysicalPct, clampPct(m.physicalProgressPercent));
    monthlyRealizedMap.set(mk, curr);
  }

  const latestMeasMonth = latestMeasurement
    ? toIsoDate(latestMeasurement.referenceDate).slice(0, 7)
    : null;

  let runningRealizedFinancial = 0;
  let lastRealizedPhysical = 0;

  const dualSCurve: DualSCurvePointDTO[] = input.monthlySeries.map((pt) => {
    const rec = monthlyRealizedMap.get(pt.monthKey);
    const hasReached = latestMeasMonth !== null && pt.monthKey <= latestMeasMonth;
    if (rec) {
      runningRealizedFinancial = round2(runningRealizedFinancial + rec.cost);
      lastRealizedPhysical = Math.max(lastRealizedPhysical, rec.maxPhysicalPct);
    }
    return {
      monthKey: pt.monthKey,
      label: pt.label,
      plannedPhysicalPct: clampPct(pt.cumulativePhysicalPercent),
      realizedPhysicalPct: hasReached ? clampPct(lastRealizedPhysical) : null,
      plannedFinancialAccumulated: round2(pt.cumulativeCommercialCost),
      realizedFinancialAccumulated: hasReached ? runningRealizedFinancial : null,
      plannedMonthly: round2(pt.commercialCost),
      realizedMonthly: rec ? rec.cost : 0,
    };
  });

  // Avanço por Zona/Pavimento
  const zoneProgress: ZoneProgressDTO[] = input.zones.map((z) => {
    const segs = input.packages.flatMap((p) =>
      p.segments.filter((s) => s.zoneCode === z.code)
    );
    const totalDays = segs.reduce((acc, s) => acc + Math.max(1, s.workingDays), 0);
    const plannedPercent =
      totalDays > 0
        ? clampPct(
            segs.reduce(
              (acc, s) =>
                acc +
                computeSegmentPlannedPctAtDate(s.startDate, s.endDate, referenceIso) *
                  Math.max(1, s.workingDays),
              0
            ) / totalDays
          )
        : 0;
    const realizedPercent =
      totalDays > 0
        ? clampPct(
            segs.reduce(
              (acc, s) => acc + clampPct(s.progressPercent) * Math.max(1, s.workingDays),
              0
            ) / totalDays
          )
        : 0;

    return {
      zoneCode: z.code,
      zoneName: z.name,
      plannedPercent,
      realizedPercent,
      segmentsCount: segs.length,
    };
  });

  const measurementsDto: MeasurementSummaryDTO[] = [...sortedMeasurements]
    .reverse()
    .map((m) => {
      const mat = round2(Number(m.realizedMaterialCost) || 0);
      const lab = round2(Number(m.realizedLaborCost) || 0);
      const third = round2(Number(m.realizedThirdPartyCost) || 0);
      return {
        id: m.id,
        referenceDate: toIsoDate(m.referenceDate),
        periodLabel: m.periodLabel,
        physicalProgressPercent: clampPct(m.physicalProgressPercent),
        realizedMaterialCost: mat,
        realizedLaborCost: lab,
        realizedThirdPartyCost: third,
        totalRealizedCost: round2(mat + lab + third),
        notes: m.notes,
        stageCosts: parseStageCostsFromDetails(m.detailsJson),
      };
    });

  const upcomingProcurement = [...input.procurementGates]
    .filter((g) => g.status !== "ENTREGUE")
    .sort((a, b) => a.triggerDate.localeCompare(b.triggerDate))
    .slice(0, 12);

  return {
    meta: {
      projectId: input.projectId,
      projectName: input.projectName,
      clientName: input.clientName,
      cityLabel: input.cityLabel,
      builtAreaM2: input.builtAreaM2,
      status: input.status,
      currentRevision: input.currentRevision,
      activeBaselineLabel: latestBaseline?.versionLabel || `v${input.currentRevision}.0`,
      referenceDate: referenceIso,
      startDate: input.startDate,
      endDate: input.endDate,
      totalWorkingDays: input.totalWorkingDays,
      isPublishedToClient: PUBLISHED_STATUSES.has(input.status),
    },
    kpis: {
      plannedPhysicalPercent,
      realizedPhysicalPercent,
      spi,
      scheduleVarianceWorkingDays,
      budgetedTotal: round2(budgetedTotal),
      realizedMaterialTotal,
      realizedLaborTotal,
      realizedThirdPartyTotal,
      realizedTotal,
      earnedValue,
      cpi,
      remainingBudget,
      financialPaymentsTotal: round2(input.financialPaymentsTotal),
    },
    dualSCurve,
    zoneProgress,
    stageMatrix,
    packages: input.packages,
    measurements: measurementsDto,
    baselineHistory: [...baselineHistory].reverse(),
    upcomingProcurement,
  };
}

/**
 * Helper puro para estruturar uma revisão aditiva de Baseline (v1.0 -> v2.0),
 * preservando o snapshot anterior e calculando o delta de escopo.
 */
export function buildAdditiveBaselineSnapshot(input: {
  existingSnapshotsCount: number;
  previousSnapshot: {
    versionLabel: string;
    totalCommercialPrice: number;
    totalDirectCost: number;
  } | null;
  newTotalDirectCost: number;
  newTotalCommercialPrice: number;
  newCostPerM2: number;
  reason: string;
  notes?: string | null;
  extraPayload?: Record<string, unknown>;
}) {
  const nextVersionNumber = Math.max(1, input.existingSnapshotsCount) + 1;
  const versionLabel = `v${nextVersionNumber}.0`;
  const prevCommercial = input.previousSnapshot?.totalCommercialPrice ?? 0;
  const deltaCommercialAmount = input.previousSnapshot
    ? round2(input.newTotalCommercialPrice - prevCommercial)
    : 0;
  const deltaCommercialPercent =
    input.previousSnapshot && prevCommercial > 0
      ? round2((deltaCommercialAmount / prevCommercial) * 100)
      : 0;

  return {
    nextRevisionNumber: nextVersionNumber,
    versionLabel,
    totalDirectCost: round2(input.newTotalDirectCost),
    totalCommercialPrice: round2(input.newTotalCommercialPrice),
    costPerM2: round2(input.newCostPerM2),
    deltaCommercialAmount,
    deltaCommercialPercent,
    snapshotJson: {
      versionLabel,
      previousVersionLabel: input.previousSnapshot?.versionLabel ?? null,
      reason: input.reason,
      notes: input.notes ?? null,
      deltaCommercialAmount,
      deltaCommercialPercent,
      ...(input.extraPayload ?? {}),
    },
  };
}

/**
 * Filtra/adapta o payload de evolução periódica para visualização/exportação (Admin ou Cliente).
 */
export function buildProgressEvolutionPayload(
  dashboard: ExecutionDashboardPayload,
  audience: "INTERNAL" | "CLIENT"
): ExecutionDashboardPayload {
  if (audience === "INTERNAL") return dashboard;
  return {
    ...dashboard,
    baselineHistory: dashboard.baselineHistory.map((b) => ({
      ...b,
      totalDirectCost: 0,
    })),
    stageMatrix: dashboard.stageMatrix.map((st) => ({
      ...st,
      budgetedMaterial: 0,
      budgetedLabor: 0,
      budgetedThirdParty: 0,
    })),
  };
}

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Gera o Boletim Periódico de Evolução de Obra em PDF (%PDF-1.4, zero dependências nativas).
 */
export function renderProgressEvolutionPdf(
  payload: ExecutionDashboardPayload,
  audience: "INTERNAL" | "CLIENT" = "CLIENT"
): Uint8Array {
  const safePayload = buildProgressEvolutionPayload(payload, audience);
  const pdf = new PdfWriter({
    title: `Boletim de Evolucao de Obra - ${safePayload.meta.projectName}`,
    author: "ArqVertice Studio",
    subject: `Acompanhamento Fisico-Financeiro (${safePayload.meta.activeBaselineLabel})`,
  });

  // 1. CAPA / CABEÇALHO EXECUTIVO
  pdf.rect(0, 0, pdf.width, 128, { fill: "0.09 0.09 0.11" });
  pdf.drawText("ARQVERTICE STUDIO — CONTROLADORIA DE OBRAS", pdf.margin, 44, {
    size: 10,
    bold: true,
    color: "0.93 0.90 0.85",
  });
  pdf.drawText("BOLETIM PERIODICO DE EVOLUCAO DE OBRA", pdf.margin, 70, {
    size: 16,
    bold: true,
    color: "1 1 1",
  });
  pdf.drawText(
    `${safePayload.meta.projectName} · Cliente: ${safePayload.meta.clientName}`,
    pdf.margin,
    95,
    { size: 11, color: "0.85 0.87 0.90" }
  );
  pdf.drawText(
    `Data Ref.: ${safePayload.meta.referenceDate} · Baseline: ${safePayload.meta.activeBaselineLabel} · Status: ${safePayload.meta.status}`,
    pdf.margin,
    114,
    { size: 9, color: "0.75 0.78 0.82" }
  );

  pdf.y = 148;

  // 2. KPIs DE DESEMPENHO (PRAZO & CUSTO)
  pdf.flowText("1. INDICADORES EXECUTIVOS DE DESEMPENHO (EVM)", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });
  pdf.flowText(
    `Avanco Fisico: Realizado ${safePayload.kpis.realizedPhysicalPercent.toFixed(1)}% vs. Previsto ${safePayload.kpis.plannedPhysicalPercent.toFixed(1)}%  |  SPI (Prazo): ${safePayload.kpis.spi.toFixed(2)} (${safePayload.kpis.scheduleVarianceWorkingDays >= 0 ? "+" : ""}${safePayload.kpis.scheduleVarianceWorkingDays} dias uteis)`,
    { size: 9.5, bold: true, gapAfter: 4 }
  );
  pdf.flowText(
    `Orcamento Baseline: ${fmtBRL(safePayload.kpis.budgetedTotal)}  |  Realizado Acumulado: ${fmtBRL(safePayload.kpis.realizedTotal)}  |  Saldo: ${fmtBRL(safePayload.kpis.remainingBudget)}`,
    { size: 9.5, gapAfter: 4 }
  );
  pdf.flowText(
    `Valor Agregado (EV): ${fmtBRL(safePayload.kpis.earnedValue)}  |  CPI (Custo): ${safePayload.kpis.cpi.toFixed(2)}`,
    { size: 9, gapAfter: 4 }
  );
  pdf.flowText(
    `Realizado por Natureza: Material ${fmtBRL(safePayload.kpis.realizedMaterialTotal)} · Mao de Obra ${fmtBRL(safePayload.kpis.realizedLaborTotal)} · Terceiros ${fmtBRL(safePayload.kpis.realizedThirdPartyTotal)}`,
    { size: 9, gapAfter: 10 }
  );

  // 3. AVANÇO FÍSICO POR ZONA / PAVIMENTO
  pdf.flowText("2. AVANCO FISICO POR PAVIMENTO / ZONA", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });
  for (const z of safePayload.zoneProgress) {
    pdf.flowText(
      `- ${z.zoneName} (${z.zoneCode}): Realizado ${z.realizedPercent.toFixed(1)}% vs. Previsto ${z.plannedPercent.toFixed(1)}% (${z.segmentsCount} frentes)`,
      { size: 9, gapAfter: 2 }
    );
  }
  pdf.y += 8;

  // 4. CURVA S DUPLA (PREVISTO x REALIZADO)
  pdf.flowText("3. CURVA S DUPLA — PREVISTO x REALIZADO", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });
  for (const pt of safePayload.dualSCurve) {
    const realPctStr =
      pt.realizedPhysicalPct !== null ? `${pt.realizedPhysicalPct.toFixed(1)}%` : "--";
    const realFinStr =
      pt.realizedFinancialAccumulated !== null
        ? fmtBRL(pt.realizedFinancialAccumulated)
        : "--";
    pdf.flowText(
      `${pt.label}: Fisico Prev ${pt.plannedPhysicalPct.toFixed(1)}% / Real ${realPctStr}  |  Financ Prev ${fmtBRL(pt.plannedFinancialAccumulated)} / Real ${realFinStr}`,
      { size: 8.5, gapAfter: 2 }
    );
  }
  pdf.y += 8;

  // 5. SEMAFORO FINANCEIRO DAS MACRO-ETAPAS
  pdf.flowText("4. SEMAFORO FINANCEIRO & FISICO POR MACRO-ETAPA", {
    size: 12,
    bold: true,
    gapAfter: 6,
  });
  for (const st of safePayload.stageMatrix) {
    if (st.budgetedCommercial <= 0 && st.realizedTotal <= 0) continue;
    pdf.flowText(
      `[${st.status}] ${st.code} - ${st.name}: Fis ${st.physicalProgressPercent.toFixed(0)}% | Orc ${fmtBRL(st.budgetedCommercial)} | Real ${fmtBRL(st.realizedTotal)} (${st.consumptionPercent.toFixed(1)}%)`,
      { size: 8.5, gapAfter: 2 }
    );
  }
  pdf.y += 8;

  // 6. SUPRIMENTOS CRITICOS & HISTORICO DE MEDICOES
  if (safePayload.upcomingProcurement.length > 0) {
    pdf.flowText("5. SUPRIMENTOS E COMPRAS PRIORITARIAS", {
      size: 12,
      bold: true,
      gapAfter: 6,
    });
    for (const g of safePayload.upcomingProcurement.slice(0, 8)) {
      pdf.flowText(
        `- [${g.status}] ${g.triggerDate} · ${g.title} (${g.packageName} · Lead time ${g.leadTimeDays}d)`,
        { size: 8.5, gapAfter: 2 }
      );
    }
    pdf.y += 6;
  }

  if (safePayload.measurements.length > 0) {
    pdf.flowText("6. HISTORICO DE BOLETINS DE MEDICAO", {
      size: 12,
      bold: true,
      gapAfter: 6,
    });
    for (const m of safePayload.measurements.slice(0, 8)) {
      pdf.flowText(
        `- ${m.periodLabel} (${m.referenceDate}): Fisico ${m.physicalProgressPercent.toFixed(1)}% | Realizado ${fmtBRL(m.totalRealizedCost)}${m.notes ? ` · ${m.notes}` : ""}`,
        { size: 8.5, gapAfter: 2 }
      );
    }
  }

  pdf.stampFooters(
    `ArqVértice OS · Evolucao de Obra · ${safePayload.meta.projectName} · ${safePayload.meta.activeBaselineLabel}`
  );
  return pdf.build();
}

/**
 * Carrega todos os dados reais do banco para o Dashboard de Execução do Ciclo II.
 */
export async function loadExecutionDashboardFromDb(
  projectId: string
): Promise<ExecutionDashboardPayload | null> {
  const [project, eap, paidPayments] = await Promise.all([
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
        baselineSnapshots: { orderBy: { approvedAt: "asc" } },
        measurements: { orderBy: { referenceDate: "asc" } },
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
    prisma.payment.findMany({
      where: { projectId, status: "PAID", archivedAt: null },
      select: { amount: true },
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

  const packagesForAnalytics = eap.schedulePackages.map((p) => ({
    packageNumber: p.packageNumber,
    linkedStageCodes: Array.isArray(p.linkedStageCodesJson)
      ? p.linkedStageCodesJson.map(String)
      : [],
    teamsCount: p.teamsCount,
    segments: p.segments.map((s) => ({
      startDate: s.startDate.toISOString().slice(0, 10),
      endDate: s.endDate.toISOString().slice(0, 10),
      workingDays: s.workingDays,
    })),
  }));

  const analytics = computeScheduleAnalytics({
    packages: packagesForAnalytics,
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

  const packagesDto: ExecutionPackageDTO[] = eap.schedulePackages.map((p) => ({
    id: p.id,
    packageNumber: p.packageNumber,
    name: p.name,
    waveName: p.waveName,
    linkedStageCodes: Array.isArray(p.linkedStageCodesJson)
      ? p.linkedStageCodesJson.map(String)
      : [],
    segments: p.segments.map((s) => ({
      id: s.id,
      zoneCode: s.zoneCode,
      startDate: s.startDate.toISOString().slice(0, 10),
      endDate: s.endDate.toISOString().slice(0, 10),
      workingDays: s.workingDays,
      progressPercent: s.progressPercent,
    })),
  }));

  const procurementGates: ExecutionProcurementDTO[] = eap.schedulePackages.flatMap((p) =>
    p.procurementGates.map((g) => ({
      id: g.id,
      packageName: p.name,
      title: g.title,
      triggerDate: g.triggerDate.toISOString().slice(0, 10),
      leadTimeDays: g.leadTimeDays,
      status: g.status,
    }))
  );

  const financialPaymentsTotal = round2(
    paidPayments.reduce((acc, p) => acc + Number(p.amount), 0)
  );

  return computeExecutionDashboard({
    projectId: eap.projectId,
    projectName: project.name,
    clientName: project.client?.name || "Cliente",
    cityLabel: `${eap.city.name}/${eap.city.state}`,
    builtAreaM2: eap.builtAreaM2,
    status: eap.status,
    currentRevision: eap.currentRevision,
    zones: eap.zones.map((z) => ({ code: z.code, name: z.name })),
    stages: tree.stages.map((st) => ({
      code: st.code,
      name: st.name,
      totalMaterial: st.totalMaterial,
      totalLabor: st.totalLabor,
      totalThirdParty: st.totalThirdParty,
      totalDirectCost: st.totalDirectCost,
      totalCommercialPrice: st.totalCommercialPrice,
    })),
    packages: packagesDto,
    monthlySeries: analytics.monthlySeries,
    totalWorkingDays: analytics.totalWorkingDays,
    startDate: analytics.startDate,
    endDate: analytics.endDate,
    measurements: eap.measurements,
    baselineSnapshots: eap.baselineSnapshots,
    procurementGates,
    financialPaymentsTotal,
  });
}

/**
 * Registra um novo Boletim de Medição Periódica, atualizando ScheduleSegment.progressPercent
 * e transicionando EapProject.status para EM_EXECUCAO ou CONCLUIDA (100%).
 */
export async function recordWorkMeasurement(
  projectId: string,
  input: {
    referenceDate: string;
    periodLabel: string;
    physicalProgressPercent?: number;
    realizedMaterialCost: number;
    realizedLaborCost: number;
    realizedThirdPartyCost: number;
    notes?: string | null;
    segmentUpdates?: SegmentProgressUpdate[];
    stageCosts?: StageCostEntry[];
  }
) {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
      schedulePackages: {
        include: { segments: true },
      },
    },
  });
  if (!eap) return null;

  const validSegmentIds = new Set(
    eap.schedulePackages.flatMap((p) => p.segments.map((s) => s.id))
  );
  const safeSegmentUpdates = (input.segmentUpdates ?? []).filter((u) =>
    validSegmentIds.has(u.segmentId)
  );

  return prisma.$transaction(async (tx) => {
    for (const upd of safeSegmentUpdates) {
      await tx.scheduleSegment.update({
        where: { id: upd.segmentId },
        data: { progressPercent: clampPct(upd.progressPercent) },
      });
    }

    // Recalcula avanço físico ponderado pelos dias úteis dos segmentos caso não tenha sido informado explicitamente
    let computedProgress = input.physicalProgressPercent;
    if (computedProgress === undefined) {
      const updatedMap = new Map(
        safeSegmentUpdates.map((u) => [u.segmentId, clampPct(u.progressPercent)])
      );
      let weighted = 0;
      let totalDays = 0;
      for (const pkg of eap.schedulePackages) {
        for (const seg of pkg.segments) {
          const pct = updatedMap.has(seg.id)
            ? updatedMap.get(seg.id)!
            : clampPct(seg.progressPercent);
          const days = Math.max(1, seg.workingDays);
          weighted += pct * days;
          totalDays += days;
        }
      }
      computedProgress = totalDays > 0 ? clampPct(weighted / totalDays) : 0;
    } else {
      computedProgress = clampPct(computedProgress);
    }

    const measurement = await tx.workMeasurement.create({
      data: {
        eapProjectId: eap.id,
        referenceDate: new Date(`${input.referenceDate.slice(0, 10)}T12:00:00Z`),
        periodLabel: input.periodLabel.trim(),
        physicalProgressPercent: computedProgress,
        realizedMaterialCost: round2(input.realizedMaterialCost),
        realizedLaborCost: round2(input.realizedLaborCost),
        realizedThirdPartyCost: round2(input.realizedThirdPartyCost),
        notes: input.notes?.trim() || null,
        detailsJson: JSON.parse(
          JSON.stringify({
            segmentUpdates: safeSegmentUpdates,
            stageCosts: input.stageCosts ?? [],
          })
        ),
      },
    });

    const nextStatus = computedProgress >= 100 ? "CONCLUIDA" : "EM_EXECUCAO";
    await tx.eapProject.update({
      where: { id: eap.id },
      data: { status: nextStatus },
    });

    return { measurement, nextStatus, physicalProgressPercent: computedProgress };
  });
}

/**
 * Cria uma nova revisão aditiva de Baseline (ex.: v1.0 -> v2.0), preservando o histórico anterior.
 */
export async function createAdditiveRevision(
  projectId: string,
  approvedById: string,
  input: { reason: string; notes?: string | null }
) {
  const eap = await prisma.eapProject.findUnique({
    where: { projectId },
    include: {
      city: { include: { holidays: true } },
      zones: { orderBy: { orderIndex: "asc" } },
      conflictLogs: { select: { id: true, status: true } },
      baselineSnapshots: { orderBy: { approvedAt: "desc" } },
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
  });

  if (!eap) return null;

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

  const analytics = computeScheduleAnalytics({
    packages: eap.schedulePackages.map((p) => ({
      packageNumber: p.packageNumber,
      linkedStageCodes: Array.isArray(p.linkedStageCodesJson)
        ? p.linkedStageCodesJson.map(String)
        : [],
      teamsCount: p.teamsCount,
      segments: p.segments,
    })),
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

  const prevSnap = eap.baselineSnapshots[0] ?? null;
  const built = buildAdditiveBaselineSnapshot({
    existingSnapshotsCount: eap.baselineSnapshots.length,
    previousSnapshot: prevSnap
      ? {
          versionLabel: prevSnap.versionLabel,
          totalCommercialPrice: prevSnap.totalCommercialPrice,
          totalDirectCost: prevSnap.totalDirectCost,
        }
      : null,
    newTotalDirectCost: tree.indicators.totalDirectCost,
    newTotalCommercialPrice: tree.indicators.totalCommercialPrice,
    newCostPerM2: tree.indicators.costPerM2,
    reason: input.reason.trim(),
    notes: input.notes?.trim() || null,
    extraPayload: {
      indicators: tree.indicators,
      analytics,
      stagesSummary: tree.stages.map((s) => ({
        code: s.code,
        name: s.name,
        totalCommercialPrice: s.totalCommercialPrice,
        weightPercent: s.weightPercent,
      })),
    },
  });

  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.eapBaselineSnapshot.create({
      data: {
        eapProjectId: eap.id,
        versionLabel: built.versionLabel,
        totalDirectCost: built.totalDirectCost,
        totalCommercialPrice: built.totalCommercialPrice,
        costPerM2: built.costPerM2,
        approvedById,
        snapshotJson: JSON.parse(JSON.stringify(built.snapshotJson)),
      },
    });

    await tx.eapProject.update({
      where: { id: eap.id },
      data: {
        currentRevision: built.nextRevisionNumber,
        status: eap.status === "CONCLUIDA" ? "CONCLUIDA" : "EM_EXECUCAO",
      },
    });

    return {
      snapshot,
      versionLabel: built.versionLabel,
      deltaCommercialAmount: built.deltaCommercialAmount,
      deltaCommercialPercent: built.deltaCommercialPercent,
    };
  });
}
