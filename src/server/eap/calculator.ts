import type { EapZoneCode } from "./templates/residential-master";

export type ZoneQuantities = Record<EapZoneCode, number>;

export interface EapCalculationLineInput {
  code?: string | null;
  stageCode?: string | null;
  category?: string | null;
  description: string;
  unit: string;
  zoneQuantities: Partial<ZoneQuantities>;
  lossPercent: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  markupMultiplier: number;
}

export interface EapCalculationLineResult {
  rawQuantity: number;
  quantityWithLoss: number;
  directUnitCost: number;
  commercialUnitPrice: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalThirdPartyCost: number;
  totalDirectCost: number;
  totalCommercialPrice: number;
}

export interface EapStageSummaryResult {
  stageCode: string;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalThirdPartyCost: number;
  totalDirectCost: number;
  totalCommercialPrice: number;
  itemsCount: number;
}

export interface EapEngineeringIndicators {
  builtAreaM2: number;
  totalDirectCost: number;
  totalCommercialPrice: number;
  directCostPerM2: number;
  commercialCostPerM2: number;
  totalSteelKg: number;
  totalConcreteM3: number;
  totalMasonryM2: number;
  steelRateKgPerM3: number;
  concreteM3PerM2: number;
  masonryM2PerM2: number;
}

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function sumZoneQuantities(zones: Partial<ZoneQuantities>): number {
  return round4(
    Math.max(0, safeNumber(zones.FUND_TERREO)) +
      Math.max(0, safeNumber(zones.PAV_SUPERIOR)) +
      Math.max(0, safeNumber(zones.COBERTURA)) +
      Math.max(0, safeNumber(zones.EXTERNO))
  );
}

export function computeEapLine(input: EapCalculationLineInput): EapCalculationLineResult {
  const rawQuantity = sumZoneQuantities(input.zoneQuantities);
  const lossFactor = 1 + Math.max(0, safeNumber(input.lossPercent)) / 100;
  const quantityWithLoss = round4(rawQuantity * lossFactor);

  const matUnit = Math.max(0, safeNumber(input.materialUnitCost));
  const labUnit = Math.max(0, safeNumber(input.laborUnitCost));
  const thirdUnit = Math.max(0, safeNumber(input.thirdPartyUnitCost));
  const markup = Math.max(0, safeNumber(input.markupMultiplier || 1));

  const directUnitCost = round2(matUnit + labUnit + thirdUnit);
  const commercialUnitPrice = round2(directUnitCost * markup);

  const totalMaterialCost = round2(quantityWithLoss * matUnit);
  const totalLaborCost = round2(quantityWithLoss * labUnit);
  const totalThirdPartyCost = round2(quantityWithLoss * thirdUnit);
  const totalDirectCost = round2(totalMaterialCost + totalLaborCost + totalThirdPartyCost);
  const totalCommercialPrice = round2(totalDirectCost * markup);

  return {
    rawQuantity,
    quantityWithLoss,
    directUnitCost,
    commercialUnitPrice,
    totalMaterialCost,
    totalLaborCost,
    totalThirdPartyCost,
    totalDirectCost,
    totalCommercialPrice,
  };
}

export function computeEapStageSummary(
  stageCode: string,
  lines: EapCalculationLineInput[]
): EapStageSummaryResult {
  let totalMaterialCost = 0;
  let totalLaborCost = 0;
  let totalThirdPartyCost = 0;
  let totalDirectCost = 0;
  let totalCommercialPrice = 0;

  for (const line of lines) {
    const calc = computeEapLine(line);
    totalMaterialCost += calc.totalMaterialCost;
    totalLaborCost += calc.totalLaborCost;
    totalThirdPartyCost += calc.totalThirdPartyCost;
    totalDirectCost += calc.totalDirectCost;
    totalCommercialPrice += calc.totalCommercialPrice;
  }

  return {
    stageCode,
    totalMaterialCost: round2(totalMaterialCost),
    totalLaborCost: round2(totalLaborCost),
    totalThirdPartyCost: round2(totalThirdPartyCost),
    totalDirectCost: round2(totalDirectCost),
    totalCommercialPrice: round2(totalCommercialPrice),
    itemsCount: lines.length,
  };
}

function isSteelLine(line: EapCalculationLineInput): boolean {
  const cat = (line.category || "").toUpperCase();
  const unit = line.unit.trim().toLowerCase();
  const desc = line.description.toLowerCase();
  return unit === "kg" && (cat === "ACO" || /a[çc]o|ca-?50|ca-?60|armadura|arma[çc][ãa]o/.test(desc));
}

function isConcreteLine(line: EapCalculationLineInput): boolean {
  const cat = (line.category || "").toUpperCase();
  const unit = line.unit.trim().toLowerCase();
  const desc = line.description.toLowerCase();
  return (unit === "m³" || unit === "m3") && (cat === "CONCRETO" || /concreto/.test(desc));
}

function isMasonryLine(line: EapCalculationLineInput): boolean {
  const cat = (line.category || "").toUpperCase();
  const unit = line.unit.trim().toLowerCase();
  const desc = line.description.toLowerCase();
  return (unit === "m²" || unit === "m2") && (cat === "ALVENARIA" || /alvenaria|bloco cer[âa]mico|tjc|tjm|cbg/.test(desc));
}

/**
 * Calcula indicadores ponderados de engenharia (evitando médias simples incorretas de planilhas):
 * - Taxa de Aço ponderada = Soma(kg de Aço) / Soma(m³ de Concreto)
 * - Concreto/m² = Soma(m³ de Concreto) / Área Construída
 * - Alvenaria/m² = Soma(m² de Alvenaria) / Área Construída
 */
export function computeEapEngineeringIndicators(
  lines: EapCalculationLineInput[],
  builtAreaM2: number
): EapEngineeringIndicators {
  const area = Math.max(0, safeNumber(builtAreaM2));
  let totalDirectCost = 0;
  let totalCommercialPrice = 0;
  let totalSteelKg = 0;
  let totalConcreteM3 = 0;
  let totalMasonryM2 = 0;

  for (const line of lines) {
    const calc = computeEapLine(line);
    totalDirectCost += calc.totalDirectCost;
    totalCommercialPrice += calc.totalCommercialPrice;

    if (isSteelLine(line)) {
      totalSteelKg += calc.quantityWithLoss;
    } else if (isConcreteLine(line)) {
      totalConcreteM3 += calc.quantityWithLoss;
    } else if (isMasonryLine(line)) {
      totalMasonryM2 += calc.quantityWithLoss;
    }
  }

  return {
    builtAreaM2: round2(area),
    totalDirectCost: round2(totalDirectCost),
    totalCommercialPrice: round2(totalCommercialPrice),
    directCostPerM2: area > 0 ? round2(totalDirectCost / area) : 0,
    commercialCostPerM2: area > 0 ? round2(totalCommercialPrice / area) : 0,
    totalSteelKg: round2(totalSteelKg),
    totalConcreteM3: round2(totalConcreteM3),
    totalMasonryM2: round2(totalMasonryM2),
    steelRateKgPerM3: totalConcreteM3 > 0 ? round2(totalSteelKg / totalConcreteM3) : 0,
    concreteM3PerM2: area > 0 ? round4(totalConcreteM3 / area) : 0,
    masonryM2PerM2: area > 0 ? round4(totalMasonryM2 / area) : 0,
  };
}

/**
 * Duração em dias úteis: ceil(Qtd / (ProdutividadeDiariaPorEquipe * NumeroEquipes))
 */
export function computeWorkingDaysDuration(
  quantity: number,
  dailyProductivityPerTeam: number,
  teamsCount = 1
): number {
  const qty = Math.max(0, safeNumber(quantity));
  const prod = safeNumber(dailyProductivityPerTeam);
  const teams = Math.max(1, Math.floor(safeNumber(teamsCount) || 1));
  if (qty <= 0 || prod <= 0) return 0;
  return Math.max(1, Math.ceil(qty / (prod * teams)));
}

export function toIsoDateKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isNonWorkingDayUTC(date: Date, holidaySet: Set<string>): boolean {
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return true; // Domingo (0) ou Sábado (6)
  return holidaySet.has(toIsoDateKeyUTC(date));
}

/**
 * Soma `workingDays` dias úteis a partir de `startDate` (inclusive se o 1º dia for útil),
 * pulando sábados, domingos e feriados municipais/estaduais/nacionais (`CityHoliday`).
 */
export function addWorkingDays(
  startDate: Date,
  workingDays: number,
  holidays: Array<Date | string> = []
): Date {
  const holidaySet = new Set(
    holidays.map((h) => (typeof h === "string" ? h.slice(0, 10) : toIsoDateKeyUTC(h)))
  );
  const cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
  );

  // Garante que o início cai em dia útil
  while (isNonWorkingDayUTC(cursor, holidaySet)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const totalDays = Math.max(1, Math.floor(safeNumber(workingDays)));
  let counted = 1;
  while (counted < totalDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isNonWorkingDayUTC(cursor, holidaySet)) {
      counted += 1;
    }
  }

  return cursor;
}
