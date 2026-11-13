require('dotenv/config');
const { prisma } = require('./src/server/db');

async function main() {
  const wagner = await prisma.user.findUnique({
    where: { email: "wagner.silva@arqvertice.com.br" },
  });

  if (!wagner) {
    console.error("❌ Wagner Silva não encontrado.");
    process.exit(1);
  }

  console.log("👤 Antes:");
  console.log(`   role: ${wagner.role}`);
  console.log(`   isActive: ${wagner.isActive}`);
  console.log(`   permissions: ${JSON.stringify(wagner.permissions)}`);

  // Atualizar Wagner: role ENGENHEIRO, isActive true, todas as permissões de módulo
  const updated = await prisma.user.update({
    where: { id: wagner.id },
    data: {
      role: "ENGENHEIRO",
      isActive: true,
      permissions: ["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"],
      sessionVersion: wagner.sessionVersion + 1, // Invalida sessões antigas
    },
  });

  console.log("\n✅ Depois:");
  console.log(`   role: ${updated.role}`);
  console.log(`   isActive: ${updated.isActive}`);
  console.log(`   permissions: ${JSON.stringify(updated.permissions)}`);
  console.log(`   sessionVersion: ${updated.sessionVersion}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});