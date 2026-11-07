import { PrismaClient, ScheduleStageStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Sincronizando Pedro (Residência de Praia) no Neon ===");

  const clientAddress = {
    neighborhood: "Loteamento Praia Bela",
    city: "Litoral Sul",
    state: "CE",
    loteQuadra: "Lote 14, Quadra B",
    areaConstruida: "385,00 m²",
    areaLote: "450,00 m² (15m x 30m)",
    zoneamento: "ZR-1",
  };

  // 1. Cliente Pedro
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
  console.log("Cliente Pedro:", client.name, client.id);

  // 2. Projeto Residência de Praia
  let project = await prisma.project.findFirst({
    where: { clientId: client.id, name: { contains: "Residência de Praia", mode: "insensitive" } },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: "Residência de Praia",
        type: "Residencial Alto Padrão",
        description: "Projeto Residencial de Praia - Loteamento Praia Bela, Litoral Sul - CE (385m²)",
        scope: "Arquitetura, Estrutural, 3D e Instalações Complementares",
        budget: 30000.00,
        startDate: new Date("2026-06-12"),
        expectedEndDate: new Date("2026-11-30"),
        status: "IN_PROGRESS",
        address: clientAddress,
      },
    });
  } else {
    project = await prisma.project.update({
      where: { id: project.id },
      data: {
        name: "Residência de Praia",
        type: "Residencial Alto Padrão",
        description: "Projeto Residencial de Praia - Loteamento Praia Bela, Litoral Sul - CE (385m²)",
        scope: "Arquitetura, Estrutural, 3D e Instalações Complementares",
        budget: 30000.00,
        startDate: new Date("2026-06-12"),
        expectedEndDate: new Date("2026-11-30"),
        status: "IN_PROGRESS",
        address: clientAddress,
      },
    });
  }
  console.log("Projeto:", project.name, project.id);

  // 3. As 14 Etapas Oficiais
  const stagesData = [
    { order: 1, name: "Estudo Preliminar", discipline: "ARQUITETURA", designer: "Eduardo Marques", completion: 100, status: ScheduleStageStatus.COMPLETED, description: "Concepção arquitetônica inicial, zoneamento do lote e layout funcional dos ambientes." },
    { order: 2, name: "Projeto Básico", discipline: "ARQUITETURA", designer: "Eduardo Marques", completion: 100, status: ScheduleStageStatus.COMPLETED, description: "Plantas baixas cotadas, cortes gerais, fachadas e memorial descritivo dos materiais." },
    { order: 3, name: "Projeto Pré Formas", discipline: "ESTRUTURAL", designer: "Luan Almeida", completion: 100, status: ScheduleStageStatus.COMPLETED, description: "Lançamento inicial da malha de pilares, vigas e alinhamentos estruturais preliminares." },
    { order: 4, name: "Projeto Formas Finais", discipline: "ESTRUTURAL", designer: "Luan Almeida", completion: 100, status: ScheduleStageStatus.COMPLETED, description: "Dimensionamento e detalhamento final de formas de lajes e vigas para execução." },
    { order: 5, name: "Modelagem 3D", discipline: "3D_RENDER", designer: "Eduardo Marques", completion: 100, status: ScheduleStageStatus.COMPLETED, description: "Construção do modelo tridimensional detalhado da volumetria, caixilharia e entorno." },
    { order: 6, name: "Renderização 3D - Imagens Finais", discipline: "3D_RENDER", designer: "Eduardo Marques", completion: 100, status: ScheduleStageStatus.COMPLETED, description: "Geração de renders fotorrealistas externos e internos em alta definição (resolução 4K)." },
    { order: 7, name: "Projeto Executivo", discipline: "ARQUITETURA", designer: "Eduardo Marques", completion: 50, status: ScheduleStageStatus.IN_PROGRESS, description: "Detalhamento construtivo completo: esquadrias, revestimentos, paginações e cortes ampliados." },
    { order: 8, name: "Projeto Armaduras", discipline: "ESTRUTURAL", designer: "Luan Almeida", completion: 60, status: ScheduleStageStatus.IN_PROGRESS, description: "Cálculo e pranchas de armação de pilares, vigas, lajes e quantitativo de aço CA-50." },
    { order: 9, name: "Projeto Fundação", discipline: "ESTRUTURAL", designer: "Luan Almeida", completion: 5, status: ScheduleStageStatus.IN_PROGRESS, description: "Dimensionamento geotécnico e estrutural de sapatas/estacas baseado no laudo de sondagem SPT." },
    { order: 10, name: "Projeto Elétrico", discipline: "COMPLEMENTARES", designer: "Eduardo Marques", completion: 0, status: ScheduleStageStatus.NOT_STARTED, description: "Quadro de distribuição, circuitos, pontos de iluminação, tomadas de uso geral e proteção DPS." },
    { order: 11, name: "Projeto Hidrossanitário - Esgotamento", discipline: "COMPLEMENTARES", designer: "Eduardo Marques", completion: 0, status: ScheduleStageStatus.NOT_STARTED, description: "Traçado de tubulações de esgoto primário/secundário, caixas sifonadas e fossa/sumidouro." },
    { order: 12, name: "Execução de Obras", discipline: "OBRA", designer: "Erick Santiago", completion: 0, status: ScheduleStageStatus.NOT_STARTED, description: "Gestão de campo, canteiro de obras, fiscalização de concretagem e controle de cronograma físico." },
    { order: 13, name: "Projeto Hidrossanitário - Abastecimento", discipline: "COMPLEMENTARES", designer: "Eduardo Marques", completion: 0, status: ScheduleStageStatus.NOT_STARTED, description: "Rede de água fria, barrilete, dimensionamento de reservatório superior/inferior e pressurizador." },
    { order: 14, name: "Projeto Hidrossanitário - Drenagem", discipline: "COMPLEMENTARES", designer: "Eduardo Marques", completion: 0, status: ScheduleStageStatus.NOT_STARTED, description: "Drenagem pluvial, calhas, condutores verticais e bacias de amortecimento pluvial." },
  ];

  await prisma.scheduleStage.deleteMany({ where: { projectId: project.id } });

  for (const st of stagesData) {
    await prisma.scheduleStage.create({
      data: {
        projectId: project.id,
        order: st.order,
        name: st.name,
        discipline: st.discipline,
        designer: st.designer,
        completion: st.completion,
        status: st.status,
        description: st.description,
      },
    });
  }
  console.log("14 etapas sincronizadas com sucesso!");

  console.log("=== Sincronização concluída com sucesso! ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

