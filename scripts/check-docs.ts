import { prisma } from "../src/server/db";

async function main() {
  const docs = await prisma.projectDocument.findMany();
  console.log("Documents in DB:", docs.length, docs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
