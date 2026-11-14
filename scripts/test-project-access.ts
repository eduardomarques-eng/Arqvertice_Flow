import { PrismaClient } from "@prisma/client";
import { kanbanBoard } from "../src/server/services/schedule-service";

const prisma = new PrismaClient();

async function main() {
  const wagner = await prisma.user.findUnique({ where: { email: "wagner.silva@arqvertice.com.br" } });
  console.log("Wagner:", wagner);

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      access: { select: { userId: true, user: { select: { email: true, name: true } } } },
      stages: { select: { id: true, name: true, designer: true } }
    }
  });

  console.log(`\nFound ${projects.length} projects:`);
  for (const p of projects) {
    console.log(`- Project ${p.id} ("${p.name}")`);
    console.log(`  Access users:`, p.access.map(a => `${a.user.name} (${a.user.email})`));
    console.log(`  Stages count: ${p.stages.length}, designers:`, [...new Set(p.stages.map(s => s.designer))]);
  }

  const p1 = "8ed368d6-e601-4c67-98f3-db6bed920e0a";
  const p2 = "2b2bdf4e-4e85-4762-b57d-ac0274c53bb5";

  console.log(`\nChecking p1 (${p1}):`, projects.find(p => p.id === p1) ? "EXISTS" : "NOT FOUND");
  console.log(`Checking p2 (${p2}):`, projects.find(p => p.id === p2) ? "EXISTS" : "NOT FOUND");

  if (projects.find(p => p.id === p1)) {
    try {
      const board = await kanbanBoard(p1);
      console.log(`kanbanBoard(p1) success, project name: ${board.project.name}, stages: ${board.stages.length}`);
    } catch (e) {
      console.error(`kanbanBoard(p1) failed:`, e);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
