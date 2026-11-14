/**
 * FASE 2.5 — Configuração de homologação/dev para Wagner Silva no Neon Postgres.
 *
 * Mantém wagner.silva@arqvertice.com.br com role: "ENGENHEIRO",
 * isActive: true, e TODAS as permissões de módulos habilitadas
 * (["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"]),
 * com vínculo a TODOS os projetos, para que ele teste 100% da plataforma dentro
 * de /equipe sem restrições. O Admin Eduardo Marques pode limitar os módulos
 * dele depois pelo painel /admin/equipe.
 *
 * Uso:
 *   npx wagner:setup        # cria/updates Wagner com permissões plenas
 *   npx wagner:reset        # remove o vínculo de projetos (permite restrição)
 *
 * O script lê DATABASE_URL do .env (ou Neon connection string) e opera via Prisma.
 */

import { prisma } from "../src/server/db.js";

// Configuração de Wagner Silva
const WAGNER_EMAIL = "wagner.silva@arqvertice.com.br";
const FULL_PERMISSIONS = [
  "dashboard",
  "cronograma",
  "projetos",
  "financeiro",
  "clientes",
  "equipe",
];

async function ensureUser() {
  let user = await prisma.user.findUnique({
    where: { email: WAGNER_EMAIL },
  });

  if (!user) {
    console.log(`[setup-wagner] ✨ Criando usuário: ${WAGNER_EMAIL}`);
    user = await prisma.user.create({
      data: {
        email: WAGNER_EMAIL,
        name: "Wagner Silva",
        role: "ENGENHEIRO",
        passwordHash: await hashPassword("wagner-dev-pass-2026"),
        isActive: true,
        permissions: FULL_PERMISSIONS,
        specialty: "Arquiteto / Engenheiro",
        sessionVersion: 0,
      },
    });
    console.log(`[setup-wagner] ✅ Usuário criado: ${user.id}`);
  } else {
    console.log(`[setup-wagner] 🔧 Atualizando usuário existente: ${WAGNER_EMAIL}`);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "ENGENHEIRO",
        isActive: true,
        permissions: FULL_PERMISSIONS,
        // Invalida sessões antigas para forçar login no novo ambiente
        sessionVersion: (user.sessionVersion ?? 0) + 1,
      },
    });
    console.log(`[setup-wagner] ✅ Usuário atualizado: ${user.id}`);
  }

  // Vincula Wagner a TODOS os projetos (sem restrições de acesso)
  const projects = await prisma.project.findMany({
    select: { id: true },
  });

  if (projects.length > 0) {
    const existing = await prisma.projectAccess.findMany({
      where: {
        userId: user.id,
        projectId: { in: projects.map((p) => p.id) },
      },
      select: { projectId: true },
    });

    const existingIds = new Set(existing.map((p) => p.projectId));
    const toLink = projects.filter((p) => !existingIds.has(p.id));

    if (toLink.length > 0) {
      console.log(`[setup-wagner] 🔗 Vincular ${toLink.length} projeto(s) a Wagner`);
      await prisma.projectAccess.createMany({
        data: toLink.map((p) => ({
          userId: user.id,
          projectId: p.id,
          canEdit: true,
        })),
      });
    }
  }

  console.log(`[setup-wagner] 🎉 Wagner está pronto: /equipe com acesso total`);
  return user;
}

async function resetPermissions() {
  const user = await prisma.user.findUnique({
    where: { email: WAGNER_EMAIL },
  });

  if (!user) {
    console.error("[wagner:reset] ❌ Wagner não encontrado. Rode setup primeiro.");
    process.exit(1);
  }

  // Remove o vínculo com todos os projetos (permite que o ADMIN o restrinja)
  await prisma.projectAccess.deleteMany({ where: { userId: user.id } });

  // Mantém as permissões, mas sem projetos vinculados
  console.log("[wagner:reset] 🔓 Vínculos de projetos removidos. Wagner só pode acessar módulos com permissão explícita.");
}

// Verifica se o script deve executar setup ou reset
const [,, action] = process.argv;
if (action === "reset" || action === "--reset") {
  resetPermissions();
} else {
  ensureUser();
}

async function hashPassword(password) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hashSync(password, 10);
}
