import type { EapZoneCode } from "../templates/residential-master";
import {
  createEmptyZones,
  parseLocalizedNumber,
  type MinedEapCandidate,
  type ParsedDocumentResult,
  type ZeroSteelAlert,
} from "./types";

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&aacute;/gi, "á")
    .replace(/&agrave;/gi, "à")
    .replace(/&acirc;/gi, "â")
    .replace(/&atilde;/gi, "ã")
    .replace(/&eacute;/gi, "é")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&otilde;/gi, "õ")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ccedil;/gi, "Ç")
    .replace(/&sup2;/gi, "²")
    .replace(/&sup3;/gi, "³")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtmlTags(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, " "));
}

export function extractHtmlTables(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableMatches = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
  for (const tbl of tableMatches) {
    const rows: string[][] = [];
    const trMatches = tbl.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
    for (const tr of trMatches) {
      const cells: string[] = [];
      const cellMatches = tr.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
      for (const cell of cellMatches) {
        cells.push(stripHtmlTags(cell));
      }
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }
    if (rows.length > 0) {
      tables.push(rows);
    }
  }
  return tables;
}

function mapTqsFloorToZone(floorText: string): { zone: EapZoneCode; isFoundation: boolean } {
  const lower = floorText.toLowerCase();
  if (/piso\s*0|funda[çc]|sapata|baldrame|infra/i.test(lower)) {
    return { zone: "FUND_TERREO", isFoundation: true };
  }
  if (/piso\s*1|t[eé]rreo|terreo/i.test(lower)) {
    return { zone: "FUND_TERREO", isFoundation: false };
  }
  if (/piso\s*2|pav[_\s.-]*sup|superior/i.test(lower)) {
    return { zone: "PAV_SUPERIOR", isFoundation: false };
  }
  if (/piso\s*3|cobert|telhad|reservat/i.test(lower)) {
    return { zone: "COBERTURA", isFoundation: false };
  }
  return { zone: "FUND_TERREO", isFoundation: false };
}

function mapFckToCode(fck: number, isFoundation: boolean): string {
  if (fck <= 15 && isFoundation) return "CONC-MAGRO";
  if (fck >= 35) return "CONC-FCK35";
  if (fck >= 30) return "CONC-FCK30";
  return "CONC-FCK25";
}

function mapDiameterToCode(rawDiameter: string): string {
  const norm = rawDiameter.replace(",", ".");
  const num = Number(norm);
  if (num <= 5.0) return "ACO-CA60-50";
  if (num <= 6.3) return "ACO-CA50-63";
  if (num <= 8.0) return "ACO-CA50-80";
  if (num <= 10.0) return "ACO-CA50-100";
  if (num <= 12.5) return "ACO-CA50-125";
  if (num <= 16.0) return "ACO-CA50-160";
  return "ACO-CA50-200";
}

function parsePriceCell(cell: string): number | null {
  if (!cell) return null;
  const cleaned = cell.replace(/R\$/gi, "").trim();
  if (!/\d/.test(cleaned)) return null;
  const num = parseLocalizedNumber(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Parser estruturado para relatórios HTML/HTM gerados pelo TQS (padrão RESDES.HTM).
 */
export function parseTqsHtml(html: string, sourceFileId?: string | null): ParsedDocumentResult {
  const tables = extractHtmlTables(html);
  const fullText = stripHtmlTags(html);
  const notes: string[] = [];

  let detectedAreaM2: number | null = null;
  let carbonKgCo2: number | null = null;

  // Mapas agregados por chave para manter soma exata entre pisos / resumo
  const concreteByFckZone = new Map<
    string,
    { fck: number; zone: EapZoneCode; isFoundation: boolean; volume: number; unitPrice: number | null }
  >();
  let formWorkZones = createEmptyZones();
  let formWorkTotal = 0;
  let formWorkUnitPrice: number | null = null;
  let hasFoundationForm = false;

  const principalSteelByDiam = new Map<
    string,
    { diam: string; grade: string; kg: number; zone: EapZoneCode; isFoundation: boolean; unitPrice: number | null }
  >();
  let totalPrincipalSteelKg = 0;

  const epsByModel = new Map<string, { model: string; qty: number; zone: EapZoneCode; unitPrice: number | null }>();
  const joistsByModel = new Map<string, { model: string; meters: number; zone: EapZoneCode; unitPrice: number | null }>();
  const complementarySteelBySpec = new Map<
    string,
    { spec: string; kg: number; zone: EapZoneCode; unitPrice: number | null }
  >();

  let currentZone: EapZoneCode = "FUND_TERREO";
  let currentIsFoundation = false;

  // 1. Varre tabelas procurando pisos, concreto, fôrma, aço, EPS, vigotas, área e carbono
  for (const table of tables) {
    for (const row of table) {
      const joined = row.join(" | ").trim();
      if (!joined) continue;

      // Cabeçalho de Piso (ex.: "Piso 0: Fundacao", "Piso 1: Terreo", "Piso 2: Pav_Superior", "Piso 3: Coberta")
      if (/\bPiso\s*\d+\s*:/i.test(joined)) {
        const mapped = mapTqsFloorToZone(joined);
        currentZone = mapped.zone;
        currentIsFoundation = mapped.isFoundation;
      }

      // Área estrutural
      const areaMatch = joined.match(/[áa]rea\s*(?:estrutural|total|de\s*forma|constru[íi]da)?\s*[:|]?\s*(\d[\d.,]*)\s*(?:m²|m2)/i);
      if (areaMatch && !/f[ôo]rma/i.test(joined)) {
        const a = parseLocalizedNumber(areaMatch[1]);
        if (Number.isFinite(a) && a > 0 && (detectedAreaM2 === null || a > detectedAreaM2)) {
          detectedAreaM2 = a;
        }
      }

      // Carbono incorporado (kgCO2)
      const co2Match = joined.match(/carbono\s*(?:incorporado)?.*?(\d[\d.,]*)\s*(?:kg\s*co2|kgco2|t\s*co2)/i);
      if (co2Match) {
        const val = parseLocalizedNumber(co2Match[1]);
        if (Number.isFinite(val) && val > 0) {
          carbonKgCo2 = /t\s*co2/i.test(joined) ? val * 1000 : val;
        }
      }

      const firstCell = row[0] ?? "";
      const rowLower = joined.toLowerCase();

      // Concreto por fck (C20..C40)
      const fckMatch = firstCell.match(/concreto.*?\bC\s*-?\s*(\d{2})\b/i) ?? joined.match(/\bconcreto\b.*?\b(?:C|fck\s*[=:]?\s*)(\d{2})\b/i);
      if (fckMatch && !/total\s+geral/i.test(rowLower)) {
        const fck = Number(fckMatch[1]);
        if (fck >= 15 && fck <= 50) {
          // Procura coluna de volume (m³) ou número decimal após a descrição
          let vol = NaN;
          let price: number | null = null;
          for (let i = 1; i < row.length; i++) {
            const c = row[i];
            if (!c) continue;
            if (/r\$/i.test(c) || (i === row.length - 1 && row.length >= 4 && Number.isFinite(vol))) {
              price = parsePriceCell(c) ?? price;
              continue;
            }
            const parsed = parseLocalizedNumber(c.replace(/\s*(?:m³|m3)\s*$/i, ""));
            if (Number.isFinite(parsed) && parsed > 0 && Number.isNaN(vol)) {
              vol = parsed;
            }
          }
          if (Number.isFinite(vol) && vol > 0) {
            const key = `${fck}:${currentZone}:${currentIsFoundation ? "F" : "S"}`;
            const prev = concreteByFckZone.get(key);
            concreteByFckZone.set(key, {
              fck,
              zone: currentZone,
              isFoundation: currentIsFoundation,
              volume: (prev?.volume ?? 0) + vol,
              unitPrice: price ?? prev?.unitPrice ?? null,
            });
            continue;
          }
        }
      }

      // Fôrma de madeira (m²)
      if (/(?:f[ôo]rma\s+de\s+madeira|f[ôo]rmas?\s+total|forma\s*\(m)/i.test(firstCell) || (/^f[ôo]rmas?$/i.test(firstCell.trim()))) {
        let area = NaN;
        let price: number | null = null;
        for (let i = 1; i < row.length; i++) {
          const c = row[i];
          if (!c) continue;
          if (/r\$/i.test(c) || (i >= 2 && Number.isFinite(area) && price === null)) {
            const p = parsePriceCell(c);
            if (p !== null && p !== area) {
              price = p;
              continue;
            }
          }
          const parsed = parseLocalizedNumber(c.replace(/\s*(?:m²|m2)\s*$/i, ""));
          if (Number.isFinite(parsed) && parsed > 0 && Number.isNaN(area)) {
            area = parsed;
          }
        }
        if (Number.isFinite(area) && area > 0) {
          formWorkZones[currentZone] += area;
          formWorkTotal += area;
          if (currentIsFoundation) hasFoundationForm = true;
          if (price !== null) formWorkUnitPrice = price;
          continue;
        }
      }

      // Formas / Blocos de Nervuras EPS (ex.: "Forma EPS H12/40/120" ou "EPS H12/50/120")
      const epsMatch = joined.match(/(?:forma\s*(?:de\s*)?nervura|eps|enchimento\s*eps).*?(H\d+\/\d+\/\d+)/i);
      if (epsMatch) {
        const model = epsMatch[1].toUpperCase();
        let qty = NaN;
        let price: number | null = null;
        for (let i = 1; i < row.length; i++) {
          const c = row[i];
          if (!c) continue;
          if (/r\$/i.test(c)) {
            price = parsePriceCell(c) ?? price;
            continue;
          }
          const parsed = parseLocalizedNumber(c.replace(/\s*(?:unid|un|pç)\s*$/i, ""));
          if (Number.isFinite(parsed) && parsed > 0 && Number.isNaN(qty)) {
            qty = parsed;
          }
        }
        if (Number.isFinite(qty) && qty > 0) {
          const key = `${model}:${currentZone}`;
          const prev = epsByModel.get(key);
          epsByModel.set(key, {
            model,
            zone: currentZone,
            qty: (prev?.qty ?? 0) + qty,
            unitPrice: price ?? prev?.unitPrice ?? null,
          });
          continue;
        }
      }

      // Vigotas treliçadas (ex.: "Vigota Treliçada TR12645" -> m)
      const joistMatch = joined.match(/(?:vigota\s*treli[çc]ada|treli[çc]a).*?(TR\s*\d{4,6})/i);
      if (joistMatch) {
        const model = joistMatch[1].replace(/\s+/g, "").toUpperCase();
        let meters = NaN;
        let price: number | null = null;
        for (let i = 1; i < row.length; i++) {
          const c = row[i];
          if (!c) continue;
          if (/r\$/i.test(c)) {
            price = parsePriceCell(c) ?? price;
            continue;
          }
          const parsed = parseLocalizedNumber(c.replace(/\s*(?:m|ml)\s*$/i, ""));
          if (Number.isFinite(parsed) && parsed > 0 && Number.isNaN(meters)) {
            meters = parsed;
          }
        }
        if (Number.isFinite(meters) && meters > 0) {
          const key = `${model}:${currentZone}`;
          const prev = joistsByModel.get(key);
          joistsByModel.set(key, {
            model,
            zone: currentZone,
            meters: (prev?.meters ?? 0) + meters,
            unitPrice: price ?? prev?.unitPrice ?? null,
          });
          continue;
        }
      }

      // Aço complementar / treliça (50A / 60A)
      const compSteelMatch = joined.match(/(?:a[çc]o\s*complementar|armadura\s*complementar).*?(50\s*A|60\s*A|CA-?50|CA-?60)?/i);
      if (compSteelMatch && /complementar/i.test(joined)) {
        const spec = (compSteelMatch[1] || "50A/60A").replace(/\s+/g, "").toUpperCase();
        let kg = NaN;
        let price: number | null = null;
        for (let i = 1; i < row.length; i++) {
          const c = row[i];
          if (!c) continue;
          if (/r\$/i.test(c)) {
            price = parsePriceCell(c) ?? price;
            continue;
          }
          const parsed = parseLocalizedNumber(c.replace(/\s*kg\s*$/i, ""));
          if (Number.isFinite(parsed) && parsed > 0 && Number.isNaN(kg)) {
            kg = parsed;
          }
        }
        if (Number.isFinite(kg) && kg > 0) {
          const key = `${spec}:${currentZone}`;
          const prev = complementarySteelBySpec.get(key);
          complementarySteelBySpec.set(key, {
            spec,
            zone: currentZone,
            kg: (prev?.kg ?? 0) + kg,
            unitPrice: price ?? prev?.unitPrice ?? null,
          });
          continue;
        }
      }

      // Aço principal por bitola (3.2 a 40 mm)
      const steelDiamMatch = firstCell.match(/(?:Ø|bitola|a[çc]o|CA-?50|CA-?60)\s*(\d{1,2}(?:[.,]\d)?)\s*(?:mm)?/i);
      if (steelDiamMatch && !/complementar/i.test(rowLower)) {
        const rawDiam = steelDiamMatch[1].replace(",", ".");
        const diamNum = Number(rawDiam);
        if (diamNum >= 3.2 && diamNum <= 40) {
          const grade = /60/i.test(firstCell) || diamNum <= 5 ? "CA-60" : "CA-50";
          let kg = NaN;
          let price: number | null = null;
          for (let i = 1; i < row.length; i++) {
            const c = row[i];
            if (!c) continue;
            if (/r\$/i.test(c)) {
              price = parsePriceCell(c) ?? price;
              continue;
            }
            const parsed = parseLocalizedNumber(c.replace(/\s*kg\s*$/i, ""));
            if (Number.isFinite(parsed) && parsed >= 0 && Number.isNaN(kg)) {
              kg = parsed;
            }
          }
          if (Number.isFinite(kg) && kg > 0) {
            totalPrincipalSteelKg += kg;
            const key = `${rawDiam}:${grade}:${currentZone}`;
            const prev = principalSteelByDiam.get(key);
            principalSteelByDiam.set(key, {
              diam: rawDiam,
              grade,
              kg: (prev?.kg ?? 0) + kg,
              zone: currentZone,
              isFoundation: currentIsFoundation,
              unitPrice: price ?? prev?.unitPrice ?? null,
            });
          }
        }
      }
    }
  }

  // Fallback para área e carbono incorporado no texto completo caso não estejam em células tabulares
  if (detectedAreaM2 === null) {
    const areaFullMatch = fullText.match(/[áa]rea\s*(?:estrutural|total|constru[íi]da)\s*[:\-|]?\s*(\d[\d.,]*)\s*(?:m²|m2)/i);
    if (areaFullMatch) {
      const a = parseLocalizedNumber(areaFullMatch[1]);
      if (Number.isFinite(a) && a > 0) detectedAreaM2 = a;
    }
  }
  if (carbonKgCo2 === null) {
    const m = fullText.match(/carbono\s*(?:incorporado)?\s*[:\-]?\s*(\d[\d.,]*)\s*kg\s*co2/i);
    if (m) {
      const v = parseLocalizedNumber(m[1]);
      if (Number.isFinite(v) && v > 0) carbonKgCo2 = v;
    }
  }

  const candidates: MinedEapCandidate[] = [];
  let totalConcreteM3 = 0;

  for (const entry of concreteByFckZone.values()) {
    totalConcreteM3 += entry.volume;
    const zones = createEmptyZones();
    zones[entry.zone] = Math.round(entry.volume * 1000) / 1000;
    const stageCode = entry.isFoundation ? "03" : "04";
    candidates.push({
      description: `Concreto Estrutural C${entry.fck} / fck ${entry.fck} MPa (${entry.isFoundation ? "Fundações" : "Supraestrutura"} — TQS HTML)`,
      unit: "m³",
      zoneQuantities: zones,
      rawCategory: "CONCRETO",
      eapStageCode: stageCode,
      materialHintCode: mapFckToCode(entry.fck, entry.isFoundation),
      laborHintCode: "MO-CONCRETAGEM",
      sourceSoftware: "TQS",
      sourceFileId: sourceFileId ?? null,
      sourcePage: 1,
      confidence: 0.96,
      isStructural: true,
      sourceUnitPrice: entry.unitPrice,
      elementKey: `TQS_HTML:CONC:${entry.fck}:${stageCode}:${entry.zone}`,
    });
  }

  if (formWorkTotal > 0) {
    const stageCode = hasFoundationForm && formWorkZones.PAV_SUPERIOR === 0 && formWorkZones.COBERTURA === 0 ? "03" : "04";
    candidates.push({
      description: "Fôrmas de Madeira (TQS RESDES.HTM)",
      unit: "m²",
      zoneQuantities: {
        FUND_TERREO: Math.round(formWorkZones.FUND_TERREO * 100) / 100,
        PAV_SUPERIOR: Math.round(formWorkZones.PAV_SUPERIOR * 100) / 100,
        COBERTURA: Math.round(formWorkZones.COBERTURA * 100) / 100,
        EXTERNO: Math.round(formWorkZones.EXTERNO * 100) / 100,
      },
      rawCategory: "FORMAS",
      eapStageCode: stageCode,
      materialHintCode: "FORM-MAD-COMP",
      laborHintCode: "MO-CARPINTEIRO",
      sourceSoftware: "TQS",
      sourceFileId: sourceFileId ?? null,
      sourcePage: 1,
      confidence: 0.95,
      isStructural: true,
      sourceUnitPrice: formWorkUnitPrice,
      elementKey: `TQS_HTML:FORMAS:${stageCode}`,
    });
  }

  for (const entry of principalSteelByDiam.values()) {
    const zones = createEmptyZones();
    zones[entry.zone] = Math.round(entry.kg * 100) / 100;
    const stageCode = entry.isFoundation ? "03" : "04";
    candidates.push({
      description: `Aço Principal ${entry.grade} Ø ${entry.diam.replace(".", ",")} mm (TQS HTML)`,
      unit: "kg",
      zoneQuantities: zones,
      rawCategory: "ACO",
      eapStageCode: stageCode,
      materialHintCode: mapDiameterToCode(entry.diam),
      laborHintCode: "MO-ARMADOR",
      sourceSoftware: "TQS",
      sourceFileId: sourceFileId ?? null,
      sourcePage: 1,
      confidence: 0.96,
      isStructural: true,
      sourceUnitPrice: entry.unitPrice,
      elementKey: `TQS_HTML:ACO:${entry.grade}:${entry.diam}:${entry.zone}`,
    });
  }

  for (const entry of epsByModel.values()) {
    const zones = createEmptyZones();
    zones[entry.zone] = Math.round(entry.qty);
    candidates.push({
      description: `Bloco Enchimento Nervura EPS ${entry.model} (Laje Nervurada TQS)`,
      unit: "unid",
      zoneQuantities: zones,
      rawCategory: "LAJE_EPS",
      eapStageCode: "04",
      materialHintCode: "LAJE-EPS-H12",
      laborHintCode: "MO-PEDREIRO-EQ",
      sourceSoftware: "TQS",
      sourceFileId: sourceFileId ?? null,
      sourcePage: 1,
      confidence: 0.95,
      isStructural: true,
      sourceUnitPrice: entry.unitPrice,
      elementKey: `TQS_HTML:EPS:${entry.model}:${entry.zone}`,
    });
  }

  for (const entry of joistsByModel.values()) {
    const zones = createEmptyZones();
    zones[entry.zone] = Math.round(entry.meters * 100) / 100;
    candidates.push({
      description: `Vigota Treliçada Pré-Moldada ${entry.model} (TQS)`,
      unit: "m",
      zoneQuantities: zones,
      rawCategory: "VIGOTA_TRELICADA",
      eapStageCode: "04",
      materialHintCode: "LAJE-VIGOTA-TR",
      laborHintCode: "MO-PEDREIRO-EQ",
      sourceSoftware: "TQS",
      sourceFileId: sourceFileId ?? null,
      sourcePage: 1,
      confidence: 0.95,
      isStructural: true,
      sourceUnitPrice: entry.unitPrice,
      elementKey: `TQS_HTML:VIGOTA:${entry.model}:${entry.zone}`,
    });
  }

  for (const entry of complementarySteelBySpec.values()) {
    const zones = createEmptyZones();
    zones[entry.zone] = Math.round(entry.kg * 100) / 100;
    candidates.push({
      description: `Aço Complementar Laje/Armadura ${entry.spec} (TQS)`,
      unit: "kg",
      zoneQuantities: zones,
      rawCategory: "ACO_COMPLEMENTAR",
      eapStageCode: "04",
      materialHintCode: "ACO-CA50-63",
      laborHintCode: "MO-ARMADOR",
      sourceSoftware: "TQS",
      sourceFileId: sourceFileId ?? null,
      sourcePage: 1,
      confidence: 0.94,
      isStructural: true,
      sourceUnitPrice: entry.unitPrice,
      elementKey: `TQS_HTML:ACO_COMP:${entry.spec}:${entry.zone}`,
    });
  }

  // Auditoria inteligente: Aço Principal zerado com Concreto > 0
  let zeroSteelAlert: ZeroSteelAlert | null = null;
  if (totalConcreteM3 > 0 && totalPrincipalSteelKg <= 0) {
    const suggestedKg = Math.round(totalConcreteM3 * 85);
    const message = `Quantitativo TQS preliminar sem detalhamento de aço principal — estimativa sugerida: 85 kg/m³ (${suggestedKg} kg para ${totalConcreteM3.toFixed(2)} m³).`;
    zeroSteelAlert = {
      concreteM3: Math.round(totalConcreteM3 * 100) / 100,
      suggestedKg,
      message,
    };
    notes.push(message);
    for (const c of candidates) {
      if (c.rawCategory === "CONCRETO") {
        c.sanityFlag = message;
      }
    }
  }

  if (carbonKgCo2 !== null) {
    notes.push(`Carbono incorporado detectado no TQS: ${carbonKgCo2.toLocaleString("pt-BR")} kgCO2.`);
  }

  return {
    sourceSoftware: "TQS",
    candidates,
    detectedAreaM2,
    pagesAnalyzed: tables.length || 1,
    notes,
    carbonKgCo2,
    zeroSteelAlert,
  };
}
