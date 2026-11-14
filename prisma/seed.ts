import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { CONTRACT_CLAUSE_SECTIONS } from "../src/lib/contract-template";

const prisma = new PrismaClient();

/**
 * Esqueleto parametrizado do contrato (Tópico 25): sem datas, nomes ou valores
 * fixos. O texto jurídico é preenchido pelo ADMIN em /admin/mensagens.
 */
const contractSkeleton = [
  "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PROJETO",
  "",
  "CONTRATANTE: {{CLIENTE_NOME}}",
  "{{CLIENTE_CPF}}",
  "{{CLIENTE_RG}}",
  "{{CLIENTE_ENDERECO}} — {{CLIENTE_CIDADE}}",
  "",
  "CONTRATADA: {{CONTRATADO_NOME}}",
  "{{CONTRATADO_DOCUMENTO}}",
  "",
  "Data: {{DATA_CONTRATO}}",
  "Validade: {{VALIDADE}}",
  "",
  "1. OBJETO",
  "{{PROJETO_NOME}}",
  "{{PROJETO_DESCRICAO}}",
  "Área: {{AREA}}",
  "",
  "2. SERVIÇOS CONTRATADOS",
  "{{SERVICOS}}",
  "",
  "3. ETAPAS",
  "{{ETAPAS}}",
  "",
  "4. PRAZOS",
  "{{PRAZOS}}",
  "",
  "5. HONORÁRIOS",
  "{{HONORARIOS}}",
  "",
  "6. FORMA DE PAGAMENTO",
  "{{FORMA_PAGAMENTO}}",
  "Valor total: {{VALOR_TOTAL}}",
  "",
  "7. OBRIGAÇÕES",
  "",
  "8. RESPONSABILIDADES",
  "",
  "9. DIREITOS AUTORAIS",
  "",
  "10. DOCUMENTOS",
  "",
  "11. CONDIÇÕES",
  "",
  "12. ASSINATURA",
  "",
  "________________________________",
  "{{CLIENTE_NOME}}",
].join("\n");

/**
 * Catálogo inicial de serviços e faixas comerciais (Tópicos 4, 5 e 6).
 * São apenas valores padrão de demonstração: o ADMIN edita, e toda alteração
 * de preço passa a ser registrada em ServicePriceHistory.
 */
const serviceCatalog = [
  { name: "Estudo preliminar", discipline: "ARQUITETURA", unit: "M2", low: 18, medium: 24, high: 32, days: 10, order: 1 },
  { name: "Anteprojeto", discipline: "ARQUITETURA", unit: "M2", low: 28, medium: 38, high: 52, days: 15, order: 2 },
  { name: "Projeto arquitetônico executivo", discipline: "ARQUITETURA", unit: "M2", low: 45, medium: 62.5, high: 85, days: 30, order: 3 },
  { name: "Volumetria", discipline: "ARQUITETURA", unit: "UNIDADE", low: 0, medium: 450, high: 800, days: 5, order: 4 },
  { name: "Detalhamentos", discipline: "ARQUITETURA", unit: "UNIDADE", low: 0, medium: 320, high: 560, days: 7, order: 5 },
  { name: "Projeto estrutural", discipline: "ESTRUTURAL", unit: "M2", low: 38, medium: 52, high: 70, days: 25, order: 1 },
  { name: "Modulação e fundações", discipline: "ESTRUTURAL", unit: "UNIDADE", low: 0, medium: 780, high: 1200, days: 8, order: 2 },
  { name: "Memorial de cálculo estrutural", discipline: "ESTRUTURAL", unit: "UNIDADE", low: 0, medium: 900, high: 1400, days: 10, order: 3 },
  { name: "Modelagem 3D", discipline: "3D_RENDER", unit: "UNIDADE", low: 0, medium: 650, high: 1100, days: 5, order: 1 },
  { name: "Render externo", discipline: "3D_RENDER", unit: "IMAGEM", low: 180, medium: 250, high: 380, days: 3, order: 2 },
  { name: "Render interno", discipline: "3D_RENDER", unit: "IMAGEM", low: 160, medium: 220, high: 340, days: 3, order: 3 },
  { name: "Passeio virtual", discipline: "3D_RENDER", unit: "UNIDADE", low: 0, medium: 1400, high: 2200, days: 7, order: 4 },
  { name: "Projeto elétrico", discipline: "COMPLEMENTARES", unit: "M2", low: 22, medium: 30, high: 42, days: 18, order: 1 },
  { name: "Projeto hidrossanitário", discipline: "COMPLEMENTARES", unit: "M2", low: 24, medium: 33, high: 46, days: 18, order: 2 },
  { name: "Projeto de interiores", discipline: "INTERIORES", unit: "AMBIENTE", low: 900, medium: 1400, high: 2100, days: 20, order: 1 },
  { name: "Detalhamento de interiores", discipline: "INTERIORES", unit: "UNIDADE", low: 0, medium: 520, high: 880, days: 8, order: 2 },
] as const;

const packageTemplates = [
  {
    name: "Essencial",
    description: "Arquitetura + Estrutural",
    services: ["Projeto arquitetônico executivo", "Projeto estrutural"],
  },
  {
    name: "Completo",
    description: "Arquitetura + Estrutural + Complementares",
    services: ["Projeto arquitetônico executivo", "Projeto estrutural", "Projeto elétrico", "Projeto hidrossanitário"],
  },
  {
    name: "Apresentação",
    description: "Arquitetura + 3D/Render",
    services: ["Projeto arquitetônico executivo", "Modelagem 3D", "Render externo", "Render interno"],
  },
] as const;

/** E-mail do cliente de demonstração criado pelo seed. */
const DEMO_CLIENT_EMAIL = "demo@example.com";

async function main() {
  // `Client.email` NÃO é @unique no schema — só `id` o é. Usar `findUnique`
  // por email fazia o seed falhar em QUALQUER base de dados nova, com
  // "where needs at least one of `id`". `findFirst` é o correcto para um campo
  // indexado mas não único.
  const existingClient = await prisma.client.findFirst({ where: { email: DEMO_CLIENT_EMAIL } });
  const client = existingClient ?? await prisma.client.create({
    data: {
      name: "Cliente de demonstração",
      fullName: "Cliente de demonstração",
      email: "demo@example.com",
      status: "ACTIVE",
      projects: {
        create: {
          name: "Residência modelo",
          type: "Residencial",
          description: "Projeto de demonstração para validação da plataforma.",
          scope: "Estudo preliminar e projeto executivo",
          budget: 120000,
          status: "IN_PROGRESS",
          stages: {
            create: [
              { name: "Arquitetura", order: 1, status: "COMPLETED", completion: 100 },
              { name: "3D", order: 2, status: "IN_PROGRESS", completion: 50 },
              { name: "Estrutura", order: 3, status: "NOT_STARTED" },
            ],
          },
          payments: {
            create: [
              { name: "Entrada", amount: 30000, order: 1, status: "PAID", paidAt: new Date() },
              { name: "Projeto executivo", amount: 50000, order: 2, status: "PENDING" },
              { name: "Entrega final", amount: 40000, order: 3, status: "AWAITING_COMPLETION" },
            ],
          },
          briefing: {
            create: {
              responses: {
                objective: "Casa para família",
                rooms: ["sala", "cozinha"],
              },
            },
          },
        },
      },
    },
  });

  // Credenciais vêm SEMPRE do ambiente — nunca do código.
  // Uma password em Source Control é pública para sempre, mesmo num repositório
  // privado: qualquer pessoa com acesso, ou qualquer bot que varre GitHub, lê.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("Defina SEED_ADMIN_PASSWORD antes de executar o seed.");
  }
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || "Administrador";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, passwordHash: hashPassword(adminPassword), role: "ADMIN" },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: "ADMIN",
    },
  });

  // Funcionário da equipa (OPERADOR) — acesso restrito à operação do cronograma.
  // OPCIONAL, como o CLIENT: sem SEED_OPERADOR_PASSWORD o seed não o cria, para
  // não bloquear instalações que só querem o ADMIN. Não tem clientId: é equipa
  // interna e o acesso a cada projeto é dado por ProjectAccess (atribuição
  // explícita do ADMIN), nunca por cliente. A senha segue a mesma política do
  // hashPassword (>=12) e vem do ambiente — nunca do código.
  const operadorPassword = process.env.SEED_OPERADOR_PASSWORD;
  if (!operadorPassword) {
    console.info("[seed] SEED_OPERADOR_PASSWORD por definir — utilizador operador não criado.");
  } else {
    const operadorEmail = (process.env.SEED_OPERADOR_EMAIL ?? "operador@example.com").trim().toLowerCase();
    const operadorName = process.env.SEED_OPERADOR_NAME?.trim() || "Operador";
    await prisma.user.upsert({
      where: { email: operadorEmail },
      update: { name: operadorName, passwordHash: hashPassword(operadorPassword), role: "OPERADOR" },
      create: {
        name: operadorName,
        email: operadorEmail,
        passwordHash: hashPassword(operadorPassword),
        role: "OPERADOR",
      },
    });
    console.info(`[seed] Operador provisionado: ${operadorEmail} (acesso por ProjectAccess).`);
  }

  // O utilizador CLIENT é opcional: existem instalações em que só se quer o
  // ADMIN. Exigir a senha do cliente bloqueava a criação da conta principal.
  const clientPassword = process.env.SEED_CLIENT_PASSWORD;
  if (!clientPassword) {
    console.info("[seed] SEED_CLIENT_PASSWORD por definir — utilizador cliente não criado.");
  } else {
    const clientUser = await prisma.user.upsert({
      where: { email: process.env.SEED_CLIENT_EMAIL ?? client.email ?? "cliente@example.com" },
      update: { name: client.name, passwordHash: hashPassword(clientPassword), role: "CLIENT", clientId: client.id },
      create: {
        name: client.name,
        email: process.env.SEED_CLIENT_EMAIL ?? client.email ?? "cliente@example.com",
        passwordHash: hashPassword(clientPassword),
        role: "CLIENT",
        clientId: client.id,
      },
    });
    const project = await prisma.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } });
    if (project) {
      await prisma.projectAccess.upsert({
        where: { projectId_userId: { projectId: project.id, userId: clientUser.id } },
        update: {},
        create: { projectId: project.id, userId: clientUser.id },
      });
      const report = await prisma.projectReport.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } });
      if (report) {
        await prisma.projectReport.update({
          where: { id: report.id },
          data: { title: "Relatório inicial", status: "RELEASED", releasedAt: new Date() },
        });
      } else {
        await prisma.projectReport.create({
          data: { projectId: project.id, title: "Relatório inicial", status: "RELEASED", releasedAt: new Date() },
        });
      }
    }
  }
  // Tópicos 21, 24 e 25: provisiona os templates editáveis pelo ADMIN.
  await prisma.messageTemplate.upsert({
    where: { key: "proposal.whatsapp" },
    update: {},
    create: {
      key: "proposal.whatsapp",
      channel: "WHATSAPP",
      name: "Envio da proposta por WhatsApp",
      body: [
        "Olá, {{cliente}}!",
        "",
        "Preparamos uma proposta personalizada para o seu projeto na ARQVERTICE.",
        "",
        "Acesse sua apresentação:",
        "{{link}}",
        "",
        "Confira o escopo, investimento e condições da proposta.",
        "",
        "ARQVERTICE",
        "Eduardo Marques",
      ].join("\n"),
    },
  });
  await prisma.messageTemplate.upsert({
    where: { key: "contract.whatsapp" },
    update: {},
    create: {
      key: "contract.whatsapp",
      channel: "WHATSAPP",
      name: "Envio do contrato por WhatsApp",
      body: [
        "Olá, {{cliente}}!",
        "",
        "Seu contrato do projeto {{projeto}} está disponível.",
        "",
        "Acesse o contrato:",
        "{{link}}",
        "",
        "ARQVERTICE",
      ].join("\n"),
    },
  });

  const contractTemplateName = "Contrato padrão de projetos";
  const existingContractTemplate = await prisma.contractTemplate.findFirst({ where: { name: contractTemplateName } });
  if (!existingContractTemplate) {
    await prisma.contractTemplate.create({
      data: {
        name: contractTemplateName,
        isDefault: true,
        clauses: CONTRACT_CLAUSE_SECTIONS.map((section) => ({ ...section, body: "" })),
        body: contractSkeleton,
      },
    });
  }

  // Tópico 26: contratos por disciplina/escopo.
  const scopedTemplates = [
    { name: "Contrato — Arquitetura", scopeKey: "arquitetura", disciplines: ["ARQUITETURA"] },
    {
      name: "Contrato — Arquitetura + Estrutural",
      scopeKey: "arquitetura-estrutural",
      disciplines: ["ARQUITETURA", "ESTRUTURAL"],
    },
    {
      name: "Contrato — Arquitetura + Complementares",
      scopeKey: "arquitetura-complementares",
      disciplines: ["ARQUITETURA", "COMPLEMENTARES"],
    },
    { name: "Contrato — Interiores", scopeKey: "interiores", disciplines: ["INTERIORES"] },
    { name: "Contrato — 3D / Render", scopeKey: "render", disciplines: ["3D_RENDER"] },
  ];
  for (const scoped of scopedTemplates) {
    const alreadyThere = await prisma.contractTemplate.findFirst({ where: { name: scoped.name } });
    if (alreadyThere) continue;
    await prisma.contractTemplate.create({
      data: {
        name: scoped.name,
        scopeKey: scoped.scopeKey,
        disciplines: scoped.disciplines,
        isDefault: false,
        clauses: CONTRACT_CLAUSE_SECTIONS.map((section) => ({ ...section, body: "" })),
        body: contractSkeleton,
      },
    });
  }

  // Tópicos 3 a 6: cadastro de serviços e precificação (não sobrescreve edições do ADMIN).
  for (const entry of serviceCatalog) {
    await prisma.serviceItem.upsert({
      where: { discipline_name: { discipline: entry.discipline, name: entry.name } },
      update: {},
      create: {
        name: entry.name,
        discipline: entry.discipline,
        unit: entry.unit,
        baseLow: new Prisma.Decimal(entry.low),
        baseMedium: new Prisma.Decimal(entry.medium),
        baseHigh: new Prisma.Decimal(entry.high),
        estimatedDays: entry.days,
        displayOrder: entry.order,
      },
    });
  }

  // Tópico 11: pacotes comerciais composveis.
  for (const template of packageTemplates) {
    const pack = await prisma.commercialPackage.upsert({
      where: { name: template.name },
      update: {},
      create: { name: template.name, description: template.description },
    });
    const composed = await prisma.packageItem.count({ where: { packageId: pack.id } });
    if (composed > 0) continue;
    const services = await prisma.serviceItem.findMany({
      where: { name: { in: [...template.services] } },
      orderBy: { displayOrder: "asc" },
    });
    if (!services.length) continue;
    await prisma.packageItem.createMany({
      data: services.map((service, index) => ({ packageId: pack.id, serviceId: service.id, displayOrder: index })),
    });
  }

  // Bootstrap não-destrutivo de Project3DAsset (Showcase 3D Sketchfab) para todos os empreendimentos
  const allProjects = await prisma.project.findMany({
    select: { id: true, name: true },
  });
  for (const proj of allProjects) {
    const existingAssets = await prisma.project3DAsset.count({
      where: { projectId: proj.id },
    });
    if (existingAssets === 0) {
      await prisma.project3DAsset.create({
        data: {
          projectId: proj.id,
          title: `Maquete Eletrônica Executiva — ${proj.name}`,
          description:
            "Modelo 3D BIM/PBR otimizado com compressão Meshopt para inspeção executiva de fachadas, caixilharias, revestimentos ACM e luminotécnica.",
          glbUrl: "/models/arqvertice-showcase.glb",
          posterUrl: "/models/arqvertice-showcase-poster.svg",
          fileSizeBytes: 23352,
          optimizationStats: {
            originalBytes: 42588,
            optimizedBytes: 23352,
            compressionRatio: 45.2,
            meshopt: true,
            ktx2: false,
            vertexCount: 888,
            drawCalls: 6,
          },
          cameraPreset: {
            position: [18.5, 13.0, 21.0],
            target: [0, 5.2, 0],
            fov: 42,
          },
          annotations: [
            {
              id: "pin-pele-vidro-brise",
              index: 1,
              x: 4.8,
              y: 8.6,
              z: 4.9,
              normal: [0, 0, 1],
              cameraPosition: [11.2, 10.4, 13.8],
              cameraTarget: [3.2, 8.2, 3.8],
              title: "Pele de Vidro & Brise Metálico",
              description:
                "Sistema estrutural Glazing com vidro duplo insulado de controle solar e brises verticais em alumínio anodizado champagne.",
              materialSpec: "Vidro Insulado Low-E 6+12+6mm · Alumínio Champagne",
              dimensions: "Módulos 1,25m × 3,20m (Pé-direito duplo)",
            },
            {
              id: "pin-guarda-corpo-laminado",
              index: 2,
              x: -4.6,
              y: 5.4,
              z: 5.6,
              normal: [0, 0, 1],
              cameraPosition: [-12.0, 6.8, 13.5],
              cameraTarget: [-3.5, 5.0, 4.5],
              title: "Guarda-Corpo em Vidro Laminado",
              description:
                "Guarda-corpo panorâmico engastado em perfil U de aço inox oculto na laje, garantindo transparência contínua nos terraços.",
              materialSpec: "Vidro Laminado Temperado 10+10mm + PVB Estrutural",
              dimensions: "H = 1,10m · Extensão frontal 14,40m",
            },
            {
              id: "pin-acm-matte-black",
              index: 3,
              x: 5.2,
              y: 3.1,
              z: -4.2,
              normal: [1, 0, 0],
              cameraPosition: [14.5, 4.8, -10.5],
              cameraTarget: [3.8, 3.2, -3.0],
              title: "Revestimento ACM Matte Black",
              description:
                "Fachada ventilada no embasamento e coroamento em painéis de alumínio composto pintura PVDF Kynar 500 preto fosco.",
              materialSpec: "ACM 4mm Núcleo Mineral Incombustível · #18181B",
              dimensions: "Paginação 1,50m × 3,00m · Junta seca 12mm",
            },
            {
              id: "pin-iluminacao-linear-2700k",
              index: 4,
              x: 0.0,
              y: 1.8,
              z: 6.2,
              normal: [0, 1, 0],
              cameraPosition: [6.4, 3.0, 13.2],
              cameraTarget: [0.0, 1.6, 4.8],
              title: "Iluminação Linear 2700K",
              description:
                "Perfis de LED arquitetural embutidos nas sancas do pórtico de acesso e marquise em balanço, destacando os planos em concreto e madeira.",
              materialSpec: "Perfil Extrudado IP67 · LED 2700K IRC > 95 (18W/m)",
              dimensions: "Linhas contínuas de 12,00m · Fluxo 1650 lm/m",
            },
          ],
          isFeatured: true,
        },
      });
    }
  }

  console.info(`Seed concluído para o cliente ${client.id} (${allProjects.length} empreendimentos com Showcase 3D).`);
}

main()
  .catch((error) => {
    console.error("Falha ao executar o seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
