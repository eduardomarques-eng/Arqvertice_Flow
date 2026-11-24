import type { EapZoneCode } from "../templates/residential-master";

export type EapSourceSoftware = "TQS" | "REVIT" | "MANUAL";

export interface MinedEapCandidate {
  description: string;
  unit: string;
  zoneQuantities: Record<EapZoneCode, number>;
  rawCategory: string;
  eapStageCode: string;
  materialHintCode?: string | null;
  laborHintCode?: string | null;
  sourceSoftware: EapSourceSoftware;
  sourceFileId?: string | null;
  sourcePage: number;
  confidence: number; // 0..1
  isStructural: boolean;
  isDerived?: boolean;
  elementKey?: string;
  sourceUnitPrice?: number | null;
  sanityFlag?: string | null;
}

export interface ZeroSteelAlert {
  concreteM3: number;
  suggestedKg: number;
  message: string;
}

export interface ParsedDocumentResult {
  sourceSoftware: EapSourceSoftware;
  candidates: MinedEapCandidate[];
  detectedAreaM2?: number | null;
  pagesAnalyzed: number;
  notes: string[];
  carbonKgCo2?: number | null;
  zeroSteelAlert?: ZeroSteelAlert | null;
}

export function createEmptyZones(): Record<EapZoneCode, number> {
  return {
    FUND_TERREO: 0,
    PAV_SUPERIOR: 0,
    COBERTURA: 0,
    EXTERNO: 0,
  };
}

export function parseLocalizedNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\s+/g, "");
  if (!cleaned) return NaN;
  // Formato brasileiro: 1.234,56 -> 1234.56
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return Number(cleaned.replace(/\./g, "").replace(",", "."));
    }
    return Number(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", "."));
  }
  return Number(cleaned);
}

export function detectZoneFromText(text: string): EapZoneCode {
  const lower = text.toLowerCase();
  if (/cobertura|telhado|platibanda|reservat[oó]rio|barrilete|caixa\s*d/.test(lower)) {
    return "COBERTURA";
  }
  if (/superior|1[º°]?\s*pav|2[º°]?\s*pav|pav\.?\s*sup|mezanino/.test(lower)) {
    return "PAV_SUPERIOR";
  }
  if (/extern|muro|piscina|deck|cal[cç]ada|fachada|gourmet|paisag/.test(lower)) {
    return "EXTERNO";
  }
  return "FUND_TERREO";
}
