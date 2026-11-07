import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || "eduardo.marques.arq@gmail.com").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ArqVertice@2026";
  const name = "Eduardo Marques";

  console.log(`=== Upsert e Validação de Credenciais do Administrador ===`);
  console.log(`E-mail: ${email}`);
  console.log(`Nome: ${name}`);

  // 1. Gerar hash com a regra oficial da aplicação
  const passwordHash = hashPassword(password);
  console.log(`Hash gerado com sucesso (${passwordHash.length} caracteres).`);

  // 2. Upsert no Neon Postgres
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log(`Usuário atualizado no Neon Postgres:`);
  console.log(`- ID: ${user.id}`);
  console.log(`- Nome: ${user.name}`);
  console.log(`- E-mail: ${user.email}`);
  console.log(`- Papel (Role): ${user.role}`);

  // 3. Teste de verificação do hash
  const isValid = verifyPassword(password, user.passwordHash);
  console.log(`\n=== Teste de Login Local ===`);
  console.log(`Senha testada: "${password}"`);
  console.log(`Validação do hash: ${isValid ? "SUCESSO (VÁLIDO)" : "FALHA (INVÁLIDO)"}`);

  if (!isValid) {
    throw new Error("A validação do hash falhou!");
  }

  console.log(`\nPronto! O login em http://localhost:3000/login com "${email}" e a senha informada funcionará perfeitamente.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
