import { PrismaClient } from "@prisma/client";
import { kanbanBoard } from "../src/server/services/schedule-service";
import { listProjectDocuments } from "../src/server/services/document-service";
import { listProjectDeliverables, getDeliverableMatrix } from "../src/server/services/deliverable-service";

const prisma = new PrismaClient();

async function testProject(id: string) {
  console.log(`\n=== Testing Project ${id} ===`);
  const project = await prisma.project.findUnique({
    where: { id },
    include: { client: { select: { name: true, phone: true, email: true } } },
  });
  console.log("Project found:", !!project, project?.name);

  try {
    const docs = await listProjectDocuments(id);
    console.log("listProjectDocuments:", docs?.length);
  } catch (e) {
    console.error("listProjectDocuments FAILED:", e);
  }

  try {
    const board = await kanbanBoard(id);
    console.log("kanbanBoard totals:", board?.totals);
  } catch (e) {
    console.error("kanbanBoard FAILED:", e);
  }

  try {
    const deliverables = await listProjectDeliverables(id);
    console.log("listProjectDeliverables:", deliverables?.length);
  } catch (e) {
    console.error("listProjectDeliverables FAILED:", e);
  }

  try {
    const matrix = await getDeliverableMatrix(id);
    console.log("getDeliverableMatrix phases:", matrix?.phases?.length);
  } catch (e) {
    console.error("getDeliverableMatrix FAILED:", e);
  }
}

async function main() {
  await testProject("8ed368d6-e601-4c67-98f3-db6bed920e0a");
  await testProject("2b2bdf4e-4e85-4762-b57d-ac0274c53bb5");
}

main().catch(console.error).finally(() => prisma.$disconnect());
