export type EapZoneCode = "FUND_TERREO" | "PAV_SUPERIOR" | "COBERTURA" | "EXTERNO";

export interface MasterEapZoneTemplate {
  code: EapZoneCode;
  name: string;
  orderIndex: number;
}

export interface MasterEapGroupTemplate {
  code: string;
  name: string;
  orderIndex: number;
}

export interface MasterEapStageTemplate {
  code: string; // "01" .. "26"
  name: string;
  orderIndex: number;
  groups: MasterEapGroupTemplate[];
}

export interface MasterProcurementGateTemplate {
  title: string;
  leadTimeDays: number;
}

export interface MasterLobPackageTemplate {
  packageNumber: number; // 1 .. 38
  name: string;
  waveName: string;
  linkedStageCodes: string[];
  predecessorNumbers: number[];
  defaultDurationWorkingDays: number;
  defaultTeamsCount: number;
  procurementGates: MasterProcurementGateTemplate[];
}

export const DEFAULT_EAP_ZONES: MasterEapZoneTemplate[] = [
  { code: "FUND_TERREO", name: "Fundação & Térreo", orderIndex: 1 },
  { code: "PAV_SUPERIOR", name: "Pavimento Superior", orderIndex: 2 },
  { code: "COBERTURA", name: "Cobertura & Reservatório", orderIndex: 3 },
  { code: "EXTERNO", name: "Áreas Externas, Muros & Lazer", orderIndex: 4 },
];

export const MASTER_EAP_STAGES: MasterEapStageTemplate[] = [
  {
    code: "01",
    name: "Implantação da Obra e Serviços Preliminares",
    orderIndex: 1,
    groups: [
      { code: "01.1", name: "Canteiro, Tapume e Ligações Provisórias", orderIndex: 1 },
      { code: "01.2", name: "Locação da Obra, Topografia e Limpeza de Terreno", orderIndex: 2 },
    ],
  },
  {
    code: "02",
    name: "Movimento de Terra e Terraplenagem",
    orderIndex: 2,
    groups: [
      { code: "02.1", name: "Escavação, Aterro Compactado e Bota-Fora", orderIndex: 1 },
    ],
  },
  {
    code: "03",
    name: "Infraestrutura e Fundações",
    orderIndex: 3,
    groups: [
      { code: "03.1", name: "Sapatas, Estacas, Blocos e Lastro de Concreto Magro", orderIndex: 1 },
      { code: "03.2", name: "Vigas Baldrame e Impermeabilização de Fundação", orderIndex: 2 },
    ],
  },
  {
    code: "04",
    name: "Supraestrutura de Concreto Armado",
    orderIndex: 4,
    groups: [
      { code: "04.1", name: "Concreto Usinado e Lançamento/Bombeamento", orderIndex: 1 },
      { code: "04.2", name: "Armação em Aço CA-50 / CA-60 (TQS)", orderIndex: 2 },
      { code: "04.3", name: "Fôrmas de Madeira, Escoramento e Desforma", orderIndex: 3 },
    ],
  },
  {
    code: "05",
    name: "Alvenaria de Vedação e Divisórias",
    orderIndex: 5,
    groups: [
      { code: "05.1", name: "Alvenaria Estrutural / Vedação (Blocos Cerâmicos)", orderIndex: 1 },
      { code: "05.2", name: "Vergas, Contravergas e Encunhamento", orderIndex: 2 },
    ],
  },
  {
    code: "06",
    name: "Cobertura, Telhado e Rufos",
    orderIndex: 6,
    groups: [
      { code: "06.1", name: "Estrutura de Coberta, Telhamento e Calhas/Rufos", orderIndex: 1 },
    ],
  },
  {
    code: "07",
    name: "Impermeabilização e Proteção Mecânica",
    orderIndex: 7,
    groups: [
      { code: "07.1", name: "Manta Asfáltica, Argamassa Polimérica e Testes de Estanqueidade", orderIndex: 1 },
    ],
  },
  {
    code: "08",
    name: "Instalações Elétricas e Automação",
    orderIndex: 8,
    groups: [
      { code: "08.1", name: "Infraestrutura Seca (Eletrodutos, Caixas e Quadros)", orderIndex: 1 },
      { code: "08.2", name: "Cabeamento, Disjuntores, Tomadas e Interruptores", orderIndex: 2 },
    ],
  },
  {
    code: "09",
    name: "Instalações Hidrossanitárias e Águas Pluviais",
    orderIndex: 9,
    groups: [
      { code: "09.1", name: "Água Fria, Água Quente, Esgoto e Drenagem Pluvial", orderIndex: 1 },
      { code: "09.2", name: "Reservatório Superior, Barrilete e Pressurização", orderIndex: 2 },
    ],
  },
  {
    code: "10",
    name: "Instalações de Gás, Climatização e Especiais",
    orderIndex: 10,
    groups: [
      { code: "10.1", name: "Infraestrutura de Ar-Condicionado (Cobre/Dreno) e Gás GLP", orderIndex: 1 },
    ],
  },
  {
    code: "11",
    name: "Revestimento de Paredes Internas",
    orderIndex: 11,
    groups: [
      { code: "11.1", name: "Chapisco, Emboço e Reboco de Gesso / Massa Única", orderIndex: 1 },
      { code: "11.2", name: "Revestimento Cerâmico / Porcelanato em Áreas Molhadas", orderIndex: 2 },
    ],
  },
  {
    code: "12",
    name: "Revestimento de Fachadas e Muros Externos",
    orderIndex: 12,
    groups: [
      { code: "12.1", name: "Chapisco, Emboço Externo, Textura e Revestimentos Especiais", orderIndex: 1 },
    ],
  },
  {
    code: "13",
    name: "Contrapiso e Regularização de Pisos",
    orderIndex: 13,
    groups: [
      { code: "13.1", name: "Contrapiso Nivelado e Caimento em Áreas Molhadas", orderIndex: 1 },
    ],
  },
  {
    code: "14",
    name: "Pisos, Porcelanatos e Rodapés",
    orderIndex: 14,
    groups: [
      { code: "14.1", name: "Assentamento de Porcelanatos, Pedras Naturais e Rejuntamento", orderIndex: 1 },
      { code: "14.2", name: "Rodapés, Soleiras e Pingadeiras", orderIndex: 2 },
    ],
  },
  {
    code: "15",
    name: "Forros de Gesso e Sancas",
    orderIndex: 15,
    groups: [
      { code: "15.1", name: "Forro de Gesso Acartonado, Cortineiros e Tabicas", orderIndex: 1 },
    ],
  },
  {
    code: "16",
    name: "Esquadrias de Alumínio, Vidros e Guarda-Corpos",
    orderIndex: 16,
    groups: [
      { code: "16.1", name: "Contramarcos, Portas e Janelas de Alumínio + Vidro", orderIndex: 1 },
      { code: "16.2", name: "Guarda-Corpos, Corrimãos e Brises", orderIndex: 2 },
    ],
  },
  {
    code: "17",
    name: "Esquadrias de Madeira e Ferragens",
    orderIndex: 17,
    groups: [
      { code: "17.1", name: "Portas Prontas de Madeira, Alizares e Fechaduras", orderIndex: 1 },
    ],
  },
  {
    code: "18",
    name: "Marmoraria, Bancadas e Escadas",
    orderIndex: 18,
    groups: [
      { code: "18.1", name: "Bancadas de Granito / Quartzo, Nichos e Revestimento de Escada", orderIndex: 1 },
    ],
  },
  {
    code: "19",
    name: "Pintura Interna e Externa",
    orderIndex: 19,
    groups: [
      { code: "19.1", name: "Selador, Massa Corrida/Acrílica e Pintura Interna", orderIndex: 1 },
      { code: "19.2", name: "Pintura Externa Acrílica e Texturas de Fachada", orderIndex: 2 },
    ],
  },
  {
    code: "20",
    name: "Louças, Metais e Acessórios",
    orderIndex: 20,
    groups: [
      { code: "20.1", name: "Bacias Sanitárias, Cubas, Torneiras, Registros e Chuveiros", orderIndex: 1 },
    ],
  },
  {
    code: "21",
    name: "Luminotécnica e Acabamento Elétrico",
    orderIndex: 21,
    groups: [
      { code: "21.1", name: "Instalação de Luminárias, Perfis LED, Spots e Pendentes", orderIndex: 1 },
    ],
  },
  {
    code: "22",
    name: "Piscina, Deck e Área Gourmet",
    orderIndex: 22,
    groups: [
      { code: "22.1", name: "Estrutura, Impermeabilização, Revestimento e Casa de Máquinas", orderIndex: 1 },
    ],
  },
  {
    code: "23",
    name: "Paisagismo, Calçadas e Pavimentação Externa",
    orderIndex: 23,
    groups: [
      { code: "23.1", name: "Piso Intertravado, Calçadas, Pergolado e Paisagismo", orderIndex: 1 },
    ],
  },
  {
    code: "24",
    name: "Serralheria, Portões e Automação de Acesso",
    orderIndex: 24,
    groups: [
      { code: "24.1", name: "Portão de Garagem, Portão Social, Gradis e Motores", orderIndex: 1 },
    ],
  },
  {
    code: "25",
    name: "Administração Local e Mão de Obra Indireta",
    orderIndex: 25,
    groups: [
      { code: "25.1", name: "Mestre de Obras, Almoxarife, Caçambas e Equipamentos", orderIndex: 1 },
    ],
  },
  {
    code: "26",
    name: "Limpeza Final, Comissionamento e Entrega",
    orderIndex: 26,
    groups: [
      { code: "26.1", name: "Limpeza Pós-Obra, Testes Finais e Vistoria de Entrega", orderIndex: 1 },
    ],
  },
];

export const MASTER_LOB_PACKAGES: MasterLobPackageTemplate[] = [
  {
    packageNumber: 1,
    name: "Canteiro, Muro e Tapume",
    waveName: "Fase 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["01"],
    predecessorNumbers: [],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Tapume, Container e Ligação Provisória", leadTimeDays: 10 }],
  },
  {
    packageNumber: 2,
    name: "Locação da Obra e Gabarito",
    waveName: "Fase 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["01"],
    predecessorNumbers: [1],
    defaultDurationWorkingDays: 5,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 3,
    name: "Movimento de Terra e Escavação de Fundações",
    waveName: "Fase 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["02"],
    predecessorNumbers: [2],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Locação de Retroescavadeira / Caçambas", leadTimeDays: 7 }],
  },
  {
    packageNumber: 4,
    name: "Fundações Profundas / Sapatas e Blocos",
    waveName: "Fase 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["03"],
    predecessorNumbers: [3],
    defaultDurationWorkingDays: 15,
    defaultTeamsCount: 1,
    procurementGates: [
      { title: "Compra de Aço CA-50/60 (Lote Fundação)", leadTimeDays: 15 },
      { title: "Programação Concreto Usinado Fundação", leadTimeDays: 7 },
    ],
  },
  {
    packageNumber: 5,
    name: "Vigas Baldrame e Impermeabilização de Base",
    waveName: "Fase 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["03", "07"],
    predecessorNumbers: [4],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 6,
    name: "Aterro Compactado, Lastro e Tubulação Enterrada",
    waveName: "Fase 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["02", "09"],
    predecessorNumbers: [5],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Tubos e Conexões Esgoto/Pluvial", leadTimeDays: 10 }],
  },
  {
    packageNumber: 7,
    name: "Supraestrutura Térreo (Pilares, Vigas e Laje)",
    waveName: "Fase 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["04"],
    predecessorNumbers: [6],
    defaultDurationWorkingDays: 20,
    defaultTeamsCount: 1,
    procurementGates: [
      { title: "Compra Aço CA-50/60 e Madeira de Fôrma (Lote Estrutura)", leadTimeDays: 15 },
      { title: "Locação de Escoramento Metálico", leadTimeDays: 12 },
    ],
  },
  {
    packageNumber: 8,
    name: "Supraestrutura Pavimento Superior",
    waveName: "Fase 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["04"],
    predecessorNumbers: [7],
    defaultDurationWorkingDays: 20,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 9,
    name: "Supraestrutura Cobertura e Platibanda",
    waveName: "Fase 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["04"],
    predecessorNumbers: [8],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 10,
    name: "Alvenaria de Vedação Térreo",
    waveName: "Fase 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["05"],
    predecessorNumbers: [7],
    defaultDurationWorkingDays: 15,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Blocos Cerâmicos e Argamassa Assentamento", leadTimeDays: 12 }],
  },
  {
    packageNumber: 11,
    name: "Alvenaria de Vedação Pavimento Superior",
    waveName: "Fase 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["05"],
    predecessorNumbers: [8, 10],
    defaultDurationWorkingDays: 15,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 12,
    name: "Vergas, Contravergas e Encunhamento",
    waveName: "Fase 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["05"],
    predecessorNumbers: [11],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 13,
    name: "Cobertura, Telhamento, Calhas e Rufos",
    waveName: "Fase 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["06"],
    predecessorNumbers: [9],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Telhas Termoacústicas e Estrutura Metálica", leadTimeDays: 20 }],
  },
  {
    packageNumber: 14,
    name: "Impermeabilização de Lajes, Sacadas e Áreas Molhadas",
    waveName: "Fase 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["07"],
    predecessorNumbers: [9, 12],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Manta Asfáltica, Primer e Argamassa Polimérica", leadTimeDays: 12 }],
  },
  {
    packageNumber: 15,
    name: "Instalações Elétricas — Infraestrutura Seca (Rasgos/Eletrodutos)",
    waveName: "Fase 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["08"],
    predecessorNumbers: [12],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Eletrodutos, Caixas e Quadros de Distribuição", leadTimeDays: 12 }],
  },
  {
    packageNumber: 16,
    name: "Reservatório Superior e Barrilete",
    waveName: "Fase 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["09"],
    predecessorNumbers: [9, 14],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Caixas d'Água, Bombas e Pressurizador", leadTimeDays: 15 }],
  },
  {
    packageNumber: 17,
    name: "Instalações Hidrossanitárias — Prumadas e Ramais",
    waveName: "Fase 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["09"],
    predecessorNumbers: [12, 16],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Tubulações Água Fria/Quente e Registros Brutos", leadTimeDays: 12 }],
  },
  {
    packageNumber: 18,
    name: "Infraestrutura de Climatização (Ar-Condicionado) e Gás",
    waveName: "Fase 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["10"],
    predecessorNumbers: [12],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Infraestrutura Frigorígena (Cobre/Isolamento)", leadTimeDays: 15 }],
  },
  {
    packageNumber: 19,
    name: "Chapisco e Emboço Interno",
    waveName: "Fase 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["11"],
    predecessorNumbers: [15, 17, 18],
    defaultDurationWorkingDays: 18,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Cimento, Areia e Argamassa Industrializada", leadTimeDays: 10 }],
  },
  {
    packageNumber: 20,
    name: "Reboco de Gesso Liso em Paredes Internas",
    waveName: "Fase 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["11"],
    predecessorNumbers: [19],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 21,
    name: "Chapisco e Emboço Externo / Fachadas",
    waveName: "Fase 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["12"],
    predecessorNumbers: [13, 14],
    defaultDurationWorkingDays: 16,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Locação de Andaimes Fachadeiros e Tela de Proteção", leadTimeDays: 10 }],
  },
  {
    packageNumber: 22,
    name: "Instalação de Contramarcos de Alumínio",
    waveName: "Fase 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["16"],
    predecessorNumbers: [19, 21],
    defaultDurationWorkingDays: 6,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Esquadrias de Alumínio (Medição e Contramarcos)", leadTimeDays: 45 }],
  },
  {
    packageNumber: 23,
    name: "Contrapiso e Regularização de Pisos",
    waveName: "Fase 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["13"],
    predecessorNumbers: [19],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 24,
    name: "Revestimento Cerâmico / Porcelanato em Paredes Molhadas",
    waveName: "Fase 5 — Acabamentos Nobres",
    linkedStageCodes: ["11"],
    predecessorNumbers: [19, 23],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Porcelanatos, Argamassa AC-III e Rejuntes", leadTimeDays: 30 }],
  },
  {
    packageNumber: 25,
    name: "Assentamento de Pisos Porcelanato e Rodapés",
    waveName: "Fase 5 — Acabamentos Nobres",
    linkedStageCodes: ["14"],
    predecessorNumbers: [23, 24],
    defaultDurationWorkingDays: 18,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 26,
    name: "Forro de Gesso Acartonado, Cortineiros e Sancas",
    waveName: "Fase 5 — Acabamentos Nobres",
    linkedStageCodes: ["15"],
    predecessorNumbers: [20, 24],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Forro de Gesso Acartonado", leadTimeDays: 15 }],
  },
  {
    packageNumber: 27,
    name: "Piscina, Deck e Área Gourmet (Estrutura e Acabamento)",
    waveName: "Fase 5 — Acabamentos Nobres",
    linkedStageCodes: ["22"],
    predecessorNumbers: [14, 21],
    defaultDurationWorkingDays: 18,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Equipamentos de Piscina e Revestimento Hijau/Cerâmico", leadTimeDays: 25 }],
  },
  {
    packageNumber: 28,
    name: "Marmoraria — Bancadas, Soleiras, Peitoris e Escada",
    waveName: "Fase 5 — Acabamentos Nobres",
    linkedStageCodes: ["18"],
    predecessorNumbers: [25],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Marmoraria (Granitos/Quartzos + Medição Fina)", leadTimeDays: 30 }],
  },
  {
    packageNumber: 29,
    name: "Enfiação Elétrica, Quadros e Automação",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["08"],
    predecessorNumbers: [26],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Cabos Flexíveis, Disjuntores e Automação", leadTimeDays: 15 }],
  },
  {
    packageNumber: 30,
    name: "Pintura Interna — 1ª Demão (Selador + Massa Corrida)",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["19"],
    predecessorNumbers: [26, 28],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Tintas, Massas e Seladores", leadTimeDays: 10 }],
  },
  {
    packageNumber: 31,
    name: "Pintura Externa e Texturas de Fachada",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["12", "19"],
    predecessorNumbers: [21, 22],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 32,
    name: "Instalação de Esquadrias de Alumínio e Vidros",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["16"],
    predecessorNumbers: [22, 30, 31],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 33,
    name: "Instalação de Portas de Madeira e Ferragens",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["17"],
    predecessorNumbers: [30, 32],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Portas de Madeira Prontas e Fechaduras", leadTimeDays: 35 }],
  },
  {
    packageNumber: 34,
    name: "Instalação de Louças, Metais, Luminárias e Acabamentos Elétricos",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["20", "21"],
    predecessorNumbers: [28, 29, 32],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 2,
    procurementGates: [
      { title: "Compra Louças, Metais e Acessórios", leadTimeDays: 25 },
      { title: "Compra Luminárias, Perfis LED e Tomadas/Espelhos", leadTimeDays: 25 },
    ],
  },
  {
    packageNumber: 35,
    name: "Serralheria, Portões, Calçadas e Paisagismo",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["23", "24"],
    predecessorNumbers: [27, 31],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Portões, Serralheria e Paisagismo", leadTimeDays: 25 }],
  },
  {
    packageNumber: 36,
    name: "Pintura Interna — Demão Final e Retoques",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["19"],
    predecessorNumbers: [33, 34],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 37,
    name: "Guarda-Corpos em Madeira Maciça e Corrimãos",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["16"],
    predecessorNumbers: [32, 36],
    defaultDurationWorkingDays: 5,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Liberação Final Vidros Temperados/Laminados de Guarda-Corpos", leadTimeDays: 20 }],
  },
  {
    packageNumber: 38,
    name: "Limpeza Final Pós-Obra, Comissionamento e Entrega",
    waveName: "Fase 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["26"],
    predecessorNumbers: [35, 36, 37],
    defaultDurationWorkingDays: 5,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Agendamento Equipe de Limpeza Pós-Obra Especializada", leadTimeDays: 10 }],
  },
];

export const DEFAULT_PROPOSAL_PREMISES: string[] = [
  "Orçamento elaborado com base na tabela regional da cidade selecionada e quantitativos compatibilizados entre projetos TQS (Estrutura) e Revit (Arquitetura).",
  "Custos tripartidos discriminando Material, Mão de Obra Própria/Empreitada e Serviços Terceirizados, com aplicação de BDI / Mark-Up transparente.",
  "Prazo de execução calculado em dias úteis conforme calendário oficial de feriados nacionais, estaduais e municipais da praça da obra.",
  "Alterações de escopo, acabamentos ou revisões de projeto após aprovação da Linha de Base (v1.0) serão formalizadas via Aditivo de Revisão.",
];

export interface MasterEapBaseItemTemplate {
  stageCode: string;
  groupCode: string;
  code: string;
  description: string;
  unit: string;
  discipline:
    | "ARQUITETONICO"
    | "ESTRUTURAL"
    | "ELETRICO"
    | "HIDRO_ABASTECIMENTO"
    | "HIDRO_ESGOTAMENTO"
    | "HIDRO_DRENAGEM"
    | "LUMINOTECNICO"
    | "PAISAGISMO";
  category: string;
  defaultLossPercent?: number;
}

export const MASTER_EAP_BASE_ITEMS: MasterEapBaseItemTemplate[] = [
  // 01 — Implantação e Serviços Preliminares (Arquitetônico)
  {
    stageCode: "01",
    groupCode: "01.1",
    code: "IMPL-CANTEIRO",
    description: "Implantação de Canteiro, Tapume, Barracão e Ligações Provisórias",
    unit: "vb",
    discipline: "ARQUITETONICO",
    category: "IMPLANTACAO",
  },
  {
    stageCode: "01",
    groupCode: "01.2",
    code: "IMPL-LOCACAO",
    description: "Limpeza do Terreno, Topografia e Locação de Obra com Gabarito",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "IMPLANTACAO",
  },

  // 02 — Movimento de Terra (Estrutural / Terreno)
  {
    stageCode: "02",
    groupCode: "02.1",
    code: "MOV-ESCAV",
    description: "Escavação Mecanizada e Manual de Valas / Fundações",
    unit: "m³",
    discipline: "ESTRUTURAL",
    category: "TERRAP_MOV",
  },
  {
    stageCode: "02",
    groupCode: "02.1",
    code: "MOV-ATERRO",
    description: "Reaterro Compactado e Bota-Fora de Solo Excedente",
    unit: "m³",
    discipline: "ESTRUTURAL",
    category: "TERRAP_MOV",
  },

  // 03 — Infraestrutura e Fundações (Estrutural - TQS)
  {
    stageCode: "03",
    groupCode: "03.1",
    code: "CONC-MAGRO",
    description: "Lastro de Concreto Magro fck 15 MPa em Fundações",
    unit: "m³",
    discipline: "ESTRUTURAL",
    category: "CONCRETO",
    defaultLossPercent: 5,
  },
  {
    stageCode: "03",
    groupCode: "03.1",
    code: "CONC-FCK25",
    description: "Concreto Estrutural Fundações / Sapatas / Blocos fck 25 MPa",
    unit: "m³",
    discipline: "ESTRUTURAL",
    category: "CONCRETO",
    defaultLossPercent: 5,
  },
  {
    stageCode: "03",
    groupCode: "03.2",
    code: "BALDRAME-IMP",
    description: "Vigas Baldrame e Impermeabilização de Fundação",
    unit: "m²",
    discipline: "ESTRUTURAL",
    category: "IMPERMEABILIZACAO",
    defaultLossPercent: 8,
  },

  // 04 — Supraestrutura de Concreto Armado (Estrutural - TQS)
  {
    stageCode: "04",
    groupCode: "04.1",
    code: "CONC-FCK30",
    description: "Concreto Usinado Supraestrutura fck 30 MPa + Bombeamento",
    unit: "m³",
    discipline: "ESTRUTURAL",
    category: "CONCRETO",
    defaultLossPercent: 5,
  },
  {
    stageCode: "04",
    groupCode: "04.1",
    code: "CONC-FCK35",
    description: "Concreto Usinado Supraestrutura fck 35 MPa + Bombeamento",
    unit: "m³",
    discipline: "ESTRUTURAL",
    category: "CONCRETO",
    defaultLossPercent: 5,
  },
  {
    stageCode: "04",
    groupCode: "04.2",
    code: "ACO-CA50-100",
    description: "Armação em Aço CA-50 / CA-60 (Corte, Dobra e Montagem)",
    unit: "kg",
    discipline: "ESTRUTURAL",
    category: "ACO",
    defaultLossPercent: 10,
  },
  {
    stageCode: "04",
    groupCode: "04.2",
    code: "ACO-CA50-63",
    description: "Aço CA-50/CA-60 Complementar e Estribos",
    unit: "kg",
    discipline: "ESTRUTURAL",
    category: "ACO_COMPLEMENTAR",
    defaultLossPercent: 10,
  },
  {
    stageCode: "04",
    groupCode: "04.3",
    code: "FORM-MAD-COMP",
    description: "Fôrma de Madeira Compensado Plastificado 14mm + Desforma",
    unit: "m²",
    discipline: "ESTRUTURAL",
    category: "FORMAS",
    defaultLossPercent: 8,
  },
  {
    stageCode: "04",
    groupCode: "04.3",
    code: "LAJE-VIGOTA-TR",
    description: "Vigota Treliçada / Laje Pré-Moldada",
    unit: "m",
    discipline: "ESTRUTURAL",
    category: "VIGOTA_TRELICADA",
    defaultLossPercent: 3,
  },
  {
    stageCode: "04",
    groupCode: "04.3",
    code: "LAJE-EPS-H12",
    description: "Bloco de Enchimento EPS para Laje Treliçada",
    unit: "unid",
    discipline: "ESTRUTURAL",
    category: "LAJE_EPS",
    defaultLossPercent: 5,
  },

  // 05 — Alvenaria de Vedação (Arquitetônico - Revit)
  {
    stageCode: "05",
    groupCode: "05.1",
    code: "ALV-TJC14",
    description: "Alvenaria Bloco Cerâmico 14cm (TJC14) + Argamassa",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "ALVENARIA",
    defaultLossPercent: 8,
  },
  {
    stageCode: "05",
    groupCode: "05.1",
    code: "ALV-TJC8",
    description: "Alvenaria Bloco Cerâmico 9cm (TJC8) + Argamassa",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "ALVENARIA",
    defaultLossPercent: 8,
  },
  {
    stageCode: "05",
    groupCode: "05.2",
    code: "ALV-VERGA",
    description: "Vergas, Contravergas e Encunhamento de Alvenaria",
    unit: "m³",
    discipline: "ARQUITETONICO",
    category: "ALVENARIA",
    defaultLossPercent: 5,
  },

  // 06 — Cobertura (Arquitetônico)
  {
    stageCode: "06",
    groupCode: "06.1",
    code: "COB-TELHADO",
    description: "Estrutura de Coberta, Telhamento Termoacústico e Rufos",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "COBERTURA",
    defaultLossPercent: 5,
  },

  // 07 — Impermeabilização (Arquitetônico)
  {
    stageCode: "07",
    groupCode: "07.1",
    code: "IMP-MANTA-4MM",
    description: "Impermeabilização com Manta Asfáltica 4mm + Primer e Proteção",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "IMPERMEABILIZACAO",
    defaultLossPercent: 10,
  },
  {
    stageCode: "07",
    groupCode: "07.1",
    code: "IMP-POLIMERICA",
    description: "Impermeabilização com Argamassa Polimérica em Áreas Molhadas",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "IMPERMEABILIZACAO",
    defaultLossPercent: 8,
  },

  // 08 — Instalações Elétricas e Automação (Elétrico)
  {
    stageCode: "08",
    groupCode: "08.1",
    code: "ELET-INFRA-DR",
    description: "Infraestrutura Seca, Eletrodutos, Caixas e Quadros de Distribuição",
    unit: "m",
    discipline: "ELETRICO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },
  {
    stageCode: "08",
    groupCode: "08.2",
    code: "INST-PTO-ELET",
    description: "Pontos Elétricos, Cabeamento, Disjuntores, Tomadas e Interruptores",
    unit: "unid",
    discipline: "ELETRICO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },

  // 09 — Instalações Hidrossanitárias e Águas Pluviais (Hidro Abastecimento / Esgotamento / Drenagem)
  {
    stageCode: "09",
    groupCode: "09.1",
    code: "HIDRO-ABAST-AF",
    description: "Abastecimento Água Fria / Água Quente (Tubulações e Registros)",
    unit: "m",
    discipline: "HIDRO_ABASTECIMENTO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },
  {
    stageCode: "09",
    groupCode: "09.1",
    code: "HIDRO-ESGOTO",
    description: "Esgotamento Sanitário, Ventilação e Caixas de Inspeção/Gordura",
    unit: "m",
    discipline: "HIDRO_ESGOTAMENTO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },
  {
    stageCode: "09",
    groupCode: "09.1",
    code: "HIDRO-DRENAGEM",
    description: "Drenagem de Águas Pluviais, Calhas, Condutores e Caixas",
    unit: "m",
    discipline: "HIDRO_DRENAGEM",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },
  {
    stageCode: "09",
    groupCode: "09.2",
    code: "INST-PTO-HIDRO",
    description: "Pontos Hidrossanitários, Reservatório Superior e Pressurização",
    unit: "unid",
    discipline: "HIDRO_ABASTECIMENTO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },

  // 10 — Gás e Climatização (Arquitetônico / Instalações)
  {
    stageCode: "10",
    groupCode: "10.1",
    code: "INST-CLIM-GAS",
    description: "Infraestrutura de Climatização (Cobre/Dreno) e Rede de Gás GLP",
    unit: "unid",
    discipline: "HIDRO_ABASTECIMENTO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },

  // 11 — Revestimento de Paredes Internas (Arquitetônico)
  {
    stageCode: "11",
    groupCode: "11.1",
    code: "REV-CHAP-EMB",
    description: "Chapisco, Emboço e Reboco / Massa Única em Paredes Internas",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "REVESTIMENTOS",
    defaultLossPercent: 10,
  },
  {
    stageCode: "11",
    groupCode: "11.2",
    code: "REV-GESSO-LISO",
    description: "Revestimento Cerâmico / Gesso Liso em Paredes Internas",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "REVESTIMENTOS",
    defaultLossPercent: 8,
  },

  // 12 — Fachadas e Muros Externos (Arquitetônico)
  {
    stageCode: "12",
    groupCode: "12.1",
    code: "REV-FACHADA",
    description: "Chapisco, Emboço Externo e Revestimento de Fachadas / Muros",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "REVESTIMENTOS",
    defaultLossPercent: 10,
  },

  // 13 — Contrapiso (Arquitetônico)
  {
    stageCode: "13",
    groupCode: "13.1",
    code: "REV-CONTRAPISO",
    description: "Contrapiso Regularizado e=4cm com Caimento em Áreas Molhadas",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "REVESTIMENTOS",
    defaultLossPercent: 8,
  },

  // 14 — Pisos, Porcelanatos e Rodapés (Arquitetônico)
  {
    stageCode: "14",
    groupCode: "14.1",
    code: "REV-PORC-90",
    description: "Assentamento de Piso Porcelanato Retificado + Argamassa AC-III",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "REVESTIMENTOS",
    defaultLossPercent: 12,
  },
  {
    stageCode: "14",
    groupCode: "14.2",
    code: "REV-RODAPE-15",
    description: "Rodapés, Soleiras e Pingadeiras Assentados",
    unit: "m",
    discipline: "ARQUITETONICO",
    category: "REVESTIMENTOS",
    defaultLossPercent: 10,
  },

  // 15 — Forros de Gesso (Arquitetônico)
  {
    stageCode: "15",
    groupCode: "15.1",
    code: "REV-FORRO-GESSO",
    description: "Forro de Gesso Acartonado (Drywall) com Tabicas e Cortineiros",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "REVESTIMENTOS",
    defaultLossPercent: 5,
  },

  // 16 — Esquadrias de Alumínio e Vidros (Arquitetônico)
  {
    stageCode: "16",
    groupCode: "16.1",
    code: "ESQ-ALUM-VIDRO",
    description: "Esquadrias de Alumínio com Vidro Temperado / Laminado",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "ESQUADRIAS",
  },
  {
    stageCode: "16",
    groupCode: "16.2",
    code: "ESQ-GUARDA-CORPO",
    description: "Guarda-Corpos em Alumínio/Inox e Vidro Laminado + Corrimãos",
    unit: "m",
    discipline: "ARQUITETONICO",
    category: "ESQUADRIAS",
  },

  // 17 — Esquadrias de Madeira (Arquitetônico)
  {
    stageCode: "17",
    groupCode: "17.1",
    code: "ESQ-PORTA-MAD",
    description: "Kit Porta Pronta de Madeira Laqueada + Alizares e Ferragens",
    unit: "unid",
    discipline: "ARQUITETONICO",
    category: "ESQUADRIAS",
  },

  // 18 — Marmoraria e Bancadas (Arquitetônico)
  {
    stageCode: "18",
    groupCode: "18.1",
    code: "BANC-GRANITO",
    description: "Bancadas de Granito / Quartzo, Nichos e Revestimento de Escada",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "BANCADAS",
    defaultLossPercent: 5,
  },

  // 19 — Pintura Interna e Externa (Arquitetônico)
  {
    stageCode: "19",
    groupCode: "19.1",
    code: "PINT-PVA-INT",
    description: "Pintura Interna (Selador, Massa Corrida e Tinta Acrílica Fosca)",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "PINTURA",
    defaultLossPercent: 8,
  },
  {
    stageCode: "19",
    groupCode: "19.2",
    code: "PINT-ACRL-EXT",
    description: "Pintura Externa Acrílica Premium e Textura de Fachada",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "PINTURA",
    defaultLossPercent: 10,
  },

  // 20 — Louças e Metais (Arquitetônico / Hidro)
  {
    stageCode: "20",
    groupCode: "20.1",
    code: "LOUC-CONJ-BWC",
    description: "Conjunto Louças e Metais Sanitários (Bacias, Cubas, Misturadores)",
    unit: "unid",
    discipline: "HIDRO_ABASTECIMENTO",
    category: "LOUCAS_METAIS",
  },

  // 21 — Luminotécnica e Acabamento Elétrico (Luminotécnico)
  {
    stageCode: "21",
    groupCode: "21.1",
    code: "INST-PTO-LUMI",
    description: "Pontos Luminotécnicos, Spots, Pendentes, Arandelas e Plafons",
    unit: "unid",
    discipline: "LUMINOTECNICO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },
  {
    stageCode: "21",
    groupCode: "21.1",
    code: "LUMI-PERFIL-LED",
    description: "Perfis e Fitas LED Lineares Embutidos com Drivers e Comandos",
    unit: "m",
    discipline: "LUMINOTECNICO",
    category: "INSTALACOES",
    defaultLossPercent: 5,
  },

  // 22 — Piscina, Deck e Área Gourmet (Arquitetônico)
  {
    stageCode: "22",
    groupCode: "22.1",
    code: "PISC-DECK-GOURM",
    description: "Piscina, Revestimento, Casa de Máquinas e Infra Área Gourmet",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "LAZER",
  },

  // 23 — Paisagismo, Calçadas e Pavimentação Externa (Paisagismo)
  {
    stageCode: "23",
    groupCode: "23.1",
    code: "PAIS-GRAMA",
    description: "Gramados, Canteiros, Forrações e Piso Intertravado Externo",
    unit: "m²",
    discipline: "PAISAGISMO",
    category: "PAISAGISMO",
    defaultLossPercent: 5,
  },
  {
    stageCode: "23",
    groupCode: "23.1",
    code: "PAIS-MUDAS",
    description: "Espécies Arbóreas/Arbustivas e Pontos de Irrigação Automatizada",
    unit: "unid",
    discipline: "PAISAGISMO",
    category: "PAISAGISMO",
  },

  // 24 — Serralheria e Portões (Arquitetônico)
  {
    stageCode: "24",
    groupCode: "24.1",
    code: "SERR-PORTOES",
    description: "Portões Automatizados, Gradis e Elementos de Serralheria",
    unit: "unid",
    discipline: "ARQUITETONICO",
    category: "SERRALHERIA",
  },

  // 25 — Administração Local (Geral)
  {
    stageCode: "25",
    groupCode: "25.1",
    code: "IMPL-ADMIN-MES",
    description: "Administração Local da Obra (Mestre, Almoxarife e Caçambas)",
    unit: "mês",
    discipline: "ARQUITETONICO",
    category: "IMPLANTACAO",
  },

  // 26 — Limpeza Final e Entrega (Geral)
  {
    stageCode: "26",
    groupCode: "26.1",
    code: "LIMP-FINAL-OBRA",
    description: "Limpeza Final Pós-Obra, Comissionamento e Vistoria de Entrega",
    unit: "m²",
    discipline: "ARQUITETONICO",
    category: "ENTREGA",
  },
];

export const DEFAULT_PROPOSAL_EXCLUSIONS: string[] = [
  "Taxas municipais, alvarás, licenças ambientais, averbação e Habite-se junto à Prefeitura e Cartório.",
  "Marcenaria planejada sob medida, eletrodomésticos, cortinas, mobiliário solto e decoração.",
  "Equipamentos de climatização (evaporadoras/condensadoras), aquecedor solar/gás e usina fotovoltaica (salvo quando explicitamente orçados).",
  "Sondagem SPT, projetos complementares e consultorias externas não listadas nos itens da EAP.",
];
