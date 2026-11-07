import { briefingSections } from "./briefing-definition";
import type { BriefingProgress } from "./briefing-progress";

export interface BriefingOption {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string;
}

export interface BriefingStep {
  id: string;
  category: string;
  question: string;
  description?: string;
  type: "single" | "multiple" | "text" | "visual";
  required?: boolean;
  options?: BriefingOption[];
  defaultSelected?: string[];
}

export const defaultBriefingSteps: BriefingStep[] = [
  {
    id: "step-1",
    category: "Perfil & Ocupação",
    question: "Qual será o uso primordial do imóvel?",
    type: "single",
    required: true,
    options: [
      { id: "moradia", label: "Moradia fixa da família" },
      { id: "veraneio", label: "Casa de praia / veraneio e finais de semana" },
      { id: "investimento", label: "Investimento para locação por temporada (Airbnb / alto padrão)" },
      { id: "comercial", label: "Comercial / Corporativo" }
    ]
  },
  {
    id: "step-2",
    category: "Estilo & Volumetria",
    question: "Qual linguagem estética melhor define a identidade visual desejada?",
    type: "visual",
    required: true,
    options: [
      {
        id: "minimalista",
        label: "Minimalista / Japandi",
        description: "Linhas puras, madeira clara, texturas orgânicas e paleta neutra",
        imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "tropical",
        label: "Tropical Contemporâneo Praiano",
        description: "Beirais generosos, pedras naturais, ventilação cruzada e paisagismo",
        imageUrl: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "moderno",
        label: "Contemporâneo Geométrico",
        description: "Panos de vidro, concreto e planos retos imponentes",
        imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "rustico",
        label: "Rústico Chique / Costeiro",
        description: "Telhado aparente, pérgolas de madeira maciça e elementos artesanais",
        imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80"
      }
    ]
  },
  {
    id: "step-3",
    category: "Área Social",
    question: "Quais ambientes de convivência social e lazer são indispensáveis no projeto?",
    type: "multiple",
    required: true,
    options: [
      { id: "living", label: "Living com pé-direito duplo integrado à cozinha" },
      { id: "gourmet", label: "Espaço Gourmet completo (ilha com churrasqueira e chopeira)" },
      { id: "lounge", label: "Varanda lounge coberta com sofás e balanços suspensos" },
      { id: "adega", label: "Adega climatizada / Nicho bar" },
      { id: "home-theater", label: "Sala de TV / Home theater reservado" },
      { id: "lavabo", label: "Lavabo social de impacto com cuba esculpida" }
    ]
  },
  {
    id: "step-4",
    category: "Área Íntima",
    question: "Qual o dimensionamento necessário para a área privativa da família e hóspedes?",
    type: "multiple",
    required: true,
    options: [
      { id: "master", label: "Suíte Master ampla com closet walk-in e banheiro duplo" },
      { id: "suites-filhos", label: "2 a 3 Suítes para filhos" },
      { id: "suites-hospedes", label: "1 a 2 Suítes exclusivas para hóspedes" },
      { id: "office", label: "Home office privativo com isolamento acústico" },
      { id: "rouparia", label: "Rouparia de corredor e maleiro independente" }
    ]
  },
  {
    id: "step-5",
    category: "Lazer Externo & Piscina",
    question: "Como você visualiza a área de piscina e área externa?",
    type: "visual",
    required: true,
    options: [
      {
        id: "prainha",
        label: "Piscina com Prainha & Hidro",
        description: "Área rasa para espreguiçadeiras na água e hidromassagem integrada",
        imageUrl: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=600&q=80"
      },
      {
        id: "borda-infinita",
        label: "Borda Infinita com Deck",
        description: "Vista livre com acabamento atérmico e deck de madeira",
        imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80"
      }
    ]
  },
  {
    id: "step-6",
    category: "Iluminação & Conforto",
    question: "Quais conceitos de iluminação e conforto são prioritários?",
    type: "multiple",
    required: false,
    options: [
      { id: "luz-quente", label: "Iluminação quente (2700K/3000K) e indireta" },
      { id: "perfis-led", label: "Perfis de LED lineares embutidos e cortineiros" },
      { id: "automacao", label: "Automação inteligente (iluminação, som e climatização)" },
      { id: "solar", label: "Energia solar fotovoltaica e aquecimento de água" }
    ]
  },
  {
    id: "step-7",
    category: "Rotina & Aspirações",
    question: "Descreva hábitos, sonhos ou exigências particulares para o projeto:",
    type: "text",
    required: false
  }
];

export default defaultBriefingSteps;

/* Agrupamento e cálculo de etapas para o GuidedBriefing */
type RawStep = {
  id: string;
  title: string;
  subtitle: string;
  sectionIds: string[];
};

const RAW_STEPS: RawStep[] = [
  {
    id: "quem",
    title: "Quem mora e o projeto",
    subtitle: "Identificação, objetivos e o imóvel",
    sectionIds: ["cliente", "usuarios", "contexto", "imovel", "localizacao"],
  },
  {
    id: "como",
    title: "Como você vive o espaço",
    subtitle: "Ambientes, atributos e rotina",
    sectionIds: ["programa", "ambientes", "rotina"],
  },
  {
    id: "estilo",
    title: "Estilo e sensações",
    subtitle: "Referências, materiais e conforto",
    sectionIds: ["estilo", "referencias", "percepcao", "materiais", "conforto"],
  },
  {
    id: "entrega",
    title: "Técnico, prazo e entrega",
    subtitle: "Requisitos, orçamento, serviços e arquivos",
    sectionIds: [
      "tecnico",
      "acessibilidade",
      "orcamento",
      "prazo",
      "servicos",
      "documentos",
      "observacoes",
      "revisao",
    ],
  },
];

export type BriefingStepGroup = {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  sectionIds: string[];
  sectionIndexes: number[];
};

const SECTION_INDEX = new Map(briefingSections.map((section, index) => [section.id, index]));

export const briefingStepGroups: BriefingStepGroup[] = RAW_STEPS.map((step, index) => ({
  ...step,
  index,
  sectionIndexes: step.sectionIds
    .map((id) => SECTION_INDEX.get(id))
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b),
}));

export function stepIndexOfSection(sectionIndex: number): number {
  const found = briefingStepGroups.findIndex((group) => group.sectionIndexes.includes(sectionIndex));
  return found === -1 ? briefingStepGroups.length - 1 : found;
}

export function stepProgress(group: BriefingStepGroup, progress: BriefingProgress): number {
  const rows = progress.sections.filter((row) => group.sectionIds.includes(row.id));
  const applicable = rows.reduce((sum, row) => sum + row.applicable, 0);
  if (applicable === 0) return 100;
  const answered = rows.reduce((sum, row) => sum + (row.percent * row.applicable) / 100, 0);
  return Math.round((answered / applicable) * 100);
}
