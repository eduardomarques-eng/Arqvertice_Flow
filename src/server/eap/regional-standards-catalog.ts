import { computeEapLine, round2 } from "./calculator";

export type ConstructionStandard = "BAIXO_PADRAO" | "MEDIO_PADRAO" | "ALTO_PADRAO";

export type ConcreteMethod = "USINADO" | "IN_LOCO_BETONEIRA";

export const CONCRETE_METHOD_LABELS: Record<ConcreteMethod, string> = {
  USINADO: "Concreto Usinado",
  IN_LOCO_BETONEIRA: "In Loco (Betoneira 400 L)",
};

export const CONCRETE_METHOD_RATES: Record<
  ConcreteMethod,
  Record<ConstructionStandard, { material: number; labor: number }>
> = {
  USINADO: {
    BAIXO_PADRAO: { material: 545, labor: 95 },
    MEDIO_PADRAO: { material: 585, labor: 95 },
    ALTO_PADRAO: { material: 635, labor: 95 },
  },
  IN_LOCO_BETONEIRA: {
    BAIXO_PADRAO: { material: 410, labor: 135 },
    MEDIO_PADRAO: { material: 435, labor: 155 },
    ALTO_PADRAO: { material: 475, labor: 175 },
  },
};

export function isStructuralConcreteItem(
  stageCode: string,
  description: string
): boolean {
  if (!["03", "04", "06"].includes(stageCode)) return false;
  const d = description.toLowerCase();
  if (!d.includes("concreto")) return false;
  if (d.includes("aço") || d.includes("aco") || d.includes("fôrma") || d.includes("forma")) {
    return false;
  }
  return true;
}

export function convertConcreteItemByMethod(input: {
  concreteMethod: ConcreteMethod;
  standard: ConstructionStandard;
}): { description: string; materialUnitCost: number; laborUnitCost: number } {
  const rates =
    CONCRETE_METHOD_RATES[input.concreteMethod]?.[input.standard] ??
    CONCRETE_METHOD_RATES.USINADO.MEDIO_PADRAO;

  const description =
    input.concreteMethod === "IN_LOCO_BETONEIRA"
      ? "Concreto estrutural virado in loco c/ betoneira 400 L (C30/C35 — cimento, areia, brita e aditivo)"
      : "Concreto estrutural usinado bombeável FCK 30/35 MPa (dosado em central c/ lançamento)";

  return {
    description,
    materialUnitCost: rates.material,
    laborUnitCost: rates.labor,
  };
}

export type SensitivityTier =
  | "ESTRUTURAL_BRUTO"
  | "REVESTIMENTO_BRUTO"
  | "ACABAMENTO_NOBRE";

export interface RegionalCityMultiplier {
  key: string;
  cityName: string;
  stateCode: string;
  label: string;
  regionalMaterialFactor: number;
  regionalLaborFactor: number;
  defaultBdiPercent: number;
  referenceNote: string;
}

export const CONSTRUCTION_STANDARD_LABELS: Record<ConstructionStandard, string> = {
  BAIXO_PADRAO: "Baixo Padrão",
  MEDIO_PADRAO: "Médio Padrão",
  ALTO_PADRAO: "Alto Padrão",
};

export const SENSITIVITY_TIER_LABELS: Record<SensitivityTier, string> = {
  ESTRUTURAL_BRUTO: "Grupo 1 — Estrutural & Brutos (Variação Controlada)",
  REVESTIMENTO_BRUTO: "Grupo 2 — Revestimentos Brutos & Contrapiso (Variação Moderada)",
  ACABAMENTO_NOBRE: "Grupo 3 — Acabamentos Nobres, Pedras & Louças (Alta Diferenciação)",
};

export const REGIONAL_CITY_MULTIPLIERS: RegionalCityMultiplier[] = [
  {
    key: "FORTALEZA_CE",
    cityName: "Fortaleza",
    stateCode: "CE",
    label: "Fortaleza / CE (Base Sinduscon-CE / SINAPI-CE)",
    regionalMaterialFactor: 1.0,
    regionalLaborFactor: 1.0,
    defaultBdiPercent: 22.0,
    referenceNote: "Praça de referência base 1,00× (Sinduscon-CE / SINAPI-CE).",
  },
  {
    key: "EUSEBIO_AQUIRAZ_CE",
    cityName: "Eusébio / Aquiraz",
    stateCode: "CE",
    label: "Eusébio / Aquiraz / Litoral Leste CE",
    regionalMaterialFactor: 1.05,
    regionalLaborFactor: 1.06,
    defaultBdiPercent: 22.0,
    referenceNote: "Adicional logístico e proteção contra agressividade marinha (CAA III / Inox 316).",
  },
  {
    key: "JUAZEIRO_NORTE_CE",
    cityName: "Juazeiro do Norte",
    stateCode: "CE",
    label: "Juazeiro do Norte / CE (Cariri)",
    regionalMaterialFactor: 0.96,
    regionalLaborFactor: 0.92,
    defaultBdiPercent: 21.0,
    referenceNote: "Mão de obra regional Cariri (0,92×) e insumos locais (0,96×).",
  },
  {
    key: "SOBRAL_CE",
    cityName: "Sobral",
    stateCode: "CE",
    label: "Sobral / CE (Região Norte)",
    regionalMaterialFactor: 0.97,
    regionalLaborFactor: 0.94,
    defaultBdiPercent: 21.0,
    referenceNote: "Mão de obra regional Norte CE (0,94×) e insumos locais (0,97×).",
  },
  {
    key: "RECIFE_PE",
    cityName: "Recife",
    stateCode: "PE",
    label: "Recife / PE (RMR)",
    regionalMaterialFactor: 1.02,
    regionalLaborFactor: 1.03,
    defaultBdiPercent: 22.5,
    referenceNote: "Índice regional Pernambuco (MO 1,03× / Material 1,02×).",
  },
  {
    key: "SAO_PAULO_SP",
    cityName: "São Paulo",
    stateCode: "SP",
    label: "São Paulo / SP (Capital & Grande SP)",
    regionalMaterialFactor: 1.14,
    regionalLaborFactor: 1.28,
    defaultBdiPercent: 24.0,
    referenceNote: "Mão de obra especializada Grande SP (1,28×) e insumos (1,14×).",
  },
];

export interface StandardPriceCurve {
  tier: SensitivityTier;
  materialFactor: Record<ConstructionStandard, number>;
  laborFactor: Record<ConstructionStandard, number>;
  thirdPartyFactor: Record<ConstructionStandard, number>;
  /** Valores unitários diretos em Fortaleza/CE quando aplicável por m²/unidade canônica */
  directFortalezaAnchor?: {
    unitMatch: RegExp;
    BAIXO_PADRAO: { material: number; labor: number };
    MEDIO_PADRAO: { material: number; labor: number };
    ALTO_PADRAO: { material: number; labor: number };
  };
}

/**
 * Triagem Inteligente por Sensibilidade de Etapa (01 a 26):
 * - Etapas 01..10: variação mínima controlada (0,94x / 1,00x / 1,08x)
 * - Etapas 11..13: variação moderada (0,88x / 1,00x / 1,15x)
 * - Etapas 14..24 & 26: alta diferenciação realista entre Baixo, Médio e Alto Padrão
 */
export const TRIAGE_SENSITIVITY_RULES: Record<string, StandardPriceCurve> = {
  // Grupo 1 — Infraestrutura, Estrutura & Brutos (01..10)
  "01": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    laborFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
  },
  "02": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.06 },
    laborFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.06 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
  },
  "03": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    laborFactor: { BAIXO_PADRAO: 0.95, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
  },
  "04": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    laborFactor: { BAIXO_PADRAO: 0.95, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.95, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
  },
  "05": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.07 },
    laborFactor: { BAIXO_PADRAO: 0.95, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.95, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.07 },
  },
  "06": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.92, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.12 },
    laborFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.1 },
  },
  "07": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.92, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.1 },
    laborFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.1 },
  },
  "08": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    laborFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
  },
  "09": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    laborFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.94, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
  },
  "10": {
    tier: "ESTRUTURAL_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.9, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.1 },
    laborFactor: { BAIXO_PADRAO: 0.92, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.08 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.92, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.1 },
  },

  // Grupo 2 — Revestimentos Brutos & Contrapiso (11..13)
  "11": {
    tier: "REVESTIMENTO_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
    laborFactor: { BAIXO_PADRAO: 0.9, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.14 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
  },
  "12": {
    tier: "REVESTIMENTO_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.16 },
    laborFactor: { BAIXO_PADRAO: 0.9, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
  },
  "13": {
    tier: "REVESTIMENTO_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
    laborFactor: { BAIXO_PADRAO: 0.9, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
  },

  // Grupo 3 — Acabamentos Nobres, Pedras, Louças & Esquadrias (14..24, 26)
  "14": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.5, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 2.15 },
    laborFactor: { BAIXO_PADRAO: 0.73, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.5 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.65, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.8 },
    directFortalezaAnchor: {
      unitMatch: /^m²$/i,
      BAIXO_PADRAO: { material: 68, labor: 38 },
      MEDIO_PADRAO: { material: 135, labor: 52 },
      ALTO_PADRAO: { material: 290, labor: 78 },
    },
  },
  "15": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.58, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.75 },
    laborFactor: { BAIXO_PADRAO: 0.6, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.62 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.58, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.72 },
    directFortalezaAnchor: {
      unitMatch: /^m²$/i,
      BAIXO_PADRAO: { material: 32, labor: 23 },
      MEDIO_PADRAO: { material: 55, labor: 40 },
      ALTO_PADRAO: { material: 100, labor: 65 },
    },
  },
  "16": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.65, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.68 },
    laborFactor: { BAIXO_PADRAO: 0.78, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.28 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.68, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.65 },
  },
  "17": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.62, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.75 },
    laborFactor: { BAIXO_PADRAO: 0.78, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.28 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.65, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.7 },
  },
  "18": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.47, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 2.08 },
    laborFactor: { BAIXO_PADRAO: 0.72, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.45 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.5, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.95 },
    directFortalezaAnchor: {
      unitMatch: /^m²$/i,
      BAIXO_PADRAO: { material: 310, labor: 110 },
      MEDIO_PADRAO: { material: 680, labor: 210 },
      ALTO_PADRAO: { material: 1480, labor: 370 },
    },
  },
  "19": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.68, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.58 },
    laborFactor: { BAIXO_PADRAO: 0.78, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.28 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.7, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.5 },
  },
  "20": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.45, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 2.25 },
    laborFactor: { BAIXO_PADRAO: 0.75, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.35 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.5, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 2.0 },
  },
  "21": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.48, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.95 },
    laborFactor: { BAIXO_PADRAO: 0.75, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.35 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.55, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.85 },
  },
  "22": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.58, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.72 },
    laborFactor: { BAIXO_PADRAO: 0.78, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.28 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.6, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.7 },
  },
  "23": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.55, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.85 },
    laborFactor: { BAIXO_PADRAO: 0.75, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.3 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.6, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.75 },
  },
  "24": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.68, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.55 },
    laborFactor: { BAIXO_PADRAO: 0.8, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.25 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.7, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.5 },
  },
  "25": {
    tier: "REVESTIMENTO_BRUTO",
    materialFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
    laborFactor: { BAIXO_PADRAO: 0.9, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
  },
  "26": {
    tier: "ACABAMENTO_NOBRE",
    materialFactor: { BAIXO_PADRAO: 0.75, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.35 },
    laborFactor: { BAIXO_PADRAO: 0.82, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.25 },
    thirdPartyFactor: { BAIXO_PADRAO: 0.78, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.3 },
  },
};

export function getStageSensitivityRule(stageCode: string): StandardPriceCurve {
  return (
    TRIAGE_SENSITIVITY_RULES[stageCode] ?? {
      tier: "REVESTIMENTO_BRUTO",
      materialFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
      laborFactor: { BAIXO_PADRAO: 0.9, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
      thirdPartyFactor: { BAIXO_PADRAO: 0.88, MEDIO_PADRAO: 1.0, ALTO_PADRAO: 1.15 },
    }
  );
}

/**
 * Calcula novos preços unitários (Material, Mão de Obra e Terceiros) convertendo
 * da base atual (`currentStandard`, `currentCityFactors`) para o padrão e praça de destino.
 */
export function computeMultiStandardItemPrices(input: {
  stageCode: string;
  unit: string;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  currentStandard: ConstructionStandard;
  targetStandard: ConstructionStandard;
  currentMaterialFactor: number;
  currentLaborFactor: number;
  targetMaterialFactor: number;
  targetLaborFactor: number;
  catalogPrices?: {
    lowMaterialCost?: number;
    lowLaborCost?: number;
    midMaterialCost?: number;
    midLaborCost?: number;
    highMaterialCost?: number;
    highLaborCost?: number;
  } | null;
}): {
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  tier: SensitivityTier;
} {
  const rule = getStageSensitivityRule(input.stageCode);

  // 1. Se o item possuir âncora explícita no catálogo multi-padrão do banco, utiliza diretamente
  if (input.catalogPrices) {
    const cat = input.catalogPrices;
    const rawMat =
      input.targetStandard === "BAIXO_PADRAO"
        ? cat.lowMaterialCost
        : input.targetStandard === "ALTO_PADRAO"
          ? cat.highMaterialCost
          : cat.midMaterialCost;
    const rawLab =
      input.targetStandard === "BAIXO_PADRAO"
        ? cat.lowLaborCost
        : input.targetStandard === "ALTO_PADRAO"
          ? cat.highLaborCost
          : cat.midLaborCost;

    if ((rawMat ?? 0) > 0 || (rawLab ?? 0) > 0) {
      return {
        materialUnitCost: round2((rawMat ?? 0) * input.targetMaterialFactor),
        laborUnitCost: round2((rawLab ?? 0) * input.targetLaborFactor),
        thirdPartyUnitCost: round2(
          (input.thirdPartyUnitCost / Math.max(0.5, input.currentMaterialFactor)) *
            (rule.thirdPartyFactor[input.targetStandard] /
              Math.max(0.5, rule.thirdPartyFactor[input.currentStandard])) *
            input.targetMaterialFactor
        ),
        tier: rule.tier,
      };
    }
  }

  // 2. Se houver âncora direta Fortaleza/CE para a etapa e unidade (ex.: Pisos m², Forro m², Marmoraria m²)
  if (
    rule.directFortalezaAnchor &&
    rule.directFortalezaAnchor.unitMatch.test(input.unit.trim()) &&
    (input.materialUnitCost > 0 || input.laborUnitCost > 0)
  ) {
    const anchor = rule.directFortalezaAnchor[input.targetStandard];
    return {
      materialUnitCost: round2(anchor.material * input.targetMaterialFactor),
      laborUnitCost: round2(anchor.labor * input.targetLaborFactor),
      thirdPartyUnitCost: round2(
        (input.thirdPartyUnitCost / Math.max(0.5, input.currentMaterialFactor)) *
          (rule.thirdPartyFactor[input.targetStandard] /
            Math.max(0.5, rule.thirdPartyFactor[input.currentStandard])) *
          input.targetMaterialFactor
      ),
      tier: rule.tier,
    };
  }

  // 3. Normaliza o preço atual de volta à base Médio Padrão Fortaleza (1,00x) e aplica o padrão + praça destino
  const normMat =
    input.materialUnitCost /
    Math.max(0.3, rule.materialFactor[input.currentStandard]) /
    Math.max(0.5, input.currentMaterialFactor);
  const normLab =
    input.laborUnitCost /
    Math.max(0.3, rule.laborFactor[input.currentStandard]) /
    Math.max(0.5, input.currentLaborFactor);
  const normTp =
    input.thirdPartyUnitCost /
    Math.max(0.3, rule.thirdPartyFactor[input.currentStandard]) /
    Math.max(0.5, input.currentMaterialFactor);

  return {
    materialUnitCost: round2(
      normMat * rule.materialFactor[input.targetStandard] * input.targetMaterialFactor
    ),
    laborUnitCost: round2(
      normLab * rule.laborFactor[input.targetStandard] * input.targetLaborFactor
    ),
    thirdPartyUnitCost: round2(
      normTp * rule.thirdPartyFactor[input.targetStandard] * input.targetMaterialFactor
    ),
    tier: rule.tier,
  };
}

export interface TriagePreviewItemInput {
  id: string;
  stageCode: string;
  stageName: string;
  description: string;
  unit: string;
  dataOrigin: string;
  zoneQuantities: {
    FUND_TERREO: number;
    PAV_SUPERIOR: number;
    COBERTURA: number;
    EXTERNO: number;
  };
  lossPercent: number;
  materialUnitCost: number;
  laborUnitCost: number;
  thirdPartyUnitCost: number;
  markupMultiplier: number;
}

export interface TriageStageSummary {
  stageCode: string;
  stageName: string;
  tier: SensitivityTier;
  itemsCount: number;
  editableCount: number;
  userEditedCount: number;
  currentMaterialTotal: number;
  projectedMaterialTotal: number;
  currentLaborTotal: number;
  projectedLaborTotal: number;
  currentDirectTotal: number;
  projectedDirectTotal: number;
  deltaPercent: number;
}

export interface TriagePreviewResult {
  currentStandard: ConstructionStandard;
  targetStandard: ConstructionStandard;
  bdiPercent: number;
  currentMaterialTotal: number;
  projectedMaterialTotal: number;
  currentLaborTotal: number;
  projectedLaborTotal: number;
  currentThirdPartyTotal: number;
  projectedThirdPartyTotal: number;
  currentDirectTotal: number;
  projectedDirectTotal: number;
  currentTotalWithBdi: number;
  projectedTotalWithBdi: number;
  deltaPercent: number;
  updatedItemsCount: number;
  preservedEditedCount: number;
  stages: TriageStageSummary[];
  itemUpdates: Array<{
    id: string;
    materialUnitCost: number;
    laborUnitCost: number;
    thirdPartyUnitCost: number;
  }>;
}

export function previewMultiStandardTriage(input: {
  items: TriagePreviewItemInput[];
  bdiPercent: number;
  currentStandard: ConstructionStandard;
  targetStandard: ConstructionStandard;
  currentMaterialFactor: number;
  currentLaborFactor: number;
  targetMaterialFactor: number;
  targetLaborFactor: number;
  selectedStageCodes?: string[];
  includeUserEdited: boolean;
}): TriagePreviewResult {
  const stageSet =
    input.selectedStageCodes && input.selectedStageCodes.length > 0
      ? new Set(input.selectedStageCodes)
      : null;

  const stageAcc = new Map<string, TriageStageSummary>();
  const itemUpdates: TriagePreviewResult["itemUpdates"] = [];

  let currentMaterialTotal = 0;
  let projectedMaterialTotal = 0;
  let currentLaborTotal = 0;
  let projectedLaborTotal = 0;
  let currentThirdPartyTotal = 0;
  let projectedThirdPartyTotal = 0;
  let preservedEditedCount = 0;

  for (const item of input.items) {
    const rule = getStageSensitivityRule(item.stageCode);
    const currLine = computeEapLine({
      description: item.description,
      unit: item.unit,
      zoneQuantities: item.zoneQuantities,
      lossPercent: item.lossPercent,
      materialUnitCost: item.materialUnitCost,
      laborUnitCost: item.laborUnitCost,
      thirdPartyUnitCost: item.thirdPartyUnitCost,
      markupMultiplier: item.markupMultiplier || 1,
    });

    const isUserEdited = item.dataOrigin === "EDITADO_USUARIO";
    const isStageSelected = !stageSet || stageSet.has(item.stageCode);
    const shouldUpdate = isStageSelected && (input.includeUserEdited || !isUserEdited);

    if (isStageSelected && isUserEdited && !input.includeUserEdited) {
      preservedEditedCount += 1;
    }

    let nextMat = item.materialUnitCost;
    let nextLab = item.laborUnitCost;
    let nextTp = item.thirdPartyUnitCost;

    if (shouldUpdate) {
      const calc = computeMultiStandardItemPrices({
        stageCode: item.stageCode,
        unit: item.unit,
        materialUnitCost: item.materialUnitCost,
        laborUnitCost: item.laborUnitCost,
        thirdPartyUnitCost: item.thirdPartyUnitCost,
        currentStandard: input.currentStandard,
        targetStandard: input.targetStandard,
        currentMaterialFactor: input.currentMaterialFactor,
        currentLaborFactor: input.currentLaborFactor,
        targetMaterialFactor: input.targetMaterialFactor,
        targetLaborFactor: input.targetLaborFactor,
      });
      nextMat = calc.materialUnitCost;
      nextLab = calc.laborUnitCost;
      nextTp = calc.thirdPartyUnitCost;
      itemUpdates.push({
        id: item.id,
        materialUnitCost: nextMat,
        laborUnitCost: nextLab,
        thirdPartyUnitCost: nextTp,
      });
    }

    const projLine = computeEapLine({
      description: item.description,
      unit: item.unit,
      zoneQuantities: item.zoneQuantities,
      lossPercent: item.lossPercent,
      materialUnitCost: nextMat,
      laborUnitCost: nextLab,
      thirdPartyUnitCost: nextTp,
      markupMultiplier: item.markupMultiplier || 1,
    });

    currentMaterialTotal += currLine.totalMaterialCost;
    projectedMaterialTotal += projLine.totalMaterialCost;
    currentLaborTotal += currLine.totalLaborCost;
    projectedLaborTotal += projLine.totalLaborCost;
    currentThirdPartyTotal += currLine.totalThirdPartyCost;
    projectedThirdPartyTotal += projLine.totalThirdPartyCost;

    const stEntry = stageAcc.get(item.stageCode) ?? {
      stageCode: item.stageCode,
      stageName: item.stageName,
      tier: rule.tier,
      itemsCount: 0,
      editableCount: 0,
      userEditedCount: 0,
      currentMaterialTotal: 0,
      projectedMaterialTotal: 0,
      currentLaborTotal: 0,
      projectedLaborTotal: 0,
      currentDirectTotal: 0,
      projectedDirectTotal: 0,
      deltaPercent: 0,
    };

    stEntry.itemsCount += 1;
    if (isUserEdited) stEntry.userEditedCount += 1;
    if (shouldUpdate) stEntry.editableCount += 1;
    stEntry.currentMaterialTotal = round2(stEntry.currentMaterialTotal + currLine.totalMaterialCost);
    stEntry.projectedMaterialTotal = round2(stEntry.projectedMaterialTotal + projLine.totalMaterialCost);
    stEntry.currentLaborTotal = round2(stEntry.currentLaborTotal + currLine.totalLaborCost);
    stEntry.projectedLaborTotal = round2(stEntry.projectedLaborTotal + projLine.totalLaborCost);
    stEntry.currentDirectTotal = round2(stEntry.currentDirectTotal + currLine.totalDirectCost);
    stEntry.projectedDirectTotal = round2(stEntry.projectedDirectTotal + projLine.totalDirectCost);
    stEntry.deltaPercent =
      stEntry.currentDirectTotal > 0
        ? round2(
            ((stEntry.projectedDirectTotal - stEntry.currentDirectTotal) /
              stEntry.currentDirectTotal) *
              100
          )
        : 0;
    stageAcc.set(item.stageCode, stEntry);
  }

  const currDirect = round2(currentMaterialTotal + currentLaborTotal + currentThirdPartyTotal);
  const projDirect = round2(projectedMaterialTotal + projectedLaborTotal + projectedThirdPartyTotal);
  const bdiMult = 1 + Math.max(0, input.bdiPercent) / 100;
  const currBdi = round2(currDirect * bdiMult);
  const projBdi = round2(projDirect * bdiMult);

  return {
    currentStandard: input.currentStandard,
    targetStandard: input.targetStandard,
    bdiPercent: input.bdiPercent,
    currentMaterialTotal: round2(currentMaterialTotal),
    projectedMaterialTotal: round2(projectedMaterialTotal),
    currentLaborTotal: round2(currentLaborTotal),
    projectedLaborTotal: round2(projectedLaborTotal),
    currentThirdPartyTotal: round2(currentThirdPartyTotal),
    projectedThirdPartyTotal: round2(projectedThirdPartyTotal),
    currentDirectTotal: currDirect,
    projectedDirectTotal: projDirect,
    currentTotalWithBdi: currBdi,
    projectedTotalWithBdi: projBdi,
    deltaPercent: currDirect > 0 ? round2(((projDirect - currDirect) / currDirect) * 100) : 0,
    updatedItemsCount: itemUpdates.length,
    preservedEditedCount,
    stages: Array.from(stageAcc.values()).sort((a, b) =>
      a.stageCode.localeCompare(b.stageCode)
    ),
    itemUpdates,
  };
}
