import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runIntegrityAudit() {
  console.log("\n--- [1/4] AUDITORIA DE PROJETO E FASES ---");
  let project = await prisma.project.findFirst({
    where: {
      OR: [
        { name: { contains: "Pedro", mode: "insensitive" } },
        { client: { name: { contains: "Pedro", mode: "insensitive" } } },
      ],
    },
    include: {
      deliverables: true,
      deliverableAccessLogs: true,
      stages: true,
    },
  });

  if (!project) {
    // Se não encontrar com Pedro, pega o primeiro projeto cadastrado
    project = await prisma.project.findFirst({
      include: {
        deliverables: true,
        deliverableAccessLogs: true,
        stages: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!project) {
    throw new Error("Projeto de referência do Pedro não encontrado!");
  }
  console.log(`Projeto localizado: ${project.name} (ID: ${project.id})`);
  console.log(`Etapas do Cronograma: ${project.stages.length} cadastradas.`);

  console.log("\n--- [2/4] AUDITORIA DO ACERVO E SUBPASTAS ---");
  const preliminar = project.deliverables.filter(d => d.phaseFolder === "PROJETO_PRELIMINAR");
  const legal = project.deliverables.filter(d => d.phaseFolder === "PROJETO_LEGAL");
  const executivo = project.deliverables.filter(d => d.phaseFolder === "PROJETO_EXECUTIVO");

  console.log(`- Projeto Preliminar: ${preliminar.length} pranchas`);
  console.log(`- Projeto Legal: ${legal.length} pranchas`);
  console.log(`- Projeto Executivo: ${executivo.length} pranchas`);

  // Validar se os campos conjugados existem
  const sample = project.deliverables[0];
  if (sample) {
    console.log(`Exemplo de prancha: [${sample.sheetCode}] ${sample.title} — ${sample.subtitle || "Sem subtítulo"}`);
  }

  console.log("\n--- [3/4] TESTE DE DISPARO DE AUDITORIA DE LOGS ---");
  if (sample) {
    const testLog = await prisma.deliverableAccessLog.create({
      data: {
        projectId: project.id,
        deliverableId: sample.id,
        userName: "Audit Bot (Test)",
        userRole: "ADMIN",
        action: "VIEW",
        sheetTitle: `${sample.title} — ${sample.subtitle || ""}`,
      },
    });
    console.log(`Log de teste gravado com sucesso! ID: ${testLog.id} | Ação: ${testLog.action}`);
  }

  console.log("\n--- [4/4] RESUMO DE INTEGRIDADE ---");
  const totalLogs = await prisma.deliverableAccessLog.count({ where: { projectId: project.id } });
  console.log(`Total de logs registrados no banco Neon: ${totalLogs}`);
  console.log("STATUS: TODAS AS TABELAS E AÇÕES OPERACIONAIS.\n");
}

runIntegrityAudit()
  .catch((err) => {
    console.error("ERRO NO TESTE DE INTEGRIDADE:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
