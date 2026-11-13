/**
 * FASE 2.5 — Reset de homologação para Wagner Silva.
 *
 * Remove o vínculo de todos os projetos de Wagner, permitindo que o Admin
 * Eduardo Marques restrinja os módulos dele pelo painel /admin/equipe.
 *
 * Uso:
 *   npx wagner:reset
 */

import { PrismaClient } from "./src/server/db.js";

const prisma = new PrismaClient();

const WAGNER_EMAIL = "wagner.silva@arqvertice.com.br";

async function resetPermissions() {
  const user = await prisma.user.findUnique({
    where: { email: WAGNER_EMAIL },
  });

  if (!user) {
    console.error("[wagner:reset] ❌ Wagner não encontrado. Rode setup primeiro.");
    process.exit(1);
  }

  const count = await prisma.projectAccess.deleteMany({ where: { userId: user.id } });

  console.log(`[wagner:reset] 🔓 ${count} vínculo(s) de projeto removido(s) de ${WAGNER_EMAIL}`);
  console.log("[wagner:reset] ⚙️  Wagner está pronto para que o ADMIN restrinja módulos via /admin/equipe");
}

resetPermissions().catch((error) => {
  console.error("[wagner:reset] ❌ Erro:", error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
