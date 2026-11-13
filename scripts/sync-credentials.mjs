/**
 * FASE 3 — Sincronização das 5 credenciais no Neon Postgres (AUTH_SECRET unificado).
 *
 * Cria/atualiza as 5 contas oficiais do ArqVértice Flow com papéis e permissões
 * de módulo corretas para isolamento /admin vs /equipe vs /portal.
 *
 * Credenciais:
 *  1. eduardo.marques.arq@gmail.com (Edu@152013)      → ADMIN                    → /admin
 *  2. wagner.silva@arqvertice.com.br   (WS@123456)    → ENGENHEIRO (todas)       → /equipe
 *  3. luan.almeida@arqvertice.com.br    (LA@123456)   → ENGENHEIRO (dashboard,cronograma,projetos) → /equipe
 *  4. erick.santiago@arqvertice.com.br  (ES@123456)   → ARQUITETO (dashboard,cronograma,projetos,clientes) → /equipe
 *  5. claudiomarrocos2018@gmail.com      (CM@123456)   → ARQUITETO (dashboard,cronograma,projetos,clientes) → /equipe
 *
 * Regras de segurança:
 *  - As senhas vêm deste script (configuração de homologação/dev). Em produção,
 *    elas devem ser definidas via variáveis de ambiente (Vercel → Env Vars).
 *  - sessionVersion é incrementado a cada atualização para invalidar sessões antigas.
 *  - isActive = true para todas.
 *
 * Uso:
 *   node scripts/sync-credentials.mjs
 */

import { PrismaClient } from "./src/server/db.js";
import { hashPassword } from "./src/lib/password.js";

const prisma = new PrismaClient();

const AUTH_USERS = [
  {
    email: "eduardo.marques.arq@gmail.com",
    password: "Edu@152013",
    name: "Eduardo Marques",
    role: "ADMIN",
    permissions: ["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"],
  },
  {
    email: "wagner.silva@arqvertice.com.br",
    password: "WS@123456",
    name: "Wagner Silva",
    role: "ENGENHEIRO",
    permissions: ["dashboard", "cronograma", "projetos", "financeiro", "clientes", "equipe"],
  },
  {
    email: "luan.almeida@arqvertice.com.br",
    password: "LA@123456",
    name: "Luan Almeida",
    role: "ENGENHEIRO",
    permissions: ["dashboard", "cronograma", "projetos"],
  },
  {
    email: "erick.santiago@arqvertice.com.br",
    password: "ES@123456",
    name: "Erick Santiago",
    role: "ARQUITETO",
    permissions: ["dashboard", "cronograma", "projetos", "clientes"],
  },
  {
    email: "claudiomarrocos2018@gmail.com",
    password: "CM@123456",
    name: "Claudio Marrocos",
    role: "ARQUITETO",
    permissions: ["dashboard", "cronograma", "projetos", "clientes"],
  },
];

async function main() {
  console.log("[sync-credentials] Iniciando sincronização das 5 credenciais...");

  for (const user of AUTH_USERS) {
    const passwordHash = await hashPassword(user.password);

    const updated = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        permissions: user.permissions,
        isActive: true,
        // Invalida sessões antigas (força novo login após alteração de credenciais)
        sessionVersion: { increment: 1 },
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        permissions: user.permissions,
        isActive: true,
        sessionVersion: 1,
      },
    });

    console.log(
      `[sync-credentials] ✅ ${user.email} → ${user.role} (permissions: ${user.permissions.join(", ")}) [id: ${updated.id}]`
    );
  }

  console.log(
    `[sync-credentials] 🎉 ${AUTH_USERS.length} contas sincronizadas com AUTH_SECRET unificado.`
  );
}

main()
  .catch((error) => {
    console.error("[sync-credentials] ❌ Erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
