import { prisma } from "@/server/db";
import { requireProjectAccess } from "@/server/auth";
import { requireModuleAccess } from "@/lib/rbac-helpers";
import { DomainError } from "@/server/errors";

export async function listProjectReports(projectId: string, clientVisible = false) {
  if (clientVisible) await requireProjectAccess(projectId);
  else {
    await requireModuleAccess("projetos");
  }
  return prisma.projectReport.findMany({
    where: { projectId, ...(clientVisible ? { status: "RELEASED" } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateReportVisibility(projectId: string, reportId: string, status: "PREPARING" | "INTERNAL" | "RELEASED" | "ARCHIVED") {
  await requireModuleAccess("projetos");
  const report = await prisma.projectReport.findFirst({ where: { id: reportId, projectId }, select: { id: true } });
  if (!report) throw new DomainError("Relatório não encontrado.", "NOT_FOUND");
  return prisma.projectReport.update({
    where: { id: reportId },
    data: { status, releasedAt: status === "RELEASED" ? new Date() : null, archivedAt: status === "ARCHIVED" ? new Date() : null },
  });
}



