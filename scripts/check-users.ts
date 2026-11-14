import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "../src/lib/password";

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
    const isBcrypt = u.passwordHash.startsWith("$2");
    const isScrypt = u.passwordHash.includes(":");
    const passMatches = verifyPassword("ArqVertice@2026", u.passwordHash);
    console.log(`- ${u.name} (${u.email}) [${u.role}] active: ${u.isActive} | isBcrypt: ${isBcrypt} | isScrypt: ${isScrypt} | match: ${passMatches}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
