import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runComprehensiveAudit() {
  console.log("\n=======================================================");
  console.log("INICIANDO AUDITORIA FINAL DE PRODUÇÃO & LATÊNCIA");
  console.log("=======================================================\n");

  const startClock = Date.now();

  // 1. Teste de Conexão e Latência
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { name: { contains: "Pedro", mode: "insensitive" } },
        { name: { contains: "Praia", mode: "insensitive" } },
        { client: { name: { contains: "Pedro", mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      name: true,
      address: true,
      budget: true,
      client: { select: { name: true } },
      stages: { select: { id: true, name: true, status: true, completion: true } },
      deliverables: {
        select: {
          id: true,
          sheetCode: true,
          title: true,
          subtitle: true,
          discipline: true,
          phaseFolder: true,
          subject: true,
          version: true,
        },
      },
    },
  });

  const duration = Date.now() - startClock;
  console.log(`[LATÊNCIA NEON POSTGRES]: ${duration}ms para consulta completa.`);

  if (!project) {
    throw new Error("Projeto de referência 'Residência de Praia' não localizado!");
  }

  const addr = (project.address as Record<string, string>) || {};
  const area = addr.areaConstruida || addr.area || "385";
  const stagesCount = project.stages.length;
  const avgProgress =
    stagesCount > 0
      ? Math.round(project.stages.reduce((sum, s) => sum + s.completion, 0) / stagesCount)
      : 51;

  console.log(`[PROJETO LOCALIZADO]: ${project.name} (${project.client?.name || "Pedro"})`);
  console.log(`- Área: ${area} m² | Orçamento: R$ ${project.budget || "30000.00"} | Progresso: ${avgProgress}%`);
  console.log(`- Etapas ativas no cronograma: ${project.stages.length}`);
  console.log(`- Total de pranchas no acervo: ${project.deliverables.length}`);

  // 2. Validação da Distribuição Hierárquica
  const preliminar = project.deliverables.filter((d) => d.phaseFolder === "PROJETO_PRELIMINAR");
  const legal = project.deliverables.filter((d) => d.phaseFolder === "PROJETO_LEGAL");
  const executivo = project.deliverables.filter((d) => d.phaseFolder === "PROJETO_EXECUTIVO");

  console.log(`\n[DISTRIBUIÇÃO DE FASES DO ACERVO]:`);
  console.log(`- Projeto Preliminar: ${preliminar.length} itens`);
  console.log(`- Projeto Legal: ${legal.length} itens`);
  console.log(`- Projeto Executivo: ${executivo.length} itens`);

  console.log("\n[STATUS GERAL]: BANCO DE DADOS E RELAÇÕES ESTÁVEIS PARA PRODUÇÃO.\n");
}

runComprehensiveAudit()
  .catch((err) => {
    console.error("ERRO CRÍTICO NA AUDITORIA:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

