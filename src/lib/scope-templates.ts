export type ScopeTemplateKey =
  | "COMPLETO"
  | "ARQUITETURA"
  | "INTERIORES"
  | "ESTRUTURAL"
  | "COMPLEMENTARES"
  | "FACHADAS_BIM";

export interface ScopeTemplateDefinition {
  key: ScopeTemplateKey;
  label: string;
  shortDesc: string;
  disciplines: string[];
  objectSummary: string;
  includedItems: string[];
  defaultLines: Array<{
    name: string;
    discipline: string;
    unit: string;
    ratePerM2?: number;
    fixedPrice?: number;
  }>;
  defaultBusinessDays: number;
}

export const SCOPE_TEMPLATES: Record<ScopeTemplateKey, ScopeTemplateDefinition> = {
  COMPLETO: {
    key: "COMPLETO",
    label: "Completo (Arquitetura + Engenharia + BIM)",
    shortDesc: "Pacote integrado com Arquitetura, Estrutural, Complementares MEP e Compatibilização BIM.",
    disciplines: ["Arquitetônico", "Estrutural", "Elétrico", "Hidrossanitário", "Compatibilização BIM"],
    objectSummary:
      "Desenvolvimento de Projeto Arquitetônico Completo, Engenharia Estrutural, Projetos Complementares (Elétrico e Hidrossanitário) e Compatibilização BIM.",
    includedItems: [
      "Estudo Preliminar e Anteprojeto Arquitetônico",
      "Projeto Legal para aprovação municipal",
      "Projeto Executivo de Arquitetura e Detalhamento",
      "Projeto Estrutural (TQS) com dimensionamento e armação",
      "Projetos Complementares (Elétrico, Hidrossanitário e Águas Pluviais)",
      "Compatibilização BIM e caderno de quantitativos",
    ],
    defaultLines: [
      { name: "Projeto Arquitetônico Completo (Estudo, Legal e Executivo)", discipline: "Arquitetônico", unit: "m²", ratePerM2: 110 },
      { name: "Projeto Estrutural em Concreto Armado (TQS)", discipline: "Estrutural", unit: "m²", ratePerM2: 38 },
      { name: "Projetos Complementares MEP (Elétrica + Hidrossanitário)", discipline: "Complementares", unit: "m²", ratePerM2: 34 },
      { name: "Compatibilização BIM & Coordenação Técnica", discipline: "BIM", unit: "vb", fixedPrice: 2800 },
    ],
    defaultBusinessDays: 60,
  },
  ARQUITETURA: {
    key: "ARQUITETURA",
    label: "Arquitetura Residencial / Comercial",
    shortDesc: "Estudo preliminar, anteprojeto, projeto legal, executivo e detalhamento arquitetônico.",
    disciplines: ["Arquitetônico"],
    objectSummary:
      "Elaboração de Projeto Arquitetônico completo contemplando Estudo Preliminar, Anteprojeto, Projeto Legal e Projeto Executivo.",
    includedItems: [
      "Levantamento de programa de necessidades e implantação",
      "Estudo Preliminar em 3D e plantas humanizadas",
      "Projeto Legal conforme código de obras vigente",
      "Projeto Executivo com paginação de pisos, forros, esquadrias e cortes",
    ],
    defaultLines: [
      { name: "Estudo Preliminar e Anteprojeto Arquitetônico", discipline: "Arquitetônico", unit: "m²", ratePerM2: 45 },
      { name: "Projeto Legal e Executivo de Arquitetura", discipline: "Arquitetônico", unit: "m²", ratePerM2: 65 },
    ],
    defaultBusinessDays: 45,
  },
  INTERIORES: {
    key: "INTERIORES",
    label: "Design de Interiores",
    shortDesc: "Layout, marcenaria, luminotécnica, marmoraria, revestimentos e caderno de especificações.",
    disciplines: ["Design de Interiores", "Luminotécnico"],
    objectSummary:
      "Desenvolvimento de Projeto de Design de Interiores com detalhamento de marcenaria, iluminação, marmoraria e especificações.",
    includedItems: [
      "Estudo de layout, fluxos e paleta de materiais",
      "Modelagem 3D fotorrealista dos ambientes",
      "Detalhamento executivo de marcenaria e marmoraria",
      "Projeto luminotécnico, pontos elétricos e automação",
      "Caderno completo de especificações e quantitativos",
    ],
    defaultLines: [
      { name: "Projeto de Design de Interiores & 3D", discipline: "Interiores", unit: "m²", ratePerM2: 85 },
      { name: "Detalhamento de Marcenaria, Marmoraria & Luminotécnica", discipline: "Interiores", unit: "m²", ratePerM2: 45 },
    ],
    defaultBusinessDays: 35,
  },
  ESTRUTURAL: {
    key: "ESTRUTURAL",
    label: "Estrutural (TQS / Concreto & Fundações)",
    shortDesc: "Dimensionamento estrutural, fundações, lajes, vigas, pilares e memória de cálculo.",
    disciplines: ["Estrutural"],
    objectSummary:
      "Elaboração de Projeto Estrutural completo em concreto armado/protendido, incluindo fundações, formas, armações e resumo de aço.",
    includedItems: [
      "Concepção estrutural integrada à arquitetura",
      "Dimensionamento de fundações, pilares, vigas e lajes (TQS)",
      "Plantas de locação de pilares, formas e detalhamento de armações",
      "Relatório de quantitativos de concreto e aço",
    ],
    defaultLines: [
      { name: "Projeto Estrutural Completo (Fundações + Supraestrutura)", discipline: "Estrutural", unit: "m²", ratePerM2: 42 },
    ],
    defaultBusinessDays: 30,
  },
  COMPLEMENTARES: {
    key: "COMPLEMENTARES",
    label: "Complementares / MEP (Elétrica, Hidro, Climatização)",
    shortDesc: "Instalações elétricas, hidrossanitárias, águas pluviais, gás e infraestrutura de climatização.",
    disciplines: ["Elétrico", "Hidrossanitário", "Climatização"],
    objectSummary:
      "Desenvolvimento de Projetos Complementares (Elétrico, Hidrossanitário, Pluvial e Infraestrutura de Climatização).",
    includedItems: [
      "Projeto Elétrico (quadros, circuitos, tomadas, iluminação e SPDA)",
      "Projeto Hidrossanitário (água fria, quente, esgoto e drenagem)",
      "Infraestrutura para ar-condicionado (drenos e carga térmica)",
      "Lista de materiais e especificações técnicas",
    ],
    defaultLines: [
      { name: "Projeto Elétrico & Cabeamento Estruturado", discipline: "Elétrico", unit: "m²", ratePerM2: 18 },
      { name: "Projeto Hidrossanitário & Águas Pluviais", discipline: "Hidrossanitário", unit: "m²", ratePerM2: 18 },
      { name: "Infraestrutura de Climatização & Gás", discipline: "Climatização", unit: "vb", fixedPrice: 1800 },
    ],
    defaultBusinessDays: 30,
  },
  FACHADAS_BIM: {
    key: "FACHADAS_BIM",
    label: "Fachadas BIM & Revestimentos Especiais",
    shortDesc: "Modelagem BIM de fachadas, paginação, brises, esquadrias e compatibilização executiva.",
    disciplines: ["Fachadas BIM", "Arquitetônico"],
    objectSummary:
      "Modelagem e Detalhamento Executivo de Fachadas em BIM, incluindo paginação de revestimentos, esquadrias, brises e iluminação externa.",
    includedItems: [
      "Concepção volumétrica e estudo de insolação/materiais",
      "Modelagem BIM LOD 350 da envoltória e esquadrias",
      "Paginação executiva de revestimentos, ACM, brises e guarda-corpos",
      "Quantitativo extraído direto do modelo BIM",
    ],
    defaultLines: [
      { name: "Modelagem BIM & Detalhamento Executivo de Fachadas", discipline: "Fachadas BIM", unit: "m²", ratePerM2: 55 },
    ],
    defaultBusinessDays: 25,
  },
};

export interface ExtractedBriefingContext {
  hasBriefing: boolean;
  areaM2: number;
  cityState: string;
  typology: string;
  programSummary: string;
  disciplines: string[];
  clientPhone: string;
  suggestedTemplate: ScopeTemplateKey;
}

export function extractBriefingScopeContext(input: {
  projectType?: string | null;
  projectScope?: string | null;
  projectDescription?: string | null;
  clientPhone?: string | null;
  clientCity?: string | null;
  briefingResponses?: unknown;
}): ExtractedBriefingContext {
  const resp =
    input.briefingResponses && typeof input.briefingResponses === "object"
      ? (input.briefingResponses as Record<string, unknown>)
      : {};
  const hasBriefing = Object.keys(resp).length > 0;

  const rawArea =
    resp.area ??
    resp.areaTotal ??
    resp.areaConstruida ??
    resp.metragem ??
    resp.builtAreaM2 ??
    "";
  const parsedArea =
    Number(
      String(rawArea)
        .replace(",", ".")
        .replace(/[^\d.]/g, "")
    ) || 180;

  const cityState = String(
    resp.cidade ?? resp.city ?? resp.localizacao ?? input.clientCity ?? "Fortaleza - CE"
  ).trim();

  const typology = String(
    resp.tipologia ?? resp.tipoObra ?? input.projectType ?? "Residencial / Alto Padrão"
  ).trim();

  const rawDisciplines = Array.isArray(resp.disciplinas)
    ? resp.disciplinas.map(String)
    : Array.isArray(resp.disciplines)
      ? resp.disciplines.map(String)
      : typeof resp.disciplinas === "string"
        ? resp.disciplinas.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
        : [];

  const programParts = [
    resp.programaNecessidades,
    resp.objetivo,
    resp.ambientes,
    resp.observacoes,
    input.projectScope,
    input.projectDescription,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  const lowerJoined = `${typology} ${rawDisciplines.join(" ")} ${programParts.join(" ")}`.toLowerCase();
  let suggestedTemplate: ScopeTemplateKey = "COMPLETO";
  if (lowerJoined.includes("interior")) suggestedTemplate = "INTERIORES";
  else if (lowerJoined.includes("fachada")) suggestedTemplate = "FACHADAS_BIM";
  else if (lowerJoined.includes("estrutural") && !lowerJoined.includes("arquitet")) suggestedTemplate = "ESTRUTURAL";
  else if ((lowerJoined.includes("eletric") || lowerJoined.includes("hidro")) && !lowerJoined.includes("arquitet")) {
    suggestedTemplate = "COMPLEMENTARES";
  } else if (rawDisciplines.length === 1 && lowerJoined.includes("arquitet")) {
    suggestedTemplate = "ARQUITETURA";
  }

  return {
    hasBriefing,
    areaM2: parsedArea,
    cityState,
    typology,
    programSummary: programParts.join(" · "),
    disciplines: rawDisciplines.length > 0 ? rawDisciplines : SCOPE_TEMPLATES[suggestedTemplate].disciplines,
    clientPhone: String(resp.telefone ?? resp.whatsapp ?? input.clientPhone ?? "").trim(),
    suggestedTemplate,
  };
}
