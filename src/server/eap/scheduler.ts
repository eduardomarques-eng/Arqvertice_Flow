import {
  addWorkingDays,
  computeWorkingDaysDuration,
  isNonWorkingDayUTC,
  round2,
  toIsoDateKeyUTC,
  type ZoneQuantities,
} from "./calculator";
import {
  DEFAULT_EAP_ZONES,
  MASTER_LOB_PACKAGES,
  type EapZoneCode,
} from "./templates/residential-master";

export interface SchedulerItemInput {
  stageCode: string;
  zoneQuantities: ZoneQuantities;
  lossPercent: number;
  dailyProductivityPerTeam: number | null;
  teamsCount: number;
  totalMaterial: number;
  totalLabor: number;
  totalThirdParty: number;
  totalDirectCost: number;
  totalCommercialPrice: number;
}

export interface SchedulerPackageInput {
  id: string;
  packageNumber: number;
  name: string;
  waveName: string;
  linkedStageCodes: string[];
  predecessorNumbers: number[];
  durationWorkingDays: number;
  teamsCount: number;
  orderIndex: number;
}

export interface GeneratedSegmentDTO {
  packageId: string;
  packageNumber: number;
  zoneCode: EapZoneCode;
  segmentOrder: number;
  startDate: Date;
  endDate: Date;
  workingDays: number;
  parallelLane: number;
  progressPercent: number;
  notes: string | null;
}

export interface GeneratedProcurementGateDTO {
  packageId: string;
  packageNumber: number;
  title: string;
  leadTimeDays: number;
  triggerDate: Date;
  status: "PENDENTE" | "EM_COTACAO" | "COMPRADO" | "ENTREGUE";
}

export interface MonthlyCashflowPoint {
  monthKey: string; // YYYY-MM
  label: string; // Ex.: Abr/26
  materialCost: number;
  laborCost: number;
  thirdPartyCost: number;
  directCost: number;
  commercialCost: number;
  cumulativeCommercialCost: number;
  physicalPercentPeriod: number;
  cumulativePhysicalPercent: number;
  cumulativeFinancialPercent: number;
}

export interface WeeklyHistogramPoint {
  weekKey: string;
  weekStart: string;
  activeFronts: number;
  activeTeams: number;
}

export interface ScheduleAuditResult {
  approved: boolean;
  criticalBlockers: string[];
  warnings: string[];
}

export interface ScheduleAnalyticsResult {
  startDate: string | null;
  endDate: string | null;
  totalWorkingDays: number;
  totalMonths: number;
  holidaysAppliedCount: number;
  peakFronts: number;
  peakTeams: number;
  totalCommercialPrice: number;
  monthlySeries: MonthlyCashflowPoint[];
  weeklyHistogram: WeeklyHistogramPoint[];
}

const MONTH_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseUtcDate(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  return new Date(`${input.slice(0, 10)}T00:00:00.000Z`);
}

export function subtractCalendarDaysUTC(date: Date, days: number): Date {
  const d = parseUtcDate(date);
  d.setUTCDate(d.getUTCDate() - Math.max(0, Math.floor(days)));
  return d;
}

export function nextWorkingDayUTC(date: Date, holidaySet: Set<string>): Date {
  const cursor = parseUtcDate(date);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (isNonWorkingDayUTC(cursor, holidaySet)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor;
}

export function listWorkingDaysBetweenUTC(
  start: Date,
  end: Date,
  holidaySet: Set<string>
): Date[] {
  const days: Date[] = [];
  const cursor = parseUtcDate(start);
  const endTs = parseUtcDate(end).getTime();
  while (cursor.getTime() <= endTs) {
    if (!isNonWorkingDayUTC(cursor, holidaySet)) {
      days.push(new Date(cursor.getTime()));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Gera automaticamente os segmentos LOB (`ScheduleSegment`) e gatilhos de suprimentos (`ProcurementGate`)
 * a partir dos quantitativos conferidos na EAP, produtividades de MO, predecessoras e feriados regionais.
 */
export function generateScheduleFromEap(input: {
  packages: SchedulerPackageInput[];
  items: SchedulerItemInput[];
  plannedStartDate: Date | string;
  holidays: Array<Date | string>;
}): {
  segments: GeneratedSegmentDTO[];
  procurementGates: GeneratedProcurementGateDTO[];
} {
  const holidaySet = new Set(
    input.holidays.map((h) => (typeof h === "string" ? h.slice(0, 10) : toIsoDateKeyUTC(h)))
  );
  const baseStart = parseUtcDate(input.plannedStartDate);
  const orderedPackages = [...input.packages].sort((a, b) => a.packageNumber - b.packageNumber);

  // Fim mais tardio por pacote para encadeamento de predecessoras
  const packageEndDateMap = new Map<number, Date>();
  // Raias ocupadas por zona: zoneCode -> Array<{ lane, startTs, endTs }>
  const zoneLaneOccupancy = new Map<EapZoneCode, Array<{ lane: number; startTs: number; endTs: number }>>();
  for (const z of DEFAULT_EAP_ZONES) {
    zoneLaneOccupancy.set(z.code, []);
  }

  const segments: GeneratedSegmentDTO[] = [];
  const procurementGates: GeneratedProcurementGateDTO[] = [];

  for (const pkg of orderedPackages) {
    // Determina início respeitando predecessoras
    let pkgStart = new Date(baseStart.getTime());
    while (isNonWorkingDayUTC(pkgStart, holidaySet)) {
      pkgStart.setUTCDate(pkgStart.getUTCDate() + 1);
    }

    for (const predNum of pkg.predecessorNumbers) {
      const predEnd = packageEndDateMap.get(predNum);
      if (predEnd) {
        const candidateStart = nextWorkingDayUTC(predEnd, holidaySet);
        if (candidateStart.getTime() > pkgStart.getTime()) {
          pkgStart = candidateStart;
        }
      }
    }

    // Agrega quantidades por zona dos itens vinculados às etapas deste pacote
    const linkedItems = input.items.filter((it) => pkg.linkedStageCodes.includes(it.stageCode));
    const activeZones: Array<{ zoneCode: EapZoneCode; workingDays: number }> = [];

    for (const z of DEFAULT_EAP_ZONES) {
      let zoneWorkDays = 0;
      let hasQty = false;
      for (const it of linkedItems) {
        const rawQty = Number(it.zoneQuantities[z.code]) || 0;
        if (rawQty <= 0) continue;
        hasQty = true;
        const qtyWithLoss = rawQty * (1 + (it.lossPercent || 0) / 100);
        if (it.dailyProductivityPerTeam && it.dailyProductivityPerTeam > 0) {
          zoneWorkDays += computeWorkingDaysDuration(
            qtyWithLoss,
            it.dailyProductivityPerTeam,
            Math.max(1, pkg.teamsCount || it.teamsCount || 1)
          );
        }
      }
      if (hasQty) {
        activeZones.push({
          zoneCode: z.code,
          workingDays: Math.max(1, zoneWorkDays || Math.ceil(pkg.durationWorkingDays / 2)),
        });
      }
    }

    // Se ainda não há itens quantificados nesta etapa, aloca na zona padrão do pacote
    if (activeZones.length === 0) {
      const fallbackZone: EapZoneCode = /cobertura|telhado|reservat/i.test(pkg.name)
        ? "COBERTURA"
        : /superior/i.test(pkg.name)
          ? "PAV_SUPERIOR"
          : /extern|piscina|paisag|port[õo]|fachada/i.test(pkg.name)
            ? "EXTERNO"
            : "FUND_TERREO";
      activeZones.push({
        zoneCode: fallbackZone,
        workingDays: Math.max(1, pkg.durationWorkingDays || 5),
      });
    }

    let cursorStart = new Date(pkgStart.getTime());
    let earliestPkgStart: Date | null = null;
    let latestPkgEnd: Date | null = null;

    for (let idx = 0; idx < activeZones.length; idx++) {
      const az = activeZones[idx];
      const segStart = new Date(cursorStart.getTime());
      const segEnd = addWorkingDays(segStart, az.workingDays, input.holidays);

      // Aloca raia paralela livre nesta zona
      const occupied = zoneLaneOccupancy.get(az.zoneCode) || [];
      let lane = 1;
      const startTs = segStart.getTime();
      const endTs = segEnd.getTime();
      while (occupied.some((o) => o.lane === lane && !(endTs < o.startTs || startTs > o.endTs))) {
        lane += 1;
      }
      occupied.push({ lane, startTs, endTs });
      zoneLaneOccupancy.set(az.zoneCode, occupied);

      segments.push({
        packageId: pkg.id,
        packageNumber: pkg.packageNumber,
        zoneCode: az.zoneCode,
        segmentOrder: idx + 1,
        startDate: segStart,
        endDate: segEnd,
        workingDays: az.workingDays,
        parallelLane: lane,
        progressPercent: 0,
        notes: null,
      });

      if (!earliestPkgStart || segStart.getTime() < earliestPkgStart.getTime()) {
        earliestPkgStart = segStart;
      }
      if (!latestPkgEnd || segEnd.getTime() > latestPkgEnd.getTime()) {
        latestPkgEnd = segEnd;
      }

      // Próxima zona do mesmo pacote inicia após término da zona anterior (fluxo contínuo LOB)
      cursorStart = nextWorkingDayUTC(segEnd, holidaySet);
    }

    if (latestPkgEnd) {
      packageEndDateMap.set(pkg.packageNumber, latestPkgEnd);
    }

    // Gatilhos de suprimentos padrão do template LOB
    const masterTpl = MASTER_LOB_PACKAGES.find((m) => m.packageNumber === pkg.packageNumber);
    if (masterTpl && earliestPkgStart) {
      for (const gate of masterTpl.procurementGates) {
        procurementGates.push({
          packageId: pkg.id,
          packageNumber: pkg.packageNumber,
          title: gate.title,
          leadTimeDays: gate.leadTimeDays,
          triggerDate: subtractCalendarDaysUTC(earliestPkgStart, gate.leadTimeDays),
          status: "PENDENTE",
        });
      }
    }
  }

  return { segments, procurementGates };
}

/**
 * Calcula Curva S Físico-Financeira, Fluxo de Desembolso Mensal (Material × MO × Terceiros)
 * e Histograma Semanal de Frentes/Equipes.
 * Garante que a soma dos desembolsos mensais bata 100% com o valor comercial total da EAP.
 */
export function computeScheduleAnalytics(input: {
  packages: Array<{
    packageNumber: number;
    linkedStageCodes: string[];
    teamsCount: number;
    segments: Array<{
      startDate: Date | string;
      endDate: Date | string;
      workingDays: number;
    }>;
  }>;
  stageBudgets: Array<{
    stageCode: string;
    totalMaterial: number;
    totalLabor: number;
    totalThirdParty: number;
    totalDirectCost: number;
    totalCommercialPrice: number;
  }>;
  holidays: Array<Date | string>;
}): ScheduleAnalyticsResult {
  const holidaySet = new Set(
    input.holidays.map((h) => (typeof h === "string" ? h.slice(0, 10) : toIsoDateKeyUTC(h)))
  );

  // Coleta dias úteis por etapa
  const stageWorkingDays = new Map<string, Date[]>();
  const allSegmentsDays: Array<{ date: Date; teams: number }> = [];
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const pkg of input.packages) {
    for (const seg of pkg.segments) {
      const s = parseUtcDate(seg.startDate);
      const e = parseUtcDate(seg.endDate);
      if (s.getTime() < minTs) minTs = s.getTime();
      if (e.getTime() > maxTs) maxTs = e.getTime();

      const days = listWorkingDaysBetweenUTC(s, e, holidaySet);
      for (const d of days) {
        allSegmentsDays.push({ date: d, teams: Math.max(1, pkg.teamsCount || 1) });
      }
      for (const stCode of pkg.linkedStageCodes) {
        const list = stageWorkingDays.get(stCode) || [];
        list.push(...days);
        stageWorkingDays.set(stCode, list);
      }
    }
  }

  // Fallback de dias úteis globais caso alguma etapa orçada não tenha pacote explícito (ex.: Etapa 25 Admin Local)
  const globalWorkingDays =
    Number.isFinite(minTs) && Number.isFinite(maxTs)
      ? listWorkingDaysBetweenUTC(new Date(minTs), new Date(maxTs), holidaySet)
      : [];

  // Conta quantos feriados regionais caíram dentro da janela da obra
  let holidaysAppliedCount = 0;
  if (Number.isFinite(minTs) && Number.isFinite(maxTs)) {
    for (const hKey of holidaySet) {
      const ts = new Date(`${hKey}T00:00:00.000Z`).getTime();
      if (ts >= minTs && ts <= maxTs) holidaysAppliedCount += 1;
    }
  }

  // Distribuição diária por mês
  const monthBuckets = new Map<
    string,
    { material: number; labor: number; thirdParty: number; direct: number; commercial: number }
  >();

  let expectedTotalCommercial = 0;
  let expectedTotalDirect = 0;
  let expectedTotalMaterial = 0;
  let expectedTotalLabor = 0;
  let expectedTotalThird = 0;

  for (const sb of input.stageBudgets) {
    if (sb.totalCommercialPrice <= 0 && sb.totalDirectCost <= 0) continue;
    expectedTotalCommercial += sb.totalCommercialPrice;
    expectedTotalDirect += sb.totalDirectCost;
    expectedTotalMaterial += sb.totalMaterial;
    expectedTotalLabor += sb.totalLabor;
    expectedTotalThird += sb.totalThirdParty;

    const targetDays = (stageWorkingDays.get(sb.stageCode) || []).length > 0
      ? stageWorkingDays.get(sb.stageCode)!
      : globalWorkingDays;

    if (targetDays.length === 0) continue;

    const perDayMat = sb.totalMaterial / targetDays.length;
    const perDayLab = sb.totalLabor / targetDays.length;
    const perDayThird = sb.totalThirdParty / targetDays.length;
    const perDayDir = sb.totalDirectCost / targetDays.length;
    const perDayComm = sb.totalCommercialPrice / targetDays.length;

    for (const d of targetDays) {
      const mKey = toIsoDateKeyUTC(d).slice(0, 7);
      const curr = monthBuckets.get(mKey) || {
        material: 0,
        labor: 0,
        thirdParty: 0,
        direct: 0,
        commercial: 0,
      };
      curr.material += perDayMat;
      curr.labor += perDayLab;
      curr.thirdParty += perDayThird;
      curr.direct += perDayDir;
      curr.commercial += perDayComm;
      monthBuckets.set(mKey, curr);
    }
  }

  // Garante todos os meses entre início e fim presentes no eixo
  for (const d of globalWorkingDays) {
    const mKey = toIsoDateKeyUTC(d).slice(0, 7);
    if (!monthBuckets.has(mKey)) {
      monthBuckets.set(mKey, { material: 0, labor: 0, thirdParty: 0, direct: 0, commercial: 0 });
    }
  }

  const sortedMonthKeys = [...monthBuckets.keys()].sort();
  const totalCommercialRounded = round2(expectedTotalCommercial);

  const monthlySeries: MonthlyCashflowPoint[] = [];
  let sumComm = 0;
  let sumDir = 0;
  let sumMat = 0;
  let sumLab = 0;
  let sumThird = 0;

  sortedMonthKeys.forEach((mKey, idx) => {
    const b = monthBuckets.get(mKey)!;
    const isLast = idx === sortedMonthKeys.length - 1;

    const materialCost = isLast ? round2(expectedTotalMaterial - sumMat) : round2(b.material);
    const laborCost = isLast ? round2(expectedTotalLabor - sumLab) : round2(b.labor);
    const thirdPartyCost = isLast ? round2(expectedTotalThird - sumThird) : round2(b.thirdParty);
    const directCost = isLast ? round2(expectedTotalDirect - sumDir) : round2(b.direct);
    const commercialCost = isLast ? round2(totalCommercialRounded - sumComm) : round2(b.commercial);

    sumMat = round2(sumMat + materialCost);
    sumLab = round2(sumLab + laborCost);
    sumThird = round2(sumThird + thirdPartyCost);
    sumDir = round2(sumDir + directCost);
    sumComm = round2(sumComm + commercialCost);

    const [yStr, mStr] = mKey.split("-");
    const label = `${MONTH_PT[Number(mStr) - 1]}/${yStr.slice(2)}`;
    const pctPeriod =
      totalCommercialRounded > 0 ? round2((commercialCost / totalCommercialRounded) * 100) : 0;
    const pctCum =
      totalCommercialRounded > 0
        ? isLast
          ? 100
          : round2((sumComm / totalCommercialRounded) * 100)
        : 0;

    monthlySeries.push({
      monthKey: mKey,
      label,
      materialCost,
      laborCost,
      thirdPartyCost,
      directCost,
      commercialCost,
      cumulativeCommercialCost: sumComm,
      physicalPercentPeriod: pctPeriod,
      cumulativePhysicalPercent: pctCum,
      cumulativeFinancialPercent: pctCum,
    });
  });

  // Histograma semanal (pico de frentes simultâneas e equipes)
  const dayFrontsMap = new Map<string, { fronts: number; teams: number }>();
  for (const entry of allSegmentsDays) {
    const dKey = toIsoDateKeyUTC(entry.date);
    const curr = dayFrontsMap.get(dKey) || { fronts: 0, teams: 0 };
    curr.fronts += 1;
    curr.teams += entry.teams;
    dayFrontsMap.set(dKey, curr);
  }

  const weekMap = new Map<string, { weekStart: string; activeFronts: number; activeTeams: number }>();
  for (const [dKey, stats] of dayFrontsMap.entries()) {
    const dt = new Date(`${dKey}T00:00:00.000Z`);
    const dayOfWeek = dt.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    dt.setUTCDate(dt.getUTCDate() + diffToMonday);
    const weekStart = toIsoDateKeyUTC(dt);
    const curr = weekMap.get(weekStart) || { weekStart, activeFronts: 0, activeTeams: 0 };
    curr.activeFronts = Math.max(curr.activeFronts, stats.fronts);
    curr.activeTeams = Math.max(curr.activeTeams, stats.teams);
    weekMap.set(weekStart, curr);
  }

  const weeklyHistogram: WeeklyHistogramPoint[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, val], idx) => ({
      weekKey: `S${String(idx + 1).padStart(2, "0")}`,
      weekStart,
      activeFronts: val.activeFronts,
      activeTeams: val.activeTeams,
    }));

  const peakFronts = weeklyHistogram.reduce((m, w) => Math.max(m, w.activeFronts), 0);
  const peakTeams = weeklyHistogram.reduce((m, w) => Math.max(m, w.activeTeams), 0);

  return {
    startDate: Number.isFinite(minTs) ? toIsoDateKeyUTC(new Date(minTs)) : null,
    endDate: Number.isFinite(maxTs) ? toIsoDateKeyUTC(new Date(maxTs)) : null,
    totalWorkingDays: globalWorkingDays.length,
    totalMonths: monthlySeries.length,
    holidaysAppliedCount,
    peakFronts,
    peakTeams,
    totalCommercialPrice: totalCommercialRounded,
    monthlySeries,
    weeklyHistogram,
  };
}

/**
 * Auditoria Lógica do Cronograma antes do congelamento da Baseline v1.0.
 */
export function evaluateScheduleAudit(input: {
  packages: Array<{
    packageNumber: number;
    name: string;
    linkedStageCodes: string[];
    segments: Array<{ startDate: Date | string; endDate: Date | string }>;
    procurementGates: Array<{ title: string; triggerDate: Date | string; status: string }>;
  }>;
  activeStageCodesWithQty: string[];
  plannedStartDate: Date | string | null;
  weeklyHistogram: WeeklyHistogramPoint[];
}): ScheduleAuditResult {
  const criticalBlockers: string[] = [];
  const warnings: string[] = [];
  const activeStageSet = new Set(input.activeStageCodesWithQty);

  // 1. Pacotes vinculados a etapas com quantidade > 0 sem nenhum segmento alocado
  for (const pkg of input.packages) {
    const hasActiveStage = pkg.linkedStageCodes.some((c) => activeStageSet.has(c));
    if (hasActiveStage && pkg.segments.length === 0) {
      criticalBlockers.push(
        `PCT ${String(pkg.packageNumber).padStart(2, "0")} (${pkg.name}) possui quantitativo na EAP mas está sem data/trecho alocado.`
      );
    }
  }

  // 2. Inversão lógica: Guarda-Corpos (37) após Limpeza Final (38), ou Acabamento antes de Impermeabilização/Reboco
  const getMaxEndTs = (pkg?: { segments: Array<{ endDate: Date | string }> }) =>
    pkg && pkg.segments.length > 0
      ? Math.max(...pkg.segments.map((s) => parseUtcDate(s.endDate).getTime()))
      : null;
  const getMinStartTs = (pkg?: { segments: Array<{ startDate: Date | string }> }) =>
    pkg && pkg.segments.length > 0
      ? Math.min(...pkg.segments.map((s) => parseUtcDate(s.startDate).getTime()))
      : null;

  const guardaCorpo = input.packages.find((p) => /guarda[\s-]?corpo/i.test(p.name));
  const limpezaFinal = input.packages.find((p) => /limpeza\s+final/i.test(p.name));
  const gcEnd = getMaxEndTs(guardaCorpo);
  const lfStart = getMinStartTs(limpezaFinal);
  if (gcEnd !== null && lfStart !== null && gcEnd > lfStart) {
    criticalBlockers.push(
      `Inversão lógica detectada: "${guardaCorpo!.name}" termina após o início de "${limpezaFinal!.name}".`
    );
  }

  const imperm = input.packages.find((p) => p.packageNumber === 14);
  const pisoPorc = input.packages.find((p) => p.packageNumber === 25);
  const impStart = getMinStartTs(imperm);
  const porcStart = getMinStartTs(pisoPorc);
  if (impStart !== null && porcStart !== null && porcStart < impStart) {
    criticalBlockers.push(
      `Inversão lógica detectada: "${pisoPorc!.name}" inicia antes de "${imperm!.name}".`
    );
  }

  // 3. Gatilhos de compra com data anterior ao início da obra
  const startTs = input.plannedStartDate ? parseUtcDate(input.plannedStartDate).getTime() : null;
  for (const pkg of input.packages) {
    for (const gate of pkg.procurementGates) {
      if (gate.status === "COMPRADO" || gate.status === "ENTREGUE") continue;
      const trigTs = parseUtcDate(gate.triggerDate).getTime();
      if (startTs !== null && trigTs < startTs) {
        warnings.push(
          `Compra antecipada urgente (${gate.title}): data-limite ${toIsoDateKeyUTC(new Date(trigTs))} antecede o início da obra.`
        );
      }
    }
  }

  // 4. Sobrecarga simultânea (> 6 frentes na mesma semana)
  const overloaded = input.weeklyHistogram.filter((w) => w.activeFronts > 6);
  if (overloaded.length > 0) {
    warnings.push(
      `Sobrecarga potencial no canteiro: ${overloaded.length} semana(s) com mais de 6 frentes simultâneas (pico: ${Math.max(...overloaded.map((o) => o.activeFronts))} frentes).`
    );
  }

  return {
    approved: criticalBlockers.length === 0,
    criticalBlockers,
    warnings,
  };
}
