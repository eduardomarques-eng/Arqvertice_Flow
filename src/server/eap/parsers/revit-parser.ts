import type { ExtractedPdfPage } from "../pdf-reader";
import { extractHtmlTables, stripHtmlTags } from "./tqs-html-parser";
import {
  createEmptyZones,
  detectZoneFromText,
  parseLocalizedNumber,
  type MinedEapCandidate,
  type ParsedDocumentResult,
} from "./types";

interface RevitRule {
  regex: RegExp;
  rawCategory: string;
  eapStageCode: string;
  unit: string;
  materialHintCode?: string;
  laborHintCode?: string;
  isStructural: boolean;
  labelPrefix: string;
}

const REVIT_RULES: RevitRule[] = [
  // Elementos estruturais que podem vazar em schedules do Revit (para o reconciler bloquear se houver TQS)
  {
    regex: /\b(pilar(?:es)?|viga(?:s)?|laje(?:s)?|sapata(?:s)?|bloco(?:s)?\s+estrutural|concreto\s+estrutural)\b.*?(\d[\d.,]*)\s*(?:m³|m3)(?![a-zA-Z0-9²³])/i,
    rawCategory: "CONCRETO",
    eapStageCode: "04",
    unit: "m³",
    materialHintCode: "CONC-FCK30",
    laborHintCode: "MO-CONCRETAGEM",
    isStructural: true,
    labelPrefix: "Estrutura Concreto (Revit)",
  },
  {
    regex: /\b(a[çc]o|armadura|ca-?50|ca-?60)\b.*?(\d[\d.,]*)\s*kg(?![a-zA-Z0-9])/i,
    rawCategory: "ACO",
    eapStageCode: "04",
    unit: "kg",
    materialHintCode: "ACO-CA50-100",
    laborHintCode: "MO-ARMADOR",
    isStructural: true,
    labelPrefix: "Armadura Aço (Revit)",
  },
  // Vergas / Contravergas (aceita m³ ou m para permitir detecção de anomalia dimensional!)
  {
    regex: /\b(verga(?:s)?|contraverga(?:s)?)\b.*?(\d[\d.,]*)\s*(m³|m3|m)(?![a-zA-Z0-9²³])/i,
    rawCategory: "ALVENARIA",
    eapStageCode: "05",
    unit: "m³",
    materialHintCode: "CONC-FCK25",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Vergas e Contravergas",
  },
  // Alvenaria por tipo (TJC8, TJC14, TJC19, TJM, CBG)
  {
    regex: /\b(TJC\s*8|bloco\s*9\s*cm|parede\s*9\s*cm)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "ALVENARIA",
    eapStageCode: "05",
    unit: "m²",
    materialHintCode: "ALV-TJC8",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Alvenaria Bloco Cerâmico 9cm (TJC8)",
  },
  {
    regex: /\b(TJC\s*14|bloco\s*14\s*cm|parede\s*14\s*cm|alvenaria\s+ved[aã])\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "ALVENARIA",
    eapStageCode: "05",
    unit: "m²",
    materialHintCode: "ALV-TJC14",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Alvenaria Bloco Cerâmico 14cm (TJC14)",
  },
  {
    regex: /\b(TJC\s*19|bloco\s*19\s*cm|parede\s*19\s*cm)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "ALVENARIA",
    eapStageCode: "05",
    unit: "m²",
    materialHintCode: "ALV-TJC19",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Alvenaria Bloco Cerâmico 19cm (TJC19)",
  },
  {
    regex: /\b(TJM|tijolo\s+maci[çc]o)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "ALVENARIA",
    eapStageCode: "05",
    unit: "m²",
    materialHintCode: "ALV-TJM",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Alvenaria Tijolo Maciço (TJM)",
  },
  {
    regex: /\b(CBG|cobog[óo])\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "ALVENARIA",
    eapStageCode: "05",
    unit: "m²",
    materialHintCode: "ALV-CBG",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Elemento Vazado Cobogó (CBG)",
  },
  // Esquadrias
  {
    regex: /\b(guarda[\s-]?corpo|GC\d+)\b.*?(\d[\d.,]*)\s*m(?![a-zA-Z0-9²³])/i,
    rawCategory: "ESQUADRIAS",
    eapStageCode: "16",
    unit: "m",
    materialHintCode: "ESQ-GUARDA-CORPO",
    isStructural: false,
    labelPrefix: "Guarda-Corpo Alumínio/Vidro",
  },
  {
    regex: /\b(esquadria\s+de\s+alum[íi]nio|janela\s+alum|J\d+|porta\s+vidro)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "ESQUADRIAS",
    eapStageCode: "16",
    unit: "m²",
    materialHintCode: "ESQ-ALUM-VIDRO",
    isStructural: false,
    labelPrefix: "Esquadria de Alumínio e Vidro",
  },
  {
    regex: /\b(porta\s+(?:de\s+)?madeira|kit\s+porta|P\d+\s*[-–]?\s*porta)\b.*?(\d[\d.,]*)\s*(?:unid|un|p[çc])(?![a-zA-Z0-9])/i,
    rawCategory: "ESQUADRIAS",
    eapStageCode: "17",
    unit: "unid",
    materialHintCode: "ESQ-PORTA-MAD",
    isStructural: false,
    labelPrefix: "Porta Pronta de Madeira",
  },
  // Pisos, revestimentos, impermeabilização, forro, pintura, bancadas
  {
    regex: /\b(manta\s+asf[áa]ltica|impermeabiliza[çc][ãa]o)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "IMPERMEABILIZACAO",
    eapStageCode: "07",
    unit: "m²",
    materialHintCode: "IMP-MANTA-4MM",
    isStructural: false,
    labelPrefix: "Impermeabilização com Manta Asfáltica",
  },
  {
    regex: /\b(contrapiso|regulariza[çc][ãa]o\s+de\s+piso)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "REVESTIMENTOS",
    eapStageCode: "13",
    unit: "m²",
    materialHintCode: "REV-CONTRAPISO",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Contrapiso Regularizado",
  },
  {
    regex: /\b(porcelanato|piso\s+cer[âa]mico|revestimento\s+piso)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "REVESTIMENTOS",
    eapStageCode: "14",
    unit: "m²",
    materialHintCode: "REV-PORC-90",
    laborHintCode: "MO-AZULEJISTA",
    isStructural: false,
    labelPrefix: "Piso Porcelanato Retificado",
  },
  {
    regex: /\b(rodap[ée])\b.*?(\d[\d.,]*)\s*m(?![a-zA-Z0-9²³])/i,
    rawCategory: "REVESTIMENTOS",
    eapStageCode: "14",
    unit: "m",
    materialHintCode: "REV-RODAPE-15",
    laborHintCode: "MO-AZULEJISTA",
    isStructural: false,
    labelPrefix: "Rodapé Porcelanato / Poliestireno",
  },
  {
    regex: /\b(forro\s+(?:de\s+)?gesso|drywall)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "REVESTIMENTOS",
    eapStageCode: "15",
    unit: "m²",
    materialHintCode: "REV-FORRO-GESSO",
    laborHintCode: "MO-GESSEIRO",
    isStructural: false,
    labelPrefix: "Forro de Gesso Acartonado",
  },
  {
    regex: /\b(chapisco|embo[çc]o|reboco|massa\s+[úu]nica)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "REVESTIMENTOS",
    eapStageCode: "11",
    unit: "m²",
    materialHintCode: "REV-CHAP-EMB",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Chapisco e Emboço de Paredes",
  },
  {
    regex: /\b(bancada|granito|quartzo|marmoraria)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "BANCADAS",
    eapStageCode: "18",
    unit: "m²",
    materialHintCode: "BANC-GRANITO",
    isStructural: false,
    labelPrefix: "Bancada em Granito / Quartzo",
  },
  {
    regex: /\b(pintura\s+externa|textura\s+fachada)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "PINTURA",
    eapStageCode: "19",
    unit: "m²",
    materialHintCode: "PINT-ACRL-EXT",
    laborHintCode: "MO-PINTOR",
    isStructural: false,
    labelPrefix: "Pintura Externa Acrílica",
  },
  {
    regex: /\b(pintura\s+interna|pintura\s+pva|massa\s+corrida)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "PINTURA",
    eapStageCode: "19",
    unit: "m²",
    materialHintCode: "PINT-PVA-INT",
    laborHintCode: "MO-PINTOR",
    isStructural: false,
    labelPrefix: "Pintura Interna PVA/Acrílica",
  },
  // Instalações Elétricas (Etapa 08)
  {
    regex: /\b(quadro\s+de\s+distribui[çc][ãa]o|qdc|qgbt|disjuntor(?:es)?)\b.*?(\d[\d.,]*)\s*(?:unid|un|p[çc])\b/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "08",
    unit: "unid",
    materialHintCode: "INST-PTO-ELET",
    laborHintCode: "MO-ELETRICISTA",
    isStructural: false,
    labelPrefix: "Quadro / Disjuntor Elétrico",
  },
  {
    regex: /\b(eletroduto(?:s)?|condu[íi]te(?:s)?|cabo(?:s)?\s+flex[íi]vel|fio(?:s)?\s+\d)\b.*?(\d[\d.,]*)\s*(?:m|ml)(?![a-zA-Z0-9²³])/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "08",
    unit: "m",
    materialHintCode: "INST-PTO-ELET",
    laborHintCode: "MO-ELETRICISTA",
    isStructural: false,
    labelPrefix: "Eletroduto / Cabeamento Elétrico",
  },
  {
    regex: /\b(ponto(?:s)?\s+el[ée]trico(?:s)?|tomada(?:s)?(?:\s+e\s+interruptor)?|interruptor(?:es)?)\b.*?(\d[\d.,]*)\s*(?:unid|un|pt|pontos?)\b/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "08",
    unit: "unid",
    materialHintCode: "INST-PTO-ELET",
    laborHintCode: "MO-ELETRICISTA",
    isStructural: false,
    labelPrefix: "Pontos Elétricos",
  },
  {
    regex: /\b(ponto(?:s)?\s+luminot[ée]cnico(?:s)?|lumin[áa]ria(?:s)?|spot(?:s)?|pendente(?:s)?|arandela(?:s)?|plafon(?:s)?)\b.*?(\d[\d.,]*)\s*(?:unid|un|pt|p[çc]|pontos?)\b/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "21",
    unit: "unid",
    materialHintCode: "INST-PTO-LUMI",
    laborHintCode: "MO-ELETRICISTA",
    isStructural: false,
    labelPrefix: "Luminotécnica — Luminárias / Pontos",
  },
  {
    regex: /\b(fita(?:s)?\s+led|perfil\s+led|mangueira\s+led)\b.*?(\d[\d.,]*)\s*(?:m|ml)(?![a-zA-Z0-9²³])/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "21",
    unit: "m",
    materialHintCode: "INST-PTO-LUMI",
    laborHintCode: "MO-ELETRICISTA",
    isStructural: false,
    labelPrefix: "Luminotécnica — Fita / Perfil LED",
  },
  // Paisagismo & Áreas Externas (Etapa 23)
  {
    regex: /\b(grama(?:do)?|canteiro(?:s)?|forra[çc][ãa]o|piso\s+intertravado|deck\s+externo|pisos?\s+externo(?:s)?)\b.*?(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i,
    rawCategory: "PAISAGISMO",
    eapStageCode: "23",
    unit: "m²",
    materialHintCode: "PAIS-GRAMA",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Paisagismo — Gramado / Piso Externo",
  },
  {
    regex: /\b([áa]rvore(?:s)?|palmeira(?:s)?|muda(?:s)?|arbusto(?:s)?|esp[ée]cie(?:s)?\s+vegeta|ponto(?:s)?\s+de\s+irriga[çc][ãa]o|aspersor(?:es)?)\b.*?(\d[\d.,]*)\s*(?:unid|un|p[çc]|mudas?)\b/i,
    rawCategory: "PAISAGISMO",
    eapStageCode: "23",
    unit: "unid",
    materialHintCode: "PAIS-MUDAS",
    laborHintCode: "MO-PEDREIRO-EQ",
    isStructural: false,
    labelPrefix: "Paisagismo — Espécies / Irrigação",
  },
  // Hidrossanitário — Abastecimento Água Fria/Quente (Etapa 09)
  {
    regex: /\b(reservat[óo]rio|caixa\s*d['’]?\s*[áa]gua|bomba\s+recalque|pressurizador|registro\s+(?:de\s+)?(?:gaveta|press[ãa]o))\b.*?(\d[\d.,]*)\s*(?:unid|un|p[çc])\b/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "09",
    unit: "unid",
    materialHintCode: "INST-PTO-HIDRO",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Abastecimento — Equipamento / Registro",
  },
  {
    regex: /\b(tubo(?:s|la[çc][ãa]o)?\s+(?:[áa]gua\s+fria|[áa]gua\s+quente|pvc\s+sold[áa]vel|ppr|cpvc)|[áa]gua\s+fria|[áa]gua\s+quente)\b.*?(\d[\d.,]*)\s*(?:m|ml)(?![a-zA-Z0-9²³])/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "09",
    unit: "m",
    materialHintCode: "INST-PTO-HIDRO",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Abastecimento — Tubulação AF/AQ",
  },
  // Hidrossanitário — Esgotamento Sanitário (Etapa 09)
  {
    regex: /\b(caixa\s+(?:sifonada|de\s+gordura|de\s+inspe[çc][ãa]o)|fossa\s+s[ée]ptica|sumidouro)\b.*?(\d[\d.,]*)\s*(?:unid|un|p[çc])\b/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "09",
    unit: "unid",
    materialHintCode: "INST-PTO-HIDRO",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Esgotamento — Caixa / Tratamento",
  },
  {
    regex: /\b(tubo(?:s|la[çc][ãa]o)?\s+(?:de\s+)?esgoto|pvc\s+esgoto|ventila[çc][ãa]o\s+sanit[áa]ria)\b.*?(\d[\d.,]*)\s*(?:m|ml)(?![a-zA-Z0-9²³])/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "09",
    unit: "m",
    materialHintCode: "INST-PTO-HIDRO",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Esgotamento — Tubulação PVC Esgoto",
  },
  // Hidrossanitário — Drenagem Pluvial (Etapa 09)
  {
    regex: /\b(calha(?:s)?|condutor(?:es)?\s+pluv|dreno(?:s)?|tubo(?:s)?\s+pluvial)\b.*?(\d[\d.,]*)\s*(?:m|ml)(?![a-zA-Z0-9²³])/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "09",
    unit: "m",
    materialHintCode: "INST-PTO-HIDRO",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Drenagem Pluvial — Calha / Condutor",
  },
  {
    regex: /\b(caixa\s+(?:de\s+areia|de\s+passagem)|grelha(?:s)?\s+pluv|ralo\s+pluvial)\b.*?(\d[\d.,]*)\s*(?:unid|un|p[çc])\b/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "09",
    unit: "unid",
    materialHintCode: "INST-PTO-HIDRO",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Drenagem Pluvial — Caixa / Grelha",
  },
  {
    regex: /\b(ponto(?:s)?\s+hidr[áa]ulico(?:s)?|hidrossanit[áa]rio)\b.*?(\d[\d.,]*)\s*(?:unid|un|pt|pontos?)\b/i,
    rawCategory: "INSTALACOES",
    eapStageCode: "09",
    unit: "unid",
    materialHintCode: "INST-PTO-HIDRO",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Pontos Hidrossanitários",
  },
  {
    regex: /\b(bacia\s+sanit[áa]ria|conjunto\s+lou[çc]as|lou[çc]as\s+e\s+metais)\b.*?(\d[\d.,]*)\s*(?:unid|un|cj)\b/i,
    rawCategory: "LOUCAS_METAIS",
    eapStageCode: "20",
    unit: "unid",
    materialHintCode: "LOUC-CONJ-BWC",
    laborHintCode: "MO-ENCANADOR",
    isStructural: false,
    labelPrefix: "Conjunto Louças e Metais",
  },
];

/**
 * Parser especializado para Schedules / Tabelas Quantitativas e Pranchas do Revit.
 */
export function parseRevitPages(
  pages: ExtractedPdfPage[],
  sourceFileId?: string | null
): ParsedDocumentResult {
  const candidates: MinedEapCandidate[] = [];
  const notes: string[] = [];
  let detectedAreaM2: number | null = null;

  for (const page of pages) {
    const lines = page.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let currentZone = detectZoneFromText(page.text);

    for (const line of lines) {
      if (/^(pavimento|n[ií]vel|level|zona)\s*[:\-]/i.test(line)) {
        currentZone = detectZoneFromText(line);
      }

      const areaTotalMatch = line.match(/[áa]rea\s+(?:constru[íi]da(?:\s+total)?|total|[úu]til)\s*[:\-]?\s*(\d[\d.,]*)\s*(?:m²|m2)(?![a-zA-Z0-9²³])/i);
      if (areaTotalMatch) {
        const val = parseLocalizedNumber(areaTotalMatch[1]);
        if (Number.isFinite(val) && val > 20) {
          detectedAreaM2 = Math.max(detectedAreaM2 ?? 0, val);
        }
      }

      const lineZone = /t[eé]rreo|superior|cobertura|extern|fachada/i.test(line)
        ? detectZoneFromText(line)
        : currentZone;

      for (const rule of REVIT_RULES) {
        const m = line.match(rule.regex);
        if (!m) continue;

        const qty = parseLocalizedNumber(m[2]);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const capturedUnit = m[3] ? m[3].replace("m3", "m³").replace("m2", "m²") : rule.unit;
        const zones = createEmptyZones();
        zones[lineZone] = qty;

        candidates.push({
          description: `${rule.labelPrefix} — ${m[1].trim()}`,
          unit: capturedUnit,
          zoneQuantities: zones,
          rawCategory: rule.rawCategory,
          eapStageCode: rule.eapStageCode,
          materialHintCode: rule.materialHintCode ?? null,
          laborHintCode: rule.laborHintCode ?? null,
          sourceSoftware: "REVIT",
          sourceFileId: sourceFileId ?? null,
          sourcePage: page.pageNumber,
          confidence: rule.isStructural ? 0.85 : 0.91,
          isStructural: rule.isStructural,
          elementKey: `REVIT:${rule.rawCategory}:${rule.eapStageCode}:${m[1].trim().toUpperCase()}:${lineZone}`,
        });
        break;
      }
    }
  }

  if (detectedAreaM2) {
    notes.push(`Área construída/útil detectada no Revit: ${detectedAreaM2.toFixed(2)} m².`);
  }

  return {
    sourceSoftware: "REVIT",
    candidates,
    detectedAreaM2,
    pagesAnalyzed: pages.length,
    notes,
  };
}

/**
 * Parser para Schedules HTML/HTM exportados do Revit (Arquitetura, Elétrico e Hidrossanitário).
 */
export function parseRevitHtml(
  html: string,
  options?: { discipline?: string; sourceFileId?: string | null }
): ParsedDocumentResult {
  const tables = extractHtmlTables(html);
  const lines: string[] = [];

  for (const table of tables) {
    for (const row of table) {
      const joined = row.filter(Boolean).join(" — ").trim();
      if (joined) lines.push(joined);
    }
  }

  if (lines.length === 0) {
    lines.push(stripHtmlTags(html));
  }

  const headerContext = options?.discipline ? `Disciplina: ${options.discipline}\n` : "";
  const pages: ExtractedPdfPage[] = [{ pageNumber: 1, text: `${headerContext}${lines.join("\n")}` }];
  const parsed = parseRevitPages(pages, options?.sourceFileId);
  if (options?.discipline) {
    parsed.notes.push(`Schedule HTML Revit processado na disciplina ${options.discipline}.`);
  }
  return parsed;
}
