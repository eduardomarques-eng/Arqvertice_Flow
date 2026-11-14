import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordHash: true,
    }
  });

  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    const passMatches = verifyPassword("ArqVertice@2026", u.passwordHash);
    console.log(`- ${u.name} (${u.email}) [${u.role}] active: ${u.isActive} | password matches ArqVertice@2026: ${passMatches}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
