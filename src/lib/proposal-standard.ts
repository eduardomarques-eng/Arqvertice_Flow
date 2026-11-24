export type ProposalScopePresetKey =
  | "INTERIORES"
  | "ARQUITETURA"
  | "ESTRUTURAL"
  | "COMPLEMENTARES"
  | "FACHADAS_BIM"
  | "PERSONALIZADO";

export interface ProposalDiagnosisPhoto {
  url: string;
  caption: string;
}

export interface ProposalScopeGroup {
  title: string;
  items: string[];
}

export interface ProposalSchedulePhase {
  code: string;
  title: string;
  businessDays: number;
  deliverables: string;
}

export interface ProposalInvestmentOption {
  id: string;
  name: string;
  mode: "PER_M2" | "FIXED";
  areaM2: number;
  unitPricePerM2: number;
  fixedAmount: number;
  summary: string;
  recommended?: boolean;
}

export interface ProposalPaymentInstallmentSpec {
  label: string;
  percent: number;
}

export interface ProposalEditorialData {
  presetKey: ProposalScopePresetKey;
  cover: {
    subtitle: string;
    areaM2: number;
    technicalLead: string;
    coverImageUrl: string;
  };
  diagnosis: {
    enabled: boolean;
    propertyAnalysis: string;
    structuralNote: string;
    projectFocus: string;
    photos: ProposalDiagnosisPhoto[];
  };
  scopeGroups: ProposalScopeGroup[];
  schedule: {
    totalBusinessDays: number;
    phases: ProposalSchedulePhase[];
  };
  investmentOptions: ProposalInvestmentOption[];
  paymentCondition: {
    installments: ProposalPaymentInstallmentSpec[];
    method: string;
    pixNote: string;
  };
  optionalBlocks: {
    technicalHighlight: { enabled: boolean; title: string; body: string };
    moodboard: { enabled: boolean; title: string; palette: string; notes: string };
    portfolio: {
      enabled: boolean;
      title: string;
      items: Array<{ title: string; caption: string; imageUrl?: string }>;
    };
  };
  nextSteps: {
    steps: [string, string, string];
    differentials: string[];
  };
}

export interface ProposalScopePresetDefinition {
  key: ProposalScopePresetKey;
  label: string;
  subtitle: string;
  scopeGroups: ProposalScopeGroup[];
  phases: ProposalSchedulePhase[];
  included: string;
  excluded: string;
  premisses: string;
}

export const PROPOSAL_SCOPE_PRESETS: Record<ProposalScopePresetKey, ProposalScopePresetDefinition> = {
  INTERIORES: {
    key: "INTERIORES",
    label: "Design de Interiores",
    subtitle: "Projeto Completo de Arquitetura de Interiores & Marcenaria",
    scopeGroups: [
      {
        title: "Infraestrutura Técnica",
        items: [
          "Levantamento métrico e cadastral no local",
          "Planta de layout e setorização funcional",
          "Pontos elétricos, iluminação e automação",
          "Planta de forro, gesso e paginação de pisos",
        ],
      },
      {
        title: "Design & Decoração",
        items: [
          "Conceito visual, moodboard e paleta de materiais",
          "Modelagem 3D e imagens fotorrealísticas",
          "Especificação de revestimentos, louças e metais",
          "Curadoria de mobiliário solto e adornos",
        ],
      },
      {
        title: "Marcenaria Sob Medida",
        items: [
          "Detalhamento executivo de todos os móveis planejados",
          "Cortes, elevações e especificações de ferragens/MDF",
          "Caderno técnico para cotação com marceneiros",
        ],
      },
    ],
    phases: [
      { code: "Etapa 01", title: "Levantamento & Estudo Preliminar", businessDays: 10, deliverables: "Levantamento, layout e moodboard" },
      { code: "Etapa 02", title: "Anteprojeto & Maquete 3D", businessDays: 15, deliverables: "Perspectivas 3D e validação de materiais" },
      { code: "Etapa 03", title: "Projeto Executivo & Marcenaria", businessDays: 20, deliverables: "Pranchas executivas e caderno de marcenaria" },
    ],
    included: "Levantamento in loco, maquete 3D, caderno executivo em PDF e até 2 rodadas de ajustes por etapa.",
    excluded: "Taxas de prefeitura/condomínio, ARTs de terceiros, execução de obra e compra de insumos.",
    premisses:
      "Prazos contados em dias úteis a partir da compensação da entrada e realização da medição.\nAlterações após etapa aprovada serão orçadas como aditivo.",
  },
  ARQUITETURA: {
    key: "ARQUITETURA",
    label: "Arquitetura",
    subtitle: "Projeto Arquitetônico Completo — Estudo, Legal & Executivo BIM",
    scopeGroups: [
      {
        title: "Concepção & Estudo Preliminar",
        items: [
          "Análise bioclimática, insolação e implantação no lote",
          "Plantas baixas conceituais e volumetria 3D",
          "Validação de programa de necessidades",
        ],
      },
      {
        title: "Projeto Legal (Prefeitura / Condomínio)",
        items: [
          "Pranchas conforme código de obras municipal e regimento",
          "Quadro de áreas, recuos e índices urbanísticos",
          "Emissão de RRT/ART de autoria de projeto",
        ],
      },
      {
        title: "Projeto Executivo BIM",
        items: [
          "Plantas cotadas, cortes, fachadas e cobertura",
          "Detalhamento de esquadrias, áreas molhadas e paginações",
          "Compatibilização arquitetônica com disciplinas complementares",
        ],
      },
    ],
    phases: [
      { code: "Etapa 01", title: "Estudo Preliminar & Volumetria", businessDays: 15, deliverables: "Implantação, plantas e volumetria 3D" },
      { code: "Etapa 02", title: "Anteprojeto & Projeto Legal", businessDays: 20, deliverables: "Jogo de pranchas para aprovação legal" },
      { code: "Etapa 03", title: "Projeto Executivo Completo", businessDays: 25, deliverables: "Pranchas executivas BIM e detalhamentos" },
    ],
    included: "Modelagem BIM, RRT/ART do projeto arquitetônico, reuniões de alinhamento e entrega em PDF técnico.",
    excluded: "Levantamento topográfico, sondagem SPT, taxas cartorárias/municipais e execução de obra.",
    premisses:
      "O contratante fornecerá matrícula atualizada, levantamento topográfico e regimento do condomínio antes do início.\nModificações após aprovação da etapa geram replanejamento de prazo.",
  },
  ESTRUTURAL: {
    key: "ESTRUTURAL",
    label: "Estrutural",
    subtitle: "Projeto Estrutural em Concreto Armado / Metálico via TQS & BIM",
    scopeGroups: [
      {
        title: "Modelagem & Análise Estrutural",
        items: [
          "Lançamento estrutural compatibilizado com arquitetura",
          "Dimensionamento de fundações, pilares, vigas e lajes",
          "Verificação de flechas, fissuração e estabilidade global",
        ],
      },
      {
        title: "Detalhamento Executivo",
        items: [
          "Plantas de fôrmas e locação de fundações",
          "Armação detalhada de todos os elementos estruturais",
          "Resumo quantitativo de aço, concreto e fôrma",
        ],
      },
    ],
    phases: [
      { code: "Etapa 01", title: "Lançamento & Pré-Dimensionamento", businessDays: 10, deliverables: "Concepção estrutural e locação de pilares" },
      { code: "Etapa 02", title: "Cálculo & Fôrmas", businessDays: 15, deliverables: "Plantas de fôrma e cargas nas fundações" },
      { code: "Etapa 03", title: "Armação & Quantitativos", businessDays: 15, deliverables: "Pranchas executivas TQS e resumo de materiais" },
    ],
    included: "Memorial de cálculo resumido, pranchas em PDF e DWG, quantitativos estruturais e ART de projeto estrutural.",
    excluded: "Sondagem de solo (SPT), ensaios tecnológicos de concreto e acompanhamento diário de concretagem.",
    premisses:
      "O projeto estrutural depende da entrega prévia do projeto arquitetônico aprovado e do laudo de sondagem SPT do terreno.",
  },
  COMPLEMENTARES: {
    key: "COMPLEMENTARES",
    label: "Complementares / MEP",
    subtitle: "Projetos Elétrico, Hidrossanitário, Drenagem & Climatização",
    scopeGroups: [
      {
        title: "Instalações Elétricas & Automação",
        items: [
          "Quadros de distribuição, circuitos e balanceamento de cargas",
          "Pontos de força, iluminação, dados e SPDA (quando aplicável)",
          "Lista completa de cabos, disjuntores e infraestrutura",
        ],
      },
      {
        title: "Instalações Hidrossanitárias",
        items: [
          "Água fria, água quente, esgoto sanitário e ventilação",
          "Drenagem pluvial, reservatórios e isométricos",
          "Compatibilização BIM sem interferências estruturais",
        ],
      },
    ],
    phases: [
      { code: "Etapa 01", title: "Traçado Preliminar & Cargas", businessDays: 10, deliverables: "Pontos de consumo e prumadas" },
      { code: "Etapa 02", title: "Compatibilização BIM MEP", businessDays: 12, deliverables: "Verificação de interferências" },
      { code: "Etapa 03", title: "Executivo & Lista de Materiais", businessDays: 13, deliverables: "Pranchas executivas, diagramas e listas" },
    ],
    included: "Dimensionamento normativo (NBR 5410 / NBR 5626), isométricos, quadros de cargas e lista de insumos.",
    excluded: "Aprovação junto a concessionárias (Enel/Cagece), execução física e fornecimento de equipamentos.",
    premisses:
      "Arquitetura e estrutura base devem estar congeladas antes da emissão do executivo de complementares.",
  },
  FACHADAS_BIM: {
    key: "FACHADAS_BIM",
    label: "Fachadas / BIM",
    subtitle: "Design de Fachadas, Revitalização & Coordenação BIM",
    scopeGroups: [
      {
        title: "Estética & Volumetria de Fachada",
        items: [
          "Estudo volumétrico 3D e composição de materiais",
          "Especificação de revestimentos, brises, iluminações e esquadrias",
          "Renders em alta definição (diurno e noturno)",
        ],
      },
      {
        title: "Detalhamento Executivo de Fachada",
        items: [
          "Elevações cotadas e paginação de revestimentos",
          "Detalhes construtivos de pingadeiras, rufos e fixações",
        ],
      },
    ],
    phases: [
      { code: "Etapa 01", title: "Levantamento & Conceito 3D", businessDays: 10, deliverables: "Estudo volumétrico e imagens 3D" },
      { code: "Etapa 02", title: "Executivo de Fachadas", businessDays: 15, deliverables: "Elevações, cortes e especificações" },
    ],
    included: "Modelagem 3D, renders diurno/noturno e caderno executivo de revestimentos de fachada.",
    excluded: "Laudos de estabilidade de fachada existente e execução de andaimes/obra.",
    premisses: "Fotos atualizadas e medidas da edificação existente devem ser fornecidas na contratação.",
  },
  PERSONALIZADO: {
    key: "PERSONALIZADO",
    label: "Personalizado",
    subtitle: "Escopo Sob Medida — ArqVértice Studio",
    scopeGroups: [
      {
        title: "Escopo Principal",
        items: ["Detalhamento técnico conforme necessidade específica do empreendimento"],
      },
    ],
    phases: [
      { code: "Etapa 01", title: "Alinhamento & Desenvolvimento", businessDays: 15, deliverables: "Entregáveis técnicos acordados" },
    ],
    included: "Entrega digital em PDF de alta resolução via Portal do Cliente ArqVértice OS.",
    excluded: "Taxas de órgãos públicos, sondagens e execução física de obra.",
    premisses: "Condições e prazos iniciam após confirmação da entrada contratual.",
  },
};

export function roundCurrency(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function computeInvestmentOptionTotal(option: ProposalInvestmentOption): number {
  if (option.mode === "PER_M2") {
    return roundCurrency(Math.max(0, Number(option.areaM2) || 0) * Math.max(0, Number(option.unitPricePerM2) || 0));
  }
  return roundCurrency(Math.max(0, Number(option.fixedAmount) || 0));
}

export function computeOptionInstallments(
  total: number,
  specs: ProposalPaymentInstallmentSpec[],
): Array<{ label: string; percent: number; amount: number }> {
  const safeTotal = roundCurrency(Math.max(0, total));
  if (!specs.length) return [];
  const rows = specs.map((spec) => ({
    label: spec.label,
    percent: Number(spec.percent) || 0,
    amount: roundCurrency((safeTotal * (Number(spec.percent) || 0)) / 100),
  }));
  const sum = roundCurrency(rows.reduce((acc, row) => acc + row.amount, 0));
  const diff = roundCurrency(safeTotal - sum);
  if (rows.length > 0 && Math.abs(diff) > 0 && Math.abs(diff) <= 0.1) {
    rows[rows.length - 1].amount = roundCurrency(rows[rows.length - 1].amount + diff);
  }
  return rows;
}

/**
 * Lê e normaliza premissas unificando a chave oficial `premisses`
 * (mantendo compatibilidade retroativa com registros legados em `premises`).
 */
export function readNormalizedPremisses(formalText: Record<string, unknown> | null | undefined): string[] {
  if (!formalText || typeof formalText !== "object") return [];
  const raw = formalText.premisses ?? formalText.premises;
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

export function readNormalizedPremissesText(formalText: Record<string, unknown> | null | undefined): string {
  return readNormalizedPremisses(formalText).join("\n");
}

export function buildDefaultEditorialData(input?: {
  presetKey?: ProposalScopePresetKey;
  areaM2?: number;
  technicalLead?: string;
  projectType?: string;
  totalValue?: number;
}): ProposalEditorialData {
  const key = input?.presetKey && PROPOSAL_SCOPE_PRESETS[input.presetKey] ? input.presetKey : "ARQUITETURA";
  const preset = PROPOSAL_SCOPE_PRESETS[key];
  const area = Number(input?.areaM2) > 0 ? Number(input?.areaM2) : 180;
  const totalBusinessDays = preset.phases.reduce((acc, p) => acc + p.businessDays, 0);
  const defaultUnitPrice = input?.totalValue && input.totalValue > 0 && area > 0 ? roundCurrency(input.totalValue / area) : 95;

  return {
    presetKey: key,
    cover: {
      subtitle: input?.projectType ? `${preset.subtitle} — ${input.projectType}` : preset.subtitle,
      areaM2: area,
      technicalLead: input?.technicalLead || "ArqVértice Studio | Eduardo Marques",
      coverImageUrl: "",
    },
    diagnosis: {
      enabled: false,
      propertyAnalysis: "",
      structuralNote: "",
      projectFocus: "",
      photos: [],
    },
    scopeGroups: preset.scopeGroups.map((g) => ({ title: g.title, items: [...g.items] })),
    schedule: {
      totalBusinessDays,
      phases: preset.phases.map((p) => ({ ...p })),
    },
    investmentOptions: [
      {
        id: "opt-1",
        name: "Opção 01 — Padrão Completo",
        mode: "PER_M2",
        areaM2: area,
        unitPricePerM2: defaultUnitPrice,
        fixedAmount: roundCurrency(area * defaultUnitPrice),
        summary: "Escopo técnico completo com entrega executiva e suporte",
        recommended: true,
      },
    ],
    paymentCondition: {
      installments: [
        { label: "Sinal na assinatura", percent: 30 },
        { label: "Entrega do Anteprojeto", percent: 35 },
        { label: "Entrega Final Executiva", percent: 35 },
      ],
      method: "PIX / Transferência Bancária (Chave CNPJ oficial do estúdio)",
      pixNote: "Pagamento via PIX oficial CNPJ ArqVértice Studio.",
    },
    optionalBlocks: {
      technicalHighlight: { enabled: false, title: "Destaque Técnico & Detalhamento", body: "" },
      moodboard: { enabled: false, title: "Moodboard & Paleta de Materiais", palette: "", notes: "" },
      portfolio: { enabled: false, title: "Referências de Portfólio & Pranchas", items: [] },
    },
    nextSteps: {
      steps: [
        "1. Aprovação desta proposta digital e conferência do escopo.",
        "2. Emissão e assinatura do Contrato de Prestação de Serviços.",
        "3. Quitação da 1ª parcela (entrada) e reunião de Kick-off técnico.",
      ],
      differentials: [
        "Compatibilização BIM e controle rigoroso de revisões no Acervo CDE",
        "Portal do Cliente exclusivo com acompanhamento de cronograma e parcelas",
        "Atendimento direto pelo responsável técnico em Fortaleza/CE e região",
      ],
    },
  };
}

export function readProposalEditorial(
  formalText: Record<string, unknown> | null | undefined,
  fallback?: { areaM2?: number; totalValue?: number; technicalLead?: string; projectType?: string },
): ProposalEditorialData {
  const base = buildDefaultEditorialData(fallback);
  if (!formalText || typeof formalText !== "object") return base;
  const raw = formalText.editorial;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const ed = raw as Partial<ProposalEditorialData>;

  return {
    presetKey: ed.presetKey && PROPOSAL_SCOPE_PRESETS[ed.presetKey] ? ed.presetKey : base.presetKey,
    cover: {
      subtitle: typeof ed.cover?.subtitle === "string" ? ed.cover.subtitle : base.cover.subtitle,
      areaM2: Number(ed.cover?.areaM2) > 0 ? Number(ed.cover?.areaM2) : base.cover.areaM2,
      technicalLead: typeof ed.cover?.technicalLead === "string" && ed.cover.technicalLead.trim()
        ? ed.cover.technicalLead
        : base.cover.technicalLead,
      coverImageUrl: typeof ed.cover?.coverImageUrl === "string" ? ed.cover.coverImageUrl : "",
    },
    diagnosis: {
      enabled: Boolean(ed.diagnosis?.enabled),
      propertyAnalysis: typeof ed.diagnosis?.propertyAnalysis === "string" ? ed.diagnosis.propertyAnalysis : "",
      structuralNote: typeof ed.diagnosis?.structuralNote === "string" ? ed.diagnosis.structuralNote : "",
      projectFocus: typeof ed.diagnosis?.projectFocus === "string" ? ed.diagnosis.projectFocus : "",
      photos: Array.isArray(ed.diagnosis?.photos)
        ? ed.diagnosis.photos
            .filter((p) => p && typeof p.url === "string")
            .map((p) => ({ url: String(p.url), caption: String(p.caption ?? "") }))
        : [],
    },
    scopeGroups: Array.isArray(ed.scopeGroups) && ed.scopeGroups.length > 0
      ? ed.scopeGroups.map((g) => ({
          title: String(g?.title ?? "Grupo"),
          items: Array.isArray(g?.items) ? g.items.map((i) => String(i ?? "")).filter(Boolean) : [],
        }))
      : base.scopeGroups,
    schedule: {
      totalBusinessDays: Number(ed.schedule?.totalBusinessDays) > 0
        ? Number(ed.schedule?.totalBusinessDays)
        : Array.isArray(ed.schedule?.phases) && ed.schedule.phases.length > 0
          ? ed.schedule.phases.reduce((acc, p) => acc + (Number(p?.businessDays) || 0), 0)
          : base.schedule.totalBusinessDays,
      phases: Array.isArray(ed.schedule?.phases) && ed.schedule.phases.length > 0
        ? ed.schedule.phases.map((p, idx) => ({
            code: String(p?.code ?? `Etapa ${String(idx + 1).padStart(2, "0")}`),
            title: String(p?.title ?? "Etapa"),
            businessDays: Number(p?.businessDays) || 0,
            deliverables: String(p?.deliverables ?? ""),
          }))
        : base.schedule.phases,
    },
    investmentOptions: Array.isArray(ed.investmentOptions) && ed.investmentOptions.length > 0
      ? ed.investmentOptions.map((opt, idx) => ({
          id: String(opt?.id ?? `opt-${idx + 1}`),
          name: String(opt?.name ?? `Opção ${idx + 1}`),
          mode: opt?.mode === "FIXED" ? "FIXED" : "PER_M2",
          areaM2: Number(opt?.areaM2) || 0,
          unitPricePerM2: Number(opt?.unitPricePerM2) || 0,
          fixedAmount: Number(opt?.fixedAmount) || 0,
          summary: String(opt?.summary ?? ""),
          recommended: Boolean(opt?.recommended),
        }))
      : base.investmentOptions,
    paymentCondition: {
      installments: Array.isArray(ed.paymentCondition?.installments) && ed.paymentCondition.installments.length > 0
        ? ed.paymentCondition.installments.map((inst) => ({
            label: String(inst?.label ?? "Parcela"),
            percent: Number(inst?.percent) || 0,
          }))
        : base.paymentCondition.installments,
      method: typeof ed.paymentCondition?.method === "string" && ed.paymentCondition.method.trim()
        ? ed.paymentCondition.method
        : base.paymentCondition.method,
      pixNote: typeof ed.paymentCondition?.pixNote === "string" ? ed.paymentCondition.pixNote : base.paymentCondition.pixNote,
    },
    optionalBlocks: {
      technicalHighlight: {
        enabled: Boolean(ed.optionalBlocks?.technicalHighlight?.enabled),
        title: String(ed.optionalBlocks?.technicalHighlight?.title ?? base.optionalBlocks.technicalHighlight.title),
        body: String(ed.optionalBlocks?.technicalHighlight?.body ?? ""),
      },
      moodboard: {
        enabled: Boolean(ed.optionalBlocks?.moodboard?.enabled),
        title: String(ed.optionalBlocks?.moodboard?.title ?? base.optionalBlocks.moodboard.title),
        palette: String(ed.optionalBlocks?.moodboard?.palette ?? ""),
        notes: String(ed.optionalBlocks?.moodboard?.notes ?? ""),
      },
      portfolio: {
        enabled: Boolean(ed.optionalBlocks?.portfolio?.enabled),
        title: String(ed.optionalBlocks?.portfolio?.title ?? base.optionalBlocks.portfolio.title),
        items: Array.isArray(ed.optionalBlocks?.portfolio?.items)
          ? ed.optionalBlocks.portfolio.items.map((item) => ({
              title: String(item?.title ?? ""),
              caption: String(item?.caption ?? ""),
              imageUrl: typeof item?.imageUrl === "string" ? item.imageUrl : undefined,
            }))
          : [],
      },
    },
    nextSteps: {
      steps: [
        String(ed.nextSteps?.steps?.[0] ?? base.nextSteps.steps[0]),
        String(ed.nextSteps?.steps?.[1] ?? base.nextSteps.steps[1]),
        String(ed.nextSteps?.steps?.[2] ?? base.nextSteps.steps[2]),
      ],
      differentials: Array.isArray(ed.nextSteps?.differentials) && ed.nextSteps.differentials.length > 0
        ? ed.nextSteps.differentials.map(String)
        : base.nextSteps.differentials,
    },
  };
}
