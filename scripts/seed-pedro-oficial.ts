import "dotenv/config";
import { prisma } from "../src/server/db";

async function main() {
  console.log("=== Sincronizando Projeto de Referência Pedro (Residência de Praia) ===");

  const clientAddress = {
    neighborhood: "Loteamento Praia Bela",
    city: "Litoral Sul",
    state: "CE",
    loteQuadra: "Lote 14, Quadra B",
    areaConstruida: "385,00 m²",
    areaLote: "450,00 m² (15m x 30m)",
    zoneamento: "ZR-1",
  };

  // 1. Localizar ou criar o cliente Pedro
  let client = await prisma.client.findFirst({
    where: {
      OR: [
        { email: { equals: "pedro@arqvertice.com", mode: "insensitive" } },
        { name: { equals: "Pedro", mode: "insensitive" } },
      ],
    },
  });

  if (client) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: {
        name: "Pedro",
        fullName: "Pedro de Alencar",
        email: "pedro@arqvertice.com",
        phone: "5585999990001",
        city: "Litoral Sul",
        state: "CE",
        address: clientAddress,
        status: "ACTIVE",
      },
    });
  } else {
    client = await prisma.client.create({
      data: {
        name: "Pedro",
        fullName: "Pedro de Alencar",
        email: "pedro@arqvertice.com",
        phone: "5585999990001",
        city: "Litoral Sul",
        state: "CE",
        address: clientAddress,
        status: "ACTIVE",
      },
    });
  }
  console.log("Cliente Pedro sincronizado:", client.name, client.id);

  // 2. Garantir o usuário Pedro vinculado
  await prisma.user.updateMany({
    where: { email: "pedro@arqvertice.com" },
    data: { clientId: client.id, role: "CLIENTE" },
  });

  // 3. Localizar ou criar o projeto Residência de Praia
  let project = await prisma.project.findFirst({
    where: {
      clientId: client.id,
      name: { contains: "Praia", mode: "insensitive" },
    },
  });

  const startDate = new Date("2026-06-12T00:00:00Z");
  const expectedEndDate = new Date("2026-11-30T23:59:59Z");

  const projectAddress = {
    neighborhood: "Loteamento Praia Bela",
    city: "Litoral Sul",
    state: "CE",
    loteQuadra: "Lote 14, Quadra B",
    areaConstruida: "385,00 m²",
    areaLote: "450,00 m² (15m x 30m)",
    zoneamento: "ZR-1",
    formatted: "Loteamento Praia Bela, Litoral Sul | Lote 14, Quadra B",
  };

  if (project) {
    project = await prisma.project.update({
      where: { id: project.id },
      data: {
        name: "Residência de Praia",
        type: "Residencial Alto Padrão",
        description: "Residência unifamiliar de alto padrão em Loteamento Praia Bela, Litoral Sul.",
        scope: "Projeto Arquitetônico, Estrutural, Complementares e Gestão de Obra",
        budget: 30000,
        status: "IN_PROGRESS",
        startDate,
        expectedEndDate,
        address: projectAddress,
      },
    });
  } else {
    project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: "Residência de Praia",
        type: "Residencial Alto Padrão",
        description: "Residência unifamiliar de alto padrão em Loteamento Praia Bela, Litoral Sul.",
        scope: "Projeto Arquitetônico, Estrutural, Complementares e Gestão de Obra",
        budget: 30000,
        status: "IN_PROGRESS",
        startDate,
        expectedEndDate,
        address: projectAddress,
      },
    });
  }
  console.log("Projeto sincronizado:", project.name, project.id);

  // 4. Sincronizar as 14 Etapas Oficiais
  const stagesDefinition = [
    { order: 1, name: "Estudo Preliminar", discipline: "Arquitetura", designer: "Eduardo Marques", completion: 100, status: "COMPLETED" as const, days: 20 },
    { order: 2, name: "Projeto Básico", discipline: "Arquitetura", designer: "Eduardo Marques", completion: 100, status: "COMPLETED" as const, days: 35 },
    { order: 3, name: "Projeto Pré Formas", discipline: "Estrutura", designer: "Luan Almeida", completion: 100, status: "COMPLETED" as const, days: 45 },
    { order: 4, name: "Projeto Formas Finais", discipline: "Estrutura", designer: "Luan Almeida", completion: 100, status: "COMPLETED" as const, days: 60 },
    { order: 5, name: "Modelagem 3D", discipline: "Projeto 3D", designer: "Eduardo Marques", completion: 100, status: "COMPLETED" as const, days: 70 },
    { order: 6, name: "Renderização 3D - Imagens Finais", discipline: "Projeto 3D", designer: "Eduardo Marques", completion: 100, status: "COMPLETED" as const, days: 85 },
    { order: 7, name: "Projeto Executivo", discipline: "Arquitetura", designer: "Eduardo Marques", completion: 50, status: "IN_PROGRESS" as const, days: 110 },
    { order: 8, name: "Projeto Armaduras", discipline: "Estrutura", designer: "Luan Almeida", completion: 60, status: "IN_PROGRESS" as const, days: 120 },
    { order: 9, name: "Projeto Fundação", discipline: "Estrutura", designer: "Luan Almeida", completion: 5, status: "NOT_STARTED" as const, days: 130 },
    { order: 10, name: "Projeto Elétrico", discipline: "Complementares", designer: "Eduardo Marques", completion: 0, status: "NOT_STARTED" as const, days: 145 },
    { order: 11, name: "Projeto Hidrossanitário - Esgotamento", discipline: "Complementares", designer: "Eduardo Marques", completion: 0, status: "NOT_STARTED" as const, days: 155 },
    { order: 12, name: "Execução de Obras", discipline: "Execução de Obra", designer: "Erick Santiago", completion: 0, status: "NOT_STARTED" as const, days: 171 },
    { order: 13, name: "Projeto Hidrossanitário - Abastecimento", discipline: "Complementares", designer: "Eduardo Marques", completion: 0, status: "NOT_STARTED" as const, days: 160 },
    { order: 14, name: "Projeto Hidrossanitário - Drenagem", discipline: "Complementares", designer: "Eduardo Marques", completion: 0, status: "NOT_STARTED" as const, days: 165 },
  ];

  // Limpar etapas antigas para aplicar a ordem e nomenclatura exatas
  await prisma.scheduleStage.deleteMany({ where: { projectId: project.id } });

  for (const st of stagesDefinition) {
    const dueDate = new Date(startDate.getTime() + st.days * 86_400_000);
    await prisma.scheduleStage.create({
      data: {
        projectId: project.id,
        order: st.order,
        name: st.name,
        discipline: st.discipline,
        designer: st.designer,
        completion: st.completion,
        status: st.status,
        startDate: startDate,
        dueDate: dueDate,
        endDate: st.status === "COMPLETED" ? dueDate : null,
      },
    });
  }
  console.log("14 etapas oficiais cadastradas com sucesso!");

  // 5. Sincronizar o Módulo Financeiro (ProjectInstallment)
  await prisma.projectInstallment.deleteMany({ where: { projectId: project.id } });

  const installments = [
    {
      order: 1,
      description: "01/04 - Entrada Contratual (Assinatura)",
      amount: 9000,
      dueDate: new Date("2026-06-12T00:00:00Z"),
      paidDate: new Date("2026-06-12T14:30:00Z"),
      status: "PAID",
    },
    {
      order: 2,
      description: "02/04 - Aprovação do Estudo Preliminar & Formas",
      amount: 6000,
      dueDate: new Date("2026-07-20T00:00:00Z"),
      paidDate: new Date("2026-07-20T10:15:00Z"),
      status: "PAID",
    },
    {
      order: 3,
      description: "03/04 - Entrega do Projeto Executivo e Estrutural",
      amount: 9000,
      dueDate: new Date("2026-10-20T00:00:00Z"),
      paidDate: null,
      status: "PENDING",
    },
    {
      order: 4,
      description: "04/04 - Finalização dos Complementares & Entrega Final",
      amount: 6000,
      dueDate: new Date("2026-11-30T00:00:00Z"),
      paidDate: null,
      status: "PENDING",
    },
  ];

  for (const inst of installments) {
    await prisma.projectInstallment.create({
      data: {
        projectId: project.id,
        order: inst.order,
        description: inst.description,
        amount: inst.amount,
        dueDate: inst.dueDate,
        paidDate: inst.paidDate,
        status: inst.status,
      },
    });
  }
  console.log("4 parcelas financeiras (R$ 30.000,00 total) cadastradas em ProjectInstallment!");

  // Também manter a tabela Payment sincronizada com as mesmas 4 parcelas
  await prisma.payment.deleteMany({ where: { projectId: project.id } });
  for (const inst of installments) {
    await prisma.payment.create({
      data: {
        projectId: project.id,
        order: inst.order,
        name: inst.description,
        amount: inst.amount,
        dueDate: inst.dueDate,
        paidAt: inst.paidDate,
        status: inst.status === "PAID" ? "PAID" : "PENDING",
      },
    });
  }

  // 6. ProjectAccess para a Equipe Técnica (Luan Almeida e Erick Santiago)
  const luan = await prisma.user.findFirst({ where: { email: "luan.almeida@arqvertice.com.br" } });
  const erick = await prisma.user.findFirst({ where: { email: "erick.santiago@arqvertice.com.br" } });

  if (luan) {
    const existing = await prisma.projectAccess.findFirst({ where: { projectId: project.id, userId: luan.id } });
    if (!existing) {
      await prisma.projectAccess.create({ data: { projectId: project.id, userId: luan.id } });
    }
  }

  if (erick) {
    const existing = await prisma.projectAccess.findFirst({ where: { projectId: project.id, userId: erick.id } });
    if (!existing) {
      await prisma.projectAccess.create({ data: { projectId: project.id, userId: erick.id } });
    }
  }
  console.log("Acesso operacional vinculado a Luan Almeida e Erick Santiago.");

  // 7. Atualizar as 28 perguntas no briefing do projeto Pedro
  const { OFFICIAL_BRIEFING_QUESTIONS } = await import("../src/lib/briefing-template");
  await prisma.briefing.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      title: "Briefing Executivo & Programa de Necessidades — Residência de Praia",
      questions: OFFICIAL_BRIEFING_QUESTIONS,
      responses: {
        q01_uso: "veraneio_praia",
        q02_familia: ["casal", "filhos_jovens", "hospedes_frequentes"],
        q03_estilo_volumetria: "tropical_contemporaneo",
        q04_pe_direito: "duplo_monumental",
        q05_relacao_exterior: "abertura_total",
        q06_materiais_fachada: ["madeira_ripada", "pedra_natural", "esquadrias_minimalistas"],
        q07_cobertura: "platibanda_oculta",
        q08_acesso_hall: "porta_pivotante_imponente",
        q09_living: ["integracao_cozinha", "lavabo_escultural"],
        q10_cozinha: "cozinha_americana_ilha",
        q11_gourmet: ["ilha_gourmet", "churrasqueira_carvao_inox", "chopeira_torre"],
        q12_varanda: ["lounge_sofas", "balancos_suspensos"],
        q13_piscina: "prainha_spa",
        q14_revestimento_piscina: "pedra_hijau_verde",
        q15_solarium_deck: "piso_atermico_cimenticio",
        q16_firepit: "firepit_gas",
        q17_ducha_externa: "ducha_escultural_pedra",
        q18_paisagismo_tropical: "tropical_denso",
        q19_suite_master: ["closet_walkin", "banheiro_duplo", "banheira_imersao"],
        q20_suites_demais: "master_mais_3suites",
        q21_home_office: "escritorio_fechado",
        q22_circulacao_intima: ["copinha_noturna", "rouparia_enxoval"],
        q23_servicos_apoio: ["lavanderia_fechada", "estendal_invisivel", "deposito_praia_pranchas"],
        q24_garagem: "2vagas_cobertas",
        q25_iluminacao: "quente_2700k_3000k",
        q26_conforto_bioclimatico: ["ventilacao_cruzada", "brises_moveis"],
        q27_automacao_sustentabilidade: ["energia_solar_fotovoltaica", "aquecimento_solar_gas", "automacao_iluminacao_clima"],
        q28_investimento: "faixa_2500k_4000k",
      },
      status: "DRAFT",
    },
    update: {
      questions: OFFICIAL_BRIEFING_QUESTIONS,
    },
  });
  console.log("Briefing atualizado com as 28 perguntas estruturadas!");

  // 8. Sincronizar Entregáveis do Acervo Técnico Distribuídos nas 3 Fases Normativas
  console.log("Sincronizando pranchas e documentos do Acervo Técnico nas 3 fases...");
  await prisma.deliverableAccessLog.deleteMany({ where: { projectId: project.id } });
  await prisma.projectDeliverable.deleteMany({ where: { projectId: project.id } });

  const createdStages = await prisma.scheduleStage.findMany({ where: { projectId: project.id } });
  const findStage = (name: string) => createdStages.find((s) => s.name === name)?.id || null;

  const deliverablesData = [
    // --- FASE 1: PROJETO PRELIMINAR ---
    {
      sheetCode: "ARQ-EST-01",
      title: "Estudo Preliminar de Layout e Volumetria 3D",
      subtitle: "Plantas conceituais, fluxos e maquete eletrônica inicial",
      subject: "Estudo Preliminar e Volumetria",
      discipline: "ARQUITETURA" as const,
      phaseFolder: "PROJETO_PRELIMINAR" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PLANTA_BAIXA" as const,
      version: "R00",
      fileSize: "4.2 MB",
      fileUrl: "/demo-files/ARQ-EST-01_Estudo_Preliminar_Layout_R00.pdf",
      status: "APROVADO_CLIENTE" as const,
      stageId: findStage("Estudo Preliminar"),
      isClientView: true,
      isRequired: true,
      description: "Estudo preliminar conceitual com diretrizes de volumetria, setorização e fluxo integrado.",
    },
    {
      sheetCode: "ARQ-EST-02",
      title: "Quadro de Áreas e Estudos de Insolação Costeira",
      subtitle: "Análise bioclimática, carta solar e índices urbanísticos",
      subject: "Quadro de Áreas e Insolação",
      discipline: "ARQUITETURA" as const,
      phaseFolder: "PROJETO_PRELIMINAR" as const,
      category: "DOCUMENTACAO_MEMORIAL" as const,
      type: "MEMORIAL_DESCRITIVO" as const,
      version: "R00",
      fileSize: "2.8 MB",
      fileUrl: "/demo-files/ARQ-EST-02_Quadro_Areas_Insolacao_R00.pdf",
      status: "APROVADO_CLIENTE" as const,
      stageId: findStage("Estudo Preliminar"),
      isClientView: true,
      isRequired: true,
      description: "Memorial descritivo de áreas computáveis e não computáveis, insolação e ventos predominantes.",
    },

    // --- FASE 2: PROJETO LEGAL ---
    {
      sheetCode: "LEG-PM-01",
      title: "Planta de Situação, Alinhamentos e Recuos Municipais",
      subtitle: "Prancha padrão para protocolo na Prefeitura e Condomínio",
      subject: "Aprovação Legal e Urbanística",
      discipline: "LEGAL_APROVACAO" as const,
      phaseFolder: "PROJETO_LEGAL" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PLANTA_BAIXA" as const,
      version: "R00",
      fileSize: "3.5 MB",
      fileUrl: "/demo-files/LEG-PM-01_Situacao_Recuos_Municipais_R00.pdf",
      status: "APROVADO_INTERNO" as const,
      stageId: findStage("Projeto Básico"),
      isClientView: true,
      isRequired: true,
      description: "Prancha legal em formato padrão da Prefeitura Municipal de Litoral Sul com taxas de ocupação.",
    },
    {
      sheetCode: "DOC-ART-01",
      title: "Anotação de Responsabilidade Técnica (ART) - Eng. Emanoel Luan",
      subtitle: "RRT/ART de autoria do projeto arquitetônico e cálculo estrutural",
      subject: "Anotação de Responsabilidade Técnica",
      discipline: "LEGAL_APROVACAO" as const,
      phaseFolder: "PROJETO_LEGAL" as const,
      category: "DOCUMENTACAO_MEMORIAL" as const,
      type: "MEMORIAL_DESCRITIVO" as const,
      version: "R00",
      fileSize: "1.1 MB",
      fileUrl: "/demo-files/DOC-ART-01_Anotacao_Responsabilidade_Tecnica_R00.pdf",
      status: "APROVADO_INTERNO" as const,
      stageId: findStage("Projeto Básico"),
      isClientView: true,
      isRequired: true,
      description: "Registro profissional junto ao CREA/CAU garantindo a responsabilidade técnica do projeto.",
    },

    // --- FASE 3: PROJETO EXECUTIVO ---
    {
      sheetCode: "ARQ-01",
      title: "Planta Baixa Térreo",
      subtitle: "Layout, cotas executivas e alvenarias",
      subject: "Planta Baixa e Layout",
      discipline: "ARQUITETURA" as const,
      phaseFolder: "PROJETO_EXECUTIVO" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PRANCHA_EXECUTIVA" as const,
      version: "R01",
      fileSize: "5.1 MB",
      fileUrl: "/demo-files/ARQ-01_Planta_Baixa_Terreo_R01.pdf",
      status: "APROVADO_CLIENTE" as const,
      stageId: findStage("Projeto Executivo"),
      isClientView: true,
      isRequired: true,
      description: "Prancha executiva com cotas completas, esquadrias e níveis do pavimento térreo.",
    },
    {
      sheetCode: "ARQ-02",
      title: "Planta Baixa Pavimento Superior",
      subtitle: "Suítes, circulação íntima e ampliações de banheiros",
      subject: "Planta Baixa e Ampliações",
      discipline: "ARQUITETURA" as const,
      phaseFolder: "PROJETO_EXECUTIVO" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PRANCHA_EXECUTIVA" as const,
      version: "R00",
      fileSize: "4.8 MB",
      fileUrl: "/demo-files/ARQ-02_Planta_Baixa_Superior_R00.pdf",
      status: "APROVADO_CLIENTE" as const,
      stageId: findStage("Projeto Executivo"),
      isClientView: true,
      isRequired: true,
      description: "Detalhamento executivo do pavimento superior com ampliações de áreas molhadas.",
    },
    {
      sheetCode: "EST-01",
      title: "Locação de Fundações e Cargas — Estrutural",
      subtitle: "Eixos estruturais, estacas e blocos de coroamento",
      subject: "Fundações e Locação",
      discipline: "ESTRUTURAL" as const,
      phaseFolder: "PROJETO_EXECUTIVO" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PRANCHA_EXECUTIVA" as const,
      version: "R00",
      fileSize: "3.9 MB",
      fileUrl: "/demo-files/EST-01_Locacao_Fundacoes_TQS_R00.pdf",
      status: "APROVADO_INTERNO" as const,
      stageId: findStage("Projeto Fundação"),
      isClientView: true,
      isRequired: true,
      description: "Prancha de locação de estacas moldadas in loco e blocos em concreto armado dimensionada em cálculo estrutural.",
    },
    {
      sheetCode: "EST-02",
      title: "Formas e Armaduras Pavimento Térreo — Estrutural",
      subtitle: "Vigas, lajes nervuradas e detalhes de ancoragem",
      subject: "Formas e Armaduras",
      discipline: "ESTRUTURAL" as const,
      phaseFolder: "PROJETO_EXECUTIVO" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PRANCHA_EXECUTIVA" as const,
      version: "R00",
      fileSize: "6.2 MB",
      fileUrl: "/demo-files/EST-02_Formas_Armaduras_Terreo_TQS_R00.pdf",
      status: "APROVADO_INTERNO" as const,
      stageId: findStage("Projeto Formas Finais"),
      isClientView: true,
      isRequired: true,
      description: "Formas e armações positivas/negativas das vigas e laje do piso térreo dimensionadas em cálculo estrutural.",
    },
    {
      sheetCode: "HID-01",
      title: "Instalações Hidráulicas e Esgoto Sanitário — Complementares",
      subtitle: "Distribuição de água fria/quente, barriletes e caixas de gordura",
      subject: "Instalações Hidrossanitárias",
      discipline: "HIDROSSANITARIO" as const,
      phaseFolder: "PROJETO_EXECUTIVO" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PRANCHA_EXECUTIVA" as const,
      version: "R00",
      fileSize: "4.5 MB",
      fileUrl: "/demo-files/HID-01_Instalacoes_Hidraulicas_Revit_R00.pdf",
      status: "APROVADO_INTERNO" as const,
      stageId: findStage("Projeto Hidrossanitário - Esgotamento"),
      isClientView: true,
      isRequired: true,
      description: "Modelagem e detalhamento executivo de prumadas, ramais de descarga e reservatório superior.",
    },
    {
      sheetCode: "ELE-01",
      title: "Distribuição de Força, Iluminação e Quadro de Cargas — Complementares",
      subtitle: "Circuitos terminais, diagramas unifilares e infraestrutura de automação",
      subject: "Instalações Elétricas e Iluminação",
      discipline: "ELETRICO" as const,
      phaseFolder: "PROJETO_EXECUTIVO" as const,
      category: "PLANTA_TECNICA_PDF" as const,
      type: "PRANCHA_EXECUTIVA" as const,
      version: "R00",
      fileSize: "5.4 MB",
      fileUrl: "/demo-files/ELE-01_Distribuicao_Forca_Iluminacao_Revit_R00.pdf",
      status: "APROVADO_INTERNO" as const,
      stageId: findStage("Projeto Elétrico"),
      isClientView: true,
      isRequired: true,
      description: "Projeto elétrico predial com dimensionamento de disjuntores, circuitos e balanceamento de fases.",
    },
  ];

  for (const item of deliverablesData) {
    const created = await prisma.projectDeliverable.create({
      data: {
        projectId: project.id,
        ...item,
      },
    });

    // Registra um log inicial de auditoria
    await prisma.deliverableAccessLog.create({
      data: {
        projectId: project.id,
        deliverableId: created.id,
        userName: "Sistema (Inicialização)",
        userRole: "ADMIN",
        action: "VIEW",
        sheetTitle: `${item.sheetCode} · ${item.title}`,
      },
    });
  }

  console.log(`${deliverablesData.length} entregáveis cadastrados e distribuídos nas 3 fases normativas!`);
  console.log("=== Sincronização Concluída com Sucesso! ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
