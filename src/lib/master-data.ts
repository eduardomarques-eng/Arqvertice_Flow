/**
 * CENTRAL DE CADASTROS MESTRES (Single Source of Truth)
 * ====================================================
 * Define a parametrização normativa e corporativa do estúdio ArqVértice Flow.
 * Alimenta automaticamente selects, modais, tabelas, filtros e dashboards da aplicação.
 */

export interface MasterDiscipline {
  key: string;
  name: string;
  shortName: string;
  lead: string;
  tool: string;
  icon: string;
  color: string;
  badgeTone: "neutral" | "blue" | "green" | "amber" | "red";
}

export interface MasterPhase {
  key: "PROJETO_PRELIMINAR" | "PROJETO_LEGAL" | "PROJETO_EXECUTIVO";
  order: number;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  badgeTone: "neutral" | "blue" | "green" | "amber" | "red";
}

export interface MasterRole {
  role: "ADMIN" | "ARQUITETO" | "ENGENHEIRO" | "EQUIPE" | "CLIENTE" | "OPERADOR";
  label: string;
  designation: string;
  referencePerson: string;
  description: string;
  badgeTone: "neutral" | "blue" | "green" | "amber" | "red";
  defaultCanEdit: boolean;
}

/**
 * 1. DISCIPLINAS PADRÃO DO ESTÚDIO
 */
export const MASTER_DISCIPLINES: MasterDiscipline[] = [
  {
    key: "ARQUITETURA",
    name: "Arquitetura",
    shortName: "ARQ",
    lead: "Eduardo Marques",
    tool: "Desenho Técnico e Plantas Executivas",
    icon: "🏛️",
    color: "indigo",
    badgeTone: "blue",
  },
  {
    key: "ESTRUTURAL",
    name: "Engenharia Estrutural",
    shortName: "EST",
    lead: "Eng. Luan Almeida",
    tool: "Cálculo Estrutural e Concreto Armado",
    icon: "🏗️",
    color: "amber",
    badgeTone: "amber",
  },
  {
    key: "HIDROSSANITARIO",
    name: "Instalações Hidrossanitárias",
    shortName: "HID",
    lead: "Equipe Técnica",
    tool: "Modelagem e Instalações Prediais",
    icon: "💧",
    color: "sky",
    badgeTone: "blue",
  },
  {
    key: "ELETRICO",
    name: "Instalações Elétricas",
    shortName: "ELE",
    lead: "Equipe Técnica",
    tool: "Modelagem e Instalações Prediais",
    icon: "⚡",
    color: "yellow",
    badgeTone: "amber",
  },
  {
    key: "COMBATE_INCENDIO",
    name: "Combate a Incêndio",
    shortName: "INC",
    lead: "Equipe Técnica",
    tool: "Modelagem e Instalações Prediais",
    icon: "🔥",
    color: "rose",
    badgeTone: "red",
  },
  {
    key: "RENDER_3D",
    name: "Modelagem 3D e Imagens Finais",
    shortName: "3D",
    lead: "Visualização 3D",
    tool: "Renderização e Iluminação Fotorrealista",
    icon: "🎨",
    color: "fuchsia",
    badgeTone: "neutral",
  },
  {
    key: "LEGAL_APROVACAO",
    name: "Aprovação Legal / ART",
    shortName: "LEG",
    lead: "Eng. Luan Almeida",
    tool: "CREA / CAU / Prefeitura",
    icon: "📜",
    color: "slate",
    badgeTone: "neutral",
  },
];

/**
 * 2. FASES NORMATIVAS PADRONIZADAS
 */
export const MASTER_PHASES: MasterPhase[] = [
  {
    key: "PROJETO_PRELIMINAR",
    order: 1,
    label: "Projeto Preliminar",
    shortLabel: "Preliminar",
    icon: "📐",
    description: "Estudos preliminares, plantas conceituais e definições de layout",
    badgeTone: "blue",
  },
  {
    key: "PROJETO_LEGAL",
    order: 2,
    label: "Projeto Legal",
    shortLabel: "Legal",
    icon: "🏛️",
    description: "Pranchas para aprovação em Prefeitura, Condomínio e órgãos reguladores",
    badgeTone: "amber",
  },
  {
    key: "PROJETO_EXECUTIVO",
    order: 3,
    label: "Projeto Executivo",
    shortLabel: "Executivo",
    icon: "🏗️",
    description: "Detalhamentos construtivos, compatibilização e especificações de obra",
    badgeTone: "green",
  },
];

/**
 * 3. PAPÉIS CORPORATIVOS E PERFIS DE ACESSO (RBAC)
 */
export const MASTER_ROLES: MasterRole[] = [
  {
    role: "ADMIN",
    label: "ADMIN / Arquiteto Titular",
    designation: "Arquiteto Titular & Diretor Executivo",
    referencePerson: "Eduardo Marques",
    description: "Acesso irrestrito a governança corporativa, cadastros mestres, financeiro e homologação de projetos.",
    badgeTone: "blue",
    defaultCanEdit: true,
  },
  {
    role: "ENGENHEIRO",
    label: "ENGENHEIRO / Engenharia Estrutural",
    designation: "Engenheiro Calculista & Compatibilizador",
    referencePerson: "Luan Almeida",
    description: "Gestão técnica de cálculo estrutural, pranchas complementares prediais, ARTs e checklists de integridade.",
    badgeTone: "amber",
    defaultCanEdit: true,
  },
  {
    role: "EQUIPE",
    label: "EQUIPE / Engenharia & Operações",
    designation: "Engenheiro Projetista",
    referencePerson: "Wagner Silva",
    description: "Operação técnica de cronograma, desenvolvimento de projetos complementares e suporte de engenharia.",
    badgeTone: "green",
    defaultCanEdit: true,
  },
  {
    role: "CLIENTE",
    label: "CLIENTE / Residência de Praia",
    designation: "Contratante / Proprietário",
    referencePerson: "Pedro",
    description: "Acesso ao portal exclusivo do cliente, visualização das pranchas liberadas e relatórios de avanço.",
    badgeTone: "neutral",
    defaultCanEdit: false,
  },
  {
    role: "ARQUITETO",
    label: "ARQUITETO / Arquitetura & Obra",
    designation: "Arquiteto de Obra",
    referencePerson: "Erick Santiago",
    description: "Acompanhamento executivo de obras, compatibilização técnica in loco e projetos de arquitetura.",
    badgeTone: "blue",
    defaultCanEdit: true,
  },
];

/**
 * Funções utilitárias auxiliares para selects, modais e filtros
 */
/**
 * Menus Suspensos Padronizados Oficiais - ArqVértice Flow
 * Reflete estritamente os 5 profissionais oficiais do estúdio
 */
export const STANDARDIZED_RESPONSIBLES = [
  "Eduardo Marques",
  "Luan Almeida",
  "Erick Santiago",
  "Claudio Marrocos",
  "Wagner Silva",
] as const;

export const STANDARDIZED_DISCIPLINES = [
  "Arquitetura",
  "Engenharia Estrutural",
  "Instalações Prediais",
  "Modelagem 3D & Imagens",
] as const;

export const STANDARDIZED_PHASES = [
  "Projeto Preliminar",
  "Projeto Legal",
  "Projeto Executivo",
] as const;

export const STANDARDIZED_FINANCIAL_STATUSES = [
  { value: "PENDING", label: "Pendente" },
  { value: "PAID", label: "Pago" },
  { value: "OVERDUE", label: "Atrasado" },
] as const;

export function getDisciplineMaster(key: string | null | undefined): MasterDiscipline {
  if (!key) return MASTER_DISCIPLINES[0];
  const normalized = key.toUpperCase().trim();
  const found = MASTER_DISCIPLINES.find(
    (d) => d.key === normalized || d.name.toUpperCase() === normalized || d.shortName === normalized
  );
  return found || MASTER_DISCIPLINES[0];
}

export function getPhaseMaster(key: string | null | undefined): MasterPhase {
  if (!key) return MASTER_PHASES[2]; // Default: Executivo
  const normalized = key.toUpperCase().trim();
  const found = MASTER_PHASES.find((p) => p.key === normalized || p.label.toUpperCase() === normalized);
  return found || MASTER_PHASES[2];
}

export function getRoleMaster(role: string | null | undefined): MasterRole {
  if (!role) return MASTER_ROLES[3]; // Default: CLIENTE
  const normalized = role.toUpperCase().trim();
  const found = MASTER_ROLES.find((r) => r.role === normalized);
  return found || MASTER_ROLES[3];
}
