export type EapDiscipline =
  | "Serviços Preliminares / Gerais"
  | "Estrutural"
  | "Arquitetônico"
  | "Elétrico"
  | "Hidrossanitário"
  | "Luminotécnico"
  | "Paisagismo";

export type EapTeamCode = "A" | "B" | "C";

export interface MasterStageTaxonomyEntry {
  code: string;
  name: string;
  discipline: EapDiscipline;
  phaseCode: "F1" | "F2" | "F3" | "F4" | "F5" | "F6";
  phaseName: string;
  defaultLobPackage: number;
  defaultTeamCode: EapTeamCode;
  /** Faixa saudável de participação da Mão de Obra sobre o Custo Direto da etapa (0..1) */
  expectedLaborShareRange: [number, number];
  requiredForResidence?: boolean;
}

export const REQUIRED_RESIDENTIAL_STAGE_CODES: ReadonlyArray<string> = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "08",
  "09",
];

/**
 * Fonte Única de Verdade da EAP Residencial (26 Macro-Etapas):
 * trava Disciplina, Pacote LOB padrão, Equipe responsável (A/B/C)
 * e faixa saudável de Mão de Obra para auditoria automática.
 */
export const MASTER_EAP_TAXONOMY: Record<string, MasterStageTaxonomyEntry> = {
  "01": {
    code: "01",
    name: "Implantação da Obra e Serviços Preliminares",
    discipline: "Serviços Preliminares / Gerais",
    phaseCode: "F1",
    phaseName: "Fase 1 — Implantação & Infraestrutura",
    defaultLobPackage: 1,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.30, 0.85],
    requiredForResidence: true,
  },
  "02": {
    code: "02",
    name: "Movimento de Terra e Terraplenagem",
    discipline: "Serviços Preliminares / Gerais",
    phaseCode: "F1",
    phaseName: "Fase 1 — Implantação & Infraestrutura",
    defaultLobPackage: 3,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.20, 0.75],
    requiredForResidence: true,
  },
  "03": {
    code: "03",
    name: "Infraestrutura e Fundações",
    discipline: "Estrutural",
    phaseCode: "F1",
    phaseName: "Fase 1 — Implantação & Infraestrutura",
    defaultLobPackage: 4,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.28, 0.48],
    requiredForResidence: true,
  },
  "04": {
    code: "04",
    name: "Supraestrutura de Concreto Armado",
    discipline: "Estrutural",
    phaseCode: "F2",
    phaseName: "Fase 2 — Supraestrutura & Vedação",
    defaultLobPackage: 7,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.30, 0.45],
    requiredForResidence: true,
  },
  "05": {
    code: "05",
    name: "Alvenaria de Vedação e Divisórias",
    discipline: "Arquitetônico",
    phaseCode: "F2",
    phaseName: "Fase 2 — Supraestrutura & Vedação",
    defaultLobPackage: 10,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.30, 0.55],
    requiredForResidence: true,
  },
  "06": {
    code: "06",
    name: "Cobertura, Telhado e Rufos",
    discipline: "Arquitetônico",
    phaseCode: "F3",
    phaseName: "Fase 3 — Cobertura & Instalações",
    defaultLobPackage: 13,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.25, 0.42],
  },
  "07": {
    code: "07",
    name: "Impermeabilização e Proteção Mecânica",
    discipline: "Arquitetônico",
    phaseCode: "F3",
    phaseName: "Fase 3 — Cobertura & Instalações",
    defaultLobPackage: 14,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.25, 0.50],
  },
  "08": {
    code: "08",
    name: "Instalações Elétricas e Automação",
    discipline: "Elétrico",
    phaseCode: "F3",
    phaseName: "Fase 3 — Cobertura & Instalações",
    defaultLobPackage: 15,
    defaultTeamCode: "B",
    expectedLaborShareRange: [0.25, 0.50],
    requiredForResidence: true,
  },
  "09": {
    code: "09",
    name: "Instalações Hidrossanitárias e Águas Pluviais",
    discipline: "Hidrossanitário",
    phaseCode: "F3",
    phaseName: "Fase 3 — Cobertura & Instalações",
    defaultLobPackage: 17,
    defaultTeamCode: "B",
    expectedLaborShareRange: [0.25, 0.50],
    requiredForResidence: true,
  },
  "10": {
    code: "10",
    name: "Instalações de Gás, Climatização e Especiais",
    discipline: "Hidrossanitário",
    phaseCode: "F3",
    phaseName: "Fase 3 — Cobertura & Instalações",
    defaultLobPackage: 18,
    defaultTeamCode: "B",
    expectedLaborShareRange: [0.20, 0.45],
  },
  "11": {
    code: "11",
    name: "Revestimento de Paredes Internas",
    discipline: "Arquitetônico",
    phaseCode: "F4",
    phaseName: "Fase 4 — Revestimentos",
    defaultLobPackage: 19,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.30, 0.60],
  },
  "12": {
    code: "12",
    name: "Revestimento de Fachadas e Muros Externos",
    discipline: "Arquitetônico",
    phaseCode: "F4",
    phaseName: "Fase 4 — Revestimentos",
    defaultLobPackage: 21,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.30, 0.60],
  },
  "13": {
    code: "13",
    name: "Contrapiso e Regularização de Pisos",
    discipline: "Arquitetônico",
    phaseCode: "F4",
    phaseName: "Fase 4 — Revestimentos",
    defaultLobPackage: 23,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.30, 0.58],
  },
  "14": {
    code: "14",
    name: "Pisos, Porcelanatos e Rodapés",
    discipline: "Arquitetônico",
    phaseCode: "F5",
    phaseName: "Fase 5 — Acabamentos",
    defaultLobPackage: 25,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.25, 0.50],
  },
  "15": {
    code: "15",
    name: "Forros de Gesso e Sancas",
    discipline: "Arquitetônico",
    phaseCode: "F5",
    phaseName: "Fase 5 — Acabamentos",
    defaultLobPackage: 26,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.30, 0.55],
  },
  "16": {
    code: "16",
    name: "Esquadrias de Alumínio, Vidros e Guarda-Corpos",
    discipline: "Arquitetônico",
    phaseCode: "F5",
    phaseName: "Fase 5 — Acabamentos",
    defaultLobPackage: 32,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.15, 0.40],
  },
  "17": {
    code: "17",
    name: "Esquadrias de Madeira e Ferragens",
    discipline: "Arquitetônico",
    phaseCode: "F5",
    phaseName: "Fase 5 — Acabamentos",
    defaultLobPackage: 33,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.15, 0.40],
  },
  "18": {
    code: "18",
    name: "Marmoraria, Bancadas e Escadas",
    discipline: "Arquitetônico",
    phaseCode: "F5",
    phaseName: "Fase 5 — Acabamentos",
    defaultLobPackage: 28,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.15, 0.35],
  },
  "19": {
    code: "19",
    name: "Pintura Interna e Externa",
    discipline: "Arquitetônico",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 30,
    defaultTeamCode: "C",
    expectedLaborShareRange: [0.35, 0.65],
  },
  "20": {
    code: "20",
    name: "Louças, Metais e Acessórios",
    discipline: "Hidrossanitário",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 34,
    defaultTeamCode: "B",
    expectedLaborShareRange: [0.10, 0.35],
  },
  "21": {
    code: "21",
    name: "Luminotécnica e Acabamento Elétrico",
    discipline: "Luminotécnico",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 34,
    defaultTeamCode: "B",
    expectedLaborShareRange: [0.12, 0.40],
  },
  "22": {
    code: "22",
    name: "Piscina, Deck e Área Gourmet",
    discipline: "Arquitetônico",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 27,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.25, 0.45],
  },
  "23": {
    code: "23",
    name: "Paisagismo, Calçadas e Pavimentação Externa",
    discipline: "Paisagismo",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 35,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.20, 0.55],
  },
  "24": {
    code: "24",
    name: "Serralheria, Portões e Automação de Acesso",
    discipline: "Arquitetônico",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 35,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.18, 0.45],
  },
  "25": {
    code: "25",
    name: "Administração Local e Mão de Obra Indireta",
    discipline: "Serviços Preliminares / Gerais",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 1,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.40, 0.95],
  },
  "26": {
    code: "26",
    name: "Limpeza Final, Comissionamento e Entrega",
    discipline: "Serviços Preliminares / Gerais",
    phaseCode: "F6",
    phaseName: "Fase 6 — Finais & Entrega",
    defaultLobPackage: 38,
    defaultTeamCode: "A",
    expectedLaborShareRange: [0.55, 0.98],
  },
};

export function normalizeStageCode(stageCode: string): string {
  const trimmed = stageCode.trim();
  const num = Number(trimmed);
  if (Number.isFinite(num) && num >= 1 && num <= 99) {
    return String(Math.trunc(num)).padStart(2, "0");
  }
  return trimmed.padStart(2, "0");
}

export function getMasterTaxonomyForStage(
  stageCode: string
): MasterStageTaxonomyEntry | null {
  const key = normalizeStageCode(stageCode);
  return MASTER_EAP_TAXONOMY[key] ?? null;
}

export function resolveOfficialDiscipline(stageCode: string): string {
  const entry = getMasterTaxonomyForStage(stageCode);
  if (entry) return entry.discipline;
  return "Complementares / Outros";
}

export function resolveOfficialTeamCodeForStage(stageCode: string): EapTeamCode {
  const entry = getMasterTaxonomyForStage(stageCode);
  return entry?.defaultTeamCode ?? "A";
}

export function resolveOfficialPhaseForStage(stageCode: string): {
  code: string;
  name: string;
} {
  const entry = getMasterTaxonomyForStage(stageCode);
  if (entry) {
    return { code: entry.phaseCode, name: entry.phaseName };
  }
  return { code: "F6", name: "Fase 6 — Finais & Entrega" };
}
