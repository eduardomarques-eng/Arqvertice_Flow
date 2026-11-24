import type { ExtractedPdfPage } from "../pdf-reader";
import {
  createEmptyZones,
  detectZoneFromText,
  parseLocalizedNumber,
  type MinedEapCandidate,
  type ParsedDocumentResult,
} from "./types";

const BITOLA_TO_MATERIAL_CODE: Record<string, string> = {
  "5.0": "ACO-CA60-50",
  "5": "ACO-CA60-50",
  "6.3": "ACO-CA50-63",
  "8.0": "ACO-CA50-80",
  "8": "ACO-CA50-80",
  "10.0": "ACO-CA50-100",
  "10": "ACO-CA50-100",
  "12.5": "ACO-CA50-125",
  "16.0": "ACO-CA50-160",
  "16": "ACO-CA50-160",
  "20.0": "ACO-CA50-200",
  "20": "ACO-CA50-200",
  "25.0": "ACO-CA50-200",
  "25": "ACO-CA50-200",
};

function mapFckToMaterialCode(fck: number, isFoundation: boolean): string {
  if (fck <= 15 && isFoundation) return "CONC-MAGRO";
  if (fck >= 35) return "CONC-FCK35";
  if (fck >= 30) return "CONC-FCK30";
  return "CONC-FCK25";
}

function isFoundationLine(line: string): boolean {
  return /funda[çc]|sapata|bloco\s+de\s+coroamento|estaca|fuste|baldrame|cinta|infraestrutura|lastro/i.test(line);
}

/**
 * Parser especializado para relatórios e pranchas estruturais do TQS:
 * 1. Resumo de Aço CA-50/CA-60 por bitola (5.0 a 25.0 mm) e peça/pavimento
 * 2. Resumo de Concreto (m³ por fck) e Fôrmas (m²) separados por fundação (03) e supraestrutura (04)
 * 3. Derivação parametrizada de Movimento de Terra (02) a partir do volume de fundação
 */
export function parseTqsPages(
  pages: ExtractedPdfPage[],
  sourceFileId?: string | null
): ParsedDocumentResult {
  const candidates: MinedEapCandidate[] = [];
  const notes: string[] = [];
  let foundationConcreteM3 = 0;

  for (const page of pages) {
    const lines = page.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let currentZone = detectZoneFromText(page.text);
    let currentIsFoundation = false;

    for (const line of lines) {
      // Atualiza contexto de pavimento / zona quando encontra cabeçalho
      if (/^(pavimento|n[ií]vel|zona|etapa|pe[çc]a)\s*[:\-]/i.test(line)) {
        currentZone = detectZoneFromText(line);
        currentIsFoundation = isFoundationLine(line);
      }

      const lineZone = /t[eé]rreo|superior|cobertura|reservat|extern|funda|sapata|baldrame/i.test(line)
        ? detectZoneFromText(line)
        : currentZone;
      const lineFoundation = isFoundationLine(line) || currentIsFoundation;

      // 1. RESUMO DE AÇO (ex.: "CA-50 10.0 mm ... 1.245,50 kg" ou "Ø 12,5 mm - Pilares: 840 kg")
      const steelMatch = line.match(
        /(?:(CA-?50|CA-?60)|(?:Ø|bitola|a[çc]o|ferragem))\s*(?:Ø\s*)?(\d{1,2}(?:[.,]\d)?)\s*(?:mm)?\b.*?(\d[\d.,]*)\s*kg\b/i
      );
      if (steelMatch) {
        const grade = (steelMatch[1] || (steelMatch[2].startsWith("5") ? "CA-60" : "CA-50")).toUpperCase();
        const rawBitola = steelMatch[2].replace(",", ".");
        const bitolaKey = rawBitola.includes(".") ? rawBitola : `${rawBitola}.0`;
        const kg = parseLocalizedNumber(steelMatch[3]);
        if (Number.isFinite(kg) && kg > 0) {
          const zones = createEmptyZones();
          zones[lineZone] = kg;
          const stageCode = lineFoundation ? "03" : "04";
          const matCode = BITOLA_TO_MATERIAL_CODE[rawBitola] ?? BITOLA_TO_MATERIAL_CODE[bitolaKey] ?? "ACO-CA50-100";
          candidates.push({
            description: `Aço ${grade} Ø ${bitolaKey.replace(".", ",")} mm (${lineFoundation ? "Fundação" : "Supraestrutura"} — TQS)`,
            unit: "kg",
            zoneQuantities: zones,
            rawCategory: "ACO",
            eapStageCode: stageCode,
            materialHintCode: matCode,
            laborHintCode: "MO-ARMADOR",
            sourceSoftware: "TQS",
            sourceFileId: sourceFileId ?? null,
            sourcePage: page.pageNumber,
            confidence: 0.94,
            isStructural: true,
            elementKey: `TQS:ACO:${grade}:${bitolaKey}:${stageCode}:${lineZone}`,
          });
          continue;
        }
      }

      // 2. RESUMO DE CONCRETO (ex.: "Concreto fck 30 MPa - Vigas/Lajes: 42,50 m³")
      const concreteMatch = line.match(
        /concreto.*?(?:fck\s*[=:]?\s*(\d{2})\s*mpa)?.*?(\d[\d.,]*)\s*(?:m³|m3)(?![a-zA-Z0-9²³])/i
      );
      if (concreteMatch) {
        const fck = concreteMatch[1] ? Number(concreteMatch[1]) : 30;
        const volume = parseLocalizedNumber(concreteMatch[2]);
        if (Number.isFinite(volume) && volume > 0) {
          const zones = createEmptyZones();
          zones[lineZone] = volume;
          const stageCode = lineFoundation ? "03" : "04";
          if (lineFoundation) {
            foundationConcreteM3 += volume;
          }
          candidates.push({
            description: `Concreto Usinado fck ${fck} MPa (${lineFoundation ? "Fundações" : "Supraestrutura"} — TQS)`,
            unit: "m³",
            zoneQuantities: zones,
            rawCategory: "CONCRETO",
            eapStageCode: stageCode,
            materialHintCode: mapFckToMaterialCode(fck, lineFoundation),
            laborHintCode: "MO-CONCRETAGEM",
            sourceSoftware: "TQS",
            sourceFileId: sourceFileId ?? null,
            sourcePage: page.pageNumber,
            confidence: 0.93,
            isStructural: true,
            elementKey: `TQS:CONCRETO:${fck}:${stageCode}:${lineZone}`,
          });
          continue;
        }
      }

      // 3. RESUMO DE FÔRMAS (ex.: "Área de Fôrmas - Pilares e Vigas: 310,00 m²")
      const formMatch = line.match(
        /f[ôo]rmas?.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i
      );
      if (formMatch) {
        const area = parseLocalizedNumber(formMatch[1]);
        if (Number.isFinite(area) && area > 0) {
          const zones = createEmptyZones();
          zones[lineZone] = area;
          const stageCode = lineFoundation ? "03" : "04";
          candidates.push({
            description: `Fôrmas de Madeira (${lineFoundation ? "Fundações/Baldrames" : "Supraestrutura"} — TQS)`,
            unit: "m²",
            zoneQuantities: zones,
            rawCategory: "FORMAS",
            eapStageCode: stageCode,
            materialHintCode: "FORM-MAD-COMP",
            laborHintCode: "MO-CARPINTEIRO",
            sourceSoftware: "TQS",
            sourceFileId: sourceFileId ?? null,
            sourcePage: page.pageNumber,
            confidence: 0.9,
            isStructural: true,
            elementKey: `TQS:FORMAS:${stageCode}:${lineZone}`,
          });
        }
      }
    }
  }

  // 4. DERIVAÇÃO PARAMETRIZADA DE MOVIMENTO DE TERRA (Etapa 02) a partir das fundações TQS
  if (foundationConcreteM3 > 0) {
    const escavacaoM3 = Math.round(foundationConcreteM3 * 2.8 * 100) / 100;
    const reaterroM3 = Math.round(foundationConcreteM3 * 1.6 * 100) / 100;
    const botaForaM3 = Math.round((escavacaoM3 - reaterroM3) * 1.3 * 100) / 100; // empolamento 30%

    const zEsc = createEmptyZones();
    zEsc.FUND_TERREO = escavacaoM3;
    const zReat = createEmptyZones();
    zReat.FUND_TERREO = reaterroM3;
    const zBota = createEmptyZones();
    zBota.FUND_TERREO = botaForaM3;

    candidates.push(
      {
        description: "Escavação Mecanizada/Manual de Valas e Fundações (Derivado TQS)",
        unit: "m³",
        zoneQuantities: zEsc,
        rawCategory: "TERRAPLENAGEM",
        eapStageCode: "02",
        laborHintCode: "MO-PEDREIRO-EQ",
        sourceSoftware: "TQS",
        sourceFileId: sourceFileId ?? null,
        sourcePage: 1,
        confidence: 0.78,
        isStructural: true,
        isDerived: true,
        elementKey: "TQS:MOV_TERRA:ESCAVACAO",
      },
      {
        description: "Reaterro Compactado de Fundações e Valas (Derivado TQS)",
        unit: "m³",
        zoneQuantities: zReat,
        rawCategory: "TERRAPLENAGEM",
        eapStageCode: "02",
        laborHintCode: "MO-PEDREIRO-EQ",
        sourceSoftware: "TQS",
        sourceFileId: sourceFileId ?? null,
        sourcePage: 1,
        confidence: 0.78,
        isStructural: true,
        isDerived: true,
        elementKey: "TQS:MOV_TERRA:REATERRO",
      },
      {
        description: "Carga, Transporte e Bota-Fora de Terra Excedente c/ Empolamento 30% (Derivado TQS)",
        unit: "m³",
        zoneQuantities: zBota,
        rawCategory: "TERRAPLENAGEM",
        eapStageCode: "02",
        sourceSoftware: "TQS",
        sourceFileId: sourceFileId ?? null,
        sourcePage: 1,
        confidence: 0.78,
        isStructural: true,
        isDerived: true,
        elementKey: "TQS:MOV_TERRA:BOTA_FORA",
      }
    );

    notes.push(
      `Movimento de terra (Etapa 02) derivado automaticamente de ${foundationConcreteM3.toFixed(2)} m³ de fundação TQS.`
    );
  }

  return {
    sourceSoftware: "TQS",
    candidates,
    pagesAnalyzed: pages.length,
    notes,
  };
}
