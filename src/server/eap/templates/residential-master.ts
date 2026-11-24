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
    waveName: "Onda 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["01"],
    predecessorNumbers: [],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Tapume, Container e Ligação Provisória", leadTimeDays: 10 }],
  },
  {
    packageNumber: 2,
    name: "Locação da Obra e Gabarito",
    waveName: "Onda 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["01"],
    predecessorNumbers: [1],
    defaultDurationWorkingDays: 5,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 3,
    name: "Movimento de Terra e Escavação de Fundações",
    waveName: "Onda 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["02"],
    predecessorNumbers: [2],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Locação de Retroescavadeira / Caçambas", leadTimeDays: 7 }],
  },
  {
    packageNumber: 4,
    name: "Fundações Profundas / Sapatas e Blocos",
    waveName: "Onda 1 — Implantação & Infraestrutura",
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
    waveName: "Onda 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["03", "07"],
    predecessorNumbers: [4],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 6,
    name: "Aterro Compactado, Lastro e Tubulação Enterrada",
    waveName: "Onda 1 — Implantação & Infraestrutura",
    linkedStageCodes: ["02", "09"],
    predecessorNumbers: [5],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Tubos e Conexões Esgoto/Pluvial", leadTimeDays: 10 }],
  },
  {
    packageNumber: 7,
    name: "Supraestrutura Térreo (Pilares, Vigas e Laje)",
    waveName: "Onda 2 — Supraestrutura & Vedação",
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
    waveName: "Onda 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["04"],
    predecessorNumbers: [7],
    defaultDurationWorkingDays: 20,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 9,
    name: "Supraestrutura Cobertura e Platibanda",
    waveName: "Onda 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["04"],
    predecessorNumbers: [8],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 10,
    name: "Alvenaria de Vedação Térreo",
    waveName: "Onda 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["05"],
    predecessorNumbers: [7],
    defaultDurationWorkingDays: 15,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Blocos Cerâmicos e Argamassa Assentamento", leadTimeDays: 12 }],
  },
  {
    packageNumber: 11,
    name: "Alvenaria de Vedação Pavimento Superior",
    waveName: "Onda 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["05"],
    predecessorNumbers: [8, 10],
    defaultDurationWorkingDays: 15,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 12,
    name: "Vergas, Contravergas e Encunhamento",
    waveName: "Onda 2 — Supraestrutura & Vedação",
    linkedStageCodes: ["05"],
    predecessorNumbers: [11],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 13,
    name: "Cobertura, Telhamento, Calhas e Rufos",
    waveName: "Onda 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["06"],
    predecessorNumbers: [9],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Telhas Termoacústicas e Estrutura Metálica", leadTimeDays: 20 }],
  },
  {
    packageNumber: 14,
    name: "Impermeabilização de Lajes, Sacadas e Áreas Molhadas",
    waveName: "Onda 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["07"],
    predecessorNumbers: [9, 12],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Manta Asfáltica, Primer e Argamassa Polimérica", leadTimeDays: 12 }],
  },
  {
    packageNumber: 15,
    name: "Instalações Elétricas — Infraestrutura Seca (Rasgos/Eletrodutos)",
    waveName: "Onda 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["08"],
    predecessorNumbers: [12],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Eletrodutos, Caixas e Quadros de Distribuição", leadTimeDays: 12 }],
  },
  {
    packageNumber: 16,
    name: "Reservatório Superior e Barrilete",
    waveName: "Onda 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["09"],
    predecessorNumbers: [9, 14],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Caixas d'Água, Bombas e Pressurizador", leadTimeDays: 15 }],
  },
  {
    packageNumber: 17,
    name: "Instalações Hidrossanitárias — Prumadas e Ramais",
    waveName: "Onda 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["09"],
    predecessorNumbers: [12, 16],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Tubulações Água Fria/Quente e Registros Brutos", leadTimeDays: 12 }],
  },
  {
    packageNumber: 18,
    name: "Infraestrutura de Climatização (Ar-Condicionado) e Gás",
    waveName: "Onda 3 — Estanqueidade & Instalações",
    linkedStageCodes: ["10"],
    predecessorNumbers: [12],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Infraestrutura Frigorígena (Cobre/Isolamento)", leadTimeDays: 15 }],
  },
  {
    packageNumber: 19,
    name: "Chapisco e Emboço Interno",
    waveName: "Onda 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["11"],
    predecessorNumbers: [15, 17, 18],
    defaultDurationWorkingDays: 18,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Cimento, Areia e Argamassa Industrializada", leadTimeDays: 10 }],
  },
  {
    packageNumber: 20,
    name: "Reboco de Gesso Liso em Paredes Internas",
    waveName: "Onda 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["11"],
    predecessorNumbers: [19],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 21,
    name: "Chapisco e Emboço Externo / Fachadas",
    waveName: "Onda 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["12"],
    predecessorNumbers: [13, 14],
    defaultDurationWorkingDays: 16,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Locação de Andaimes Fachadeiros e Tela de Proteção", leadTimeDays: 10 }],
  },
  {
    packageNumber: 22,
    name: "Instalação de Contramarcos de Alumínio",
    waveName: "Onda 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["16"],
    predecessorNumbers: [19, 21],
    defaultDurationWorkingDays: 6,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Esquadrias de Alumínio (Medição e Contramarcos)", leadTimeDays: 45 }],
  },
  {
    packageNumber: 23,
    name: "Contrapiso e Regularização de Pisos",
    waveName: "Onda 4 — Revestimentos Brutos & Fachada",
    linkedStageCodes: ["13"],
    predecessorNumbers: [19],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 24,
    name: "Revestimento Cerâmico / Porcelanato em Paredes Molhadas",
    waveName: "Onda 5 — Acabamentos Nobres",
    linkedStageCodes: ["11"],
    predecessorNumbers: [19, 23],
    defaultDurationWorkingDays: 14,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Porcelanatos, Argamassa AC-III e Rejuntes", leadTimeDays: 30 }],
  },
  {
    packageNumber: 25,
    name: "Assentamento de Pisos Porcelanato e Rodapés",
    waveName: "Onda 5 — Acabamentos Nobres",
    linkedStageCodes: ["14"],
    predecessorNumbers: [23, 24],
    defaultDurationWorkingDays: 18,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 26,
    name: "Forro de Gesso Acartonado, Cortineiros e Sancas",
    waveName: "Onda 5 — Acabamentos Nobres",
    linkedStageCodes: ["15"],
    predecessorNumbers: [20, 24],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Forro de Gesso Acartonado", leadTimeDays: 15 }],
  },
  {
    packageNumber: 27,
    name: "Piscina, Deck e Área Gourmet (Estrutura e Acabamento)",
    waveName: "Onda 5 — Acabamentos Nobres",
    linkedStageCodes: ["22"],
    predecessorNumbers: [14, 21],
    defaultDurationWorkingDays: 18,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Equipamentos de Piscina e Revestimento Hijau/Cerâmico", leadTimeDays: 25 }],
  },
  {
    packageNumber: 28,
    name: "Marmoraria — Bancadas, Soleiras, Peitoris e Escada",
    waveName: "Onda 5 — Acabamentos Nobres",
    linkedStageCodes: ["18"],
    predecessorNumbers: [25],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Marmoraria (Granitos/Quartzos + Medição Fina)", leadTimeDays: 30 }],
  },
  {
    packageNumber: 29,
    name: "Enfiação Elétrica, Quadros e Automação",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["08"],
    predecessorNumbers: [26],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Cabos Flexíveis, Disjuntores e Automação", leadTimeDays: 15 }],
  },
  {
    packageNumber: 30,
    name: "Pintura Interna — 1ª Demão (Selador + Massa Corrida)",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["19"],
    predecessorNumbers: [26, 28],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 2,
    procurementGates: [{ title: "Compra Tintas, Massas e Seladores", leadTimeDays: 10 }],
  },
  {
    packageNumber: 31,
    name: "Pintura Externa e Texturas de Fachada",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["12", "19"],
    predecessorNumbers: [21, 22],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 32,
    name: "Instalação de Esquadrias de Alumínio e Vidros",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["16"],
    predecessorNumbers: [22, 30, 31],
    defaultDurationWorkingDays: 10,
    defaultTeamsCount: 1,
    procurementGates: [],
  },
  {
    packageNumber: 33,
    name: "Instalação de Portas de Madeira e Ferragens",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["17"],
    predecessorNumbers: [30, 32],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Compra Portas de Madeira Prontas e Fechaduras", leadTimeDays: 35 }],
  },
  {
    packageNumber: 34,
    name: "Instalação de Louças, Metais, Luminárias e Acabamentos Elétricos",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
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
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["23", "24"],
    predecessorNumbers: [27, 31],
    defaultDurationWorkingDays: 12,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Contratação Portões, Serralheria e Paisagismo", leadTimeDays: 25 }],
  },
  {
    packageNumber: 36,
    name: "Pintura Interna — Demão Final e Retoques",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["19"],
    predecessorNumbers: [33, 34],
    defaultDurationWorkingDays: 8,
    defaultTeamsCount: 2,
    procurementGates: [],
  },
  {
    packageNumber: 37,
    name: "Esquadria de Alumínio — Guarda-Corpos e Corrimãos",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
    linkedStageCodes: ["16"],
    predecessorNumbers: [32, 36],
    defaultDurationWorkingDays: 5,
    defaultTeamsCount: 1,
    procurementGates: [{ title: "Liberação Final Vidros Temperados/Laminados de Guarda-Corpos", leadTimeDays: 20 }],
  },
  {
    packageNumber: 38,
    name: "Limpeza Final Pós-Obra, Comissionamento e Entrega",
    waveName: "Onda 6 — Pintura, Esquadrias & Finalização",
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

export const DEFAULT_PROPOSAL_EXCLUSIONS: string[] = [
  "Taxas municipais, alvarás, licenças ambientais, averbação e Habite-se junto à Prefeitura e Cartório.",
  "Marcenaria planejada sob medida, eletrodomésticos, cortinas, mobiliário solto e decoração.",
  "Equipamentos de climatização (evaporadoras/condensadoras), aquecedor solar/gás e usina fotovoltaica (salvo quando explicitamente orçados).",
  "Sondagem SPT, projetos complementares e consultorias externas não listadas nos itens da EAP.",
];
