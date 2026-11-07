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
  console.log("=== Sincronização Concluída com Sucesso! ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
