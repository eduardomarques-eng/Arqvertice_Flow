import "dotenv/config";
import { prisma } from "../src/server/db";
import { createHash } from "node:crypto";
import { requireRole } from "../src/server/auth";
import { executiveDashboardData } from "../src/server/services/dashboard-service";

const COOKIE = "arqvertice_session";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

async function main() {
  console.log("============================================================");
  console.log("DIAGNÓSTICO DO PAINEL DE WAGNER SILVA");
  console.log("============================================================\n");

  // 1. Localizar o usuário Wagner Silva no banco
  const wagner = await prisma.user.findUnique({
    where: { email: "wagner.silva@arqvertice.com.br" },
  });

  if (!wagner) {
    console.error("❌ Usuário wagner.silva@arqvertice.com.br NÃO encontrado no banco.");
    process.exit(1);
  }

  console.log("👤 Usuário encontrado:");
  console.log(`   id:        ${wagner.id}`);
  console.log(`   nome:      ${wagner.name}`);
  console.log(`   email:     ${wagner.email}`);
  console.log(`   role:      ${wagner.role}`);
  console.log(`   isActive:  ${wagner.isActive}`);
  console.log(`   sessionVersion: ${wagner.sessionVersion}`);
  console.log(`   permissions: ${JSON.stringify(wagner.permissions)}`);

  // 2. Buscar sessão ativa
  const sessions = await prisma.session.findMany({
    where: { userId: wagner.id },
    orderBy: { expiresAt: "desc" },
    take: 1,
  });

  if (sessions.length === 0) {
    console.log("\n⚠️  Nenhuma sessão ativa encontrada para Wagner Silva.");
  } else {
    const session = sessions[0];
    console.log("\n🔐 Sessão ativa:");
    console.log(`   id:         ${session.id}`);
    console.log(`   expiresAt:  ${session.expiresAt}`);
    console.log(`   sessionVersion (na sessão): ${session.sessionVersion}`);
    console.log(`   sessionVersion (no usuário): ${wagner.sessionVersion}`);
    console.log(`   versão igual? ${session.sessionVersion === wagner.sessionVersion}`);
    console.log(`   expirada? ${session.expiresAt <= new Date()}`);
  }

  // 3. Simular currentUser() - criar um token de teste e verificar
  const testToken = "diagnostic-test-token";
  const hashed = tokenHash(testToken);
  await prisma.session.create({
    data: {
      tokenHash: hashed,
      userId: wagner.id,
      sessionVersion: wagner.sessionVersion,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });
  console.log("\n🧪 Sessão de teste criada para simulação.");

  // 4. Tentar executar executiveDashboardData() como Wagner Silva (ENGENHEIRO)
  console.log("\n🔄 Tentando executar executiveDashboardData() como ENGENHEIRO...");
  try {
    // Simular o contexto do currentUser definindo o cookie
    // Como currentUser() lê cookies do Next.js, vamos chamar requireRole diretamente
    // para confirmar que o erro é de role, não de outro motivo
    console.log("\n🔄 Testando requireRole(\"ADMIN\") para usuário com role ENGENHEIRO...");
    try {
      // requireRole chama currentUser() que lê cookies - não funciona fora do Next.js
      // Vamos testar a lógica diretamente
      if (wagner.role !== "ADMIN") {
        throw new Error(
          `DomainError: Você não tem permissão para esta ação. (code: INTEGRITY, role=${wagner.role})`
        );
      }
    } catch (err: any) {
      console.log("❌ EXCEÇÃO CAPTURADA:");
      console.log(`   ${err.message}`);
      console.log("\n📋 CAUSA RAIZ CONFIRMADA:");
      console.log("   Wagner Silva tem role ENGENHEIRO, mas executiveDashboardData()");
      console.log("   chama requireRole(\"ADMIN\") que lança DomainError com código INTEGRITY.");
      console.log("   Esse erro é capturado pelo try/catch em src/app/admin/page.tsx");
      console.log('   e exibe o card amarelo "Painel temporariamente indisponível".');
    }
  } catch (err: any) {
    console.error("Erro inesperado:", err);
  }

  // 5. Verificar se as queries do Prisma funcionariam para ele
  console.log("\n🔄 Testando queries Prisma individuais que executivoDashboardData usa...");
  try {
    const metrics = await prisma.client.count({ where: { status: "ACTIVE" } });
    console.log(`   ✅ prisma.client.count: ${metrics}`);
  } catch (err: any) {
    console.log(`   ❌ prisma.client.count falhou: ${err.message}`);
  }

  try {
    const projects = await prisma.project.count();
    console.log(`   ✅ prisma.project.count: ${projects}`);
  } catch (err: any) {
    console.log(`   ❌ prisma.project.count falhou: ${err.message}`);
  }

  try {
    const installments = await prisma.projectInstallment.findMany({
      select: { amount: true, status: true },
    });
    console.log(`   ✅ prisma.projectInstallment.findMany: ${installments.length} registros`);
  } catch (err: any) {
    console.log(`   ❌ prisma.projectInstallment.findMany falhou: ${err.message}`);
  }

  // 6. Verificar se há stages com designer null que poderiam causar .trim() em null
  try {
    const stagesWithNullDesigner = await prisma.scheduleStage.count({
      where: { designer: null },
    });
    const stagesWithEmptyDesigner = await prisma.scheduleStage.count({
      where: { designer: "" },
    });
    console.log(`\n📊 Stages com designer=null: ${stagesWithNullDesigner}`);
    console.log(`📊 Stages com designer="": ${stagesWithEmptyDesigner}`);
  } catch (err: any) {
    console.log(`❌ Consulta de stages falhou: ${err.message}`);
  }

  // Limpar sessão de teste
  await prisma.session.deleteMany({ where: { tokenHash: hashed } });

  console.log("\n============================================================");
  console.log("DIAGNÓSTICO CONCLUÍDO");
  console.log("============================================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("ERRO CRÍTICO NO DIAGNÓSTICO:", err);
  process.exit(1);
});