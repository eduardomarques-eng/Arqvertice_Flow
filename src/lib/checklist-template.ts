export const CANONICAL_CHECKLIST_TEMPLATE = [
  // 1. Aprovação Legal & Prefeitura
  {
    category: "Aprovação Legal & Prefeitura",
    task: "Conferência de recuos, taxa de ocupação e gabarito municipal",
    notes: "Alinhado com a Lei de Uso e Ocupação do Solo do Município.",
    isCompleted: true,
    verifiedBy: "Eduardo Marques (CAU)",
  },
  {
    category: "Aprovação Legal & Prefeitura",
    task: "Alvará de construção e protocolo de aprovação no condomínio",
    notes: "Aprovação expedida e protocolo ativo para liberação de obra.",
    isCompleted: true,
    verifiedBy: "Gestão do Loteamento",
  },
  // 2. Compatibilização Técnica (Estrutura x MEP)
  {
    category: "Compatibilização Técnica (Estrutura x MEP)",
    task: "Compatibilização de vigas TQS com shafts e prumadas de esgoto Revit",
    notes: "Conferência de furos em vigas para prumadas de esgoto do piso superior.",
    isCompleted: false,
    verifiedBy: null,
  },
  {
    category: "Compatibilização Técnica (Estrutura x MEP)",
    task: "Passagem de eletrodutos em laje e quadros de distribuição (QDC)",
    notes: "Verificar descidas de tubulações e passagens sem interferência na armadura positiva.",
    isCompleted: false,
    verifiedBy: null,
  },
  // 3. Responsabilidade Técnica & ARTs
  {
    category: "Responsabilidade Técnica & ARTs",
    task: "Emissão e assinatura da ART de Estrutura (Eng. Emanoel Luan Almeida da Rocha)",
    notes: "CREA ativo com recolhimento de taxa e liberação do memorial de cálculo.",
    isCompleted: true,
    verifiedBy: "Emanoel Luan (CREA)",
  },
  {
    category: "Responsabilidade Técnica & ARTs",
    task: "Registro de responsabilidade técnica de Arquitetura e Interiores (Eduardo Marques)",
    notes: "RRT de Execução e Coordenação de Projetos registrada no CAU.",
    isCompleted: true,
    verifiedBy: "Eduardo Marques (CAU)",
  },
  // 4. Liberação para Execução em Canteiro
  {
    category: "Liberação para Execução em Canteiro",
    task: "Locação dos eixos de estacas/sapatas conforme prancha de fundação EST-E01",
    notes: "Conferência topográfica do gabarito de eixos antes das escavações.",
    isCompleted: true,
    verifiedBy: "Topografia / Eng. Campo",
  },
  {
    category: "Liberação para Execução em Canteiro",
    task: "Conferência de cobrimento e armaduras de vigas baldrame antes da concretagem",
    notes: "Uso de espaçadores plásticos para garantir cobrimento mínimo de 3cm contra umidade.",
    isCompleted: false,
    verifiedBy: null,
  },
];
