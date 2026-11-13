import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    data: { sessionVersion: { increment: 1 } },
  });
  console.log(
    `✅ ${result.count} sessionVersions incrementadas. Tokens antigos invalidados.`
  );
}

main()
  .catch((error) => {
    console.error("Falha ao sincronizar sessionVersions:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });