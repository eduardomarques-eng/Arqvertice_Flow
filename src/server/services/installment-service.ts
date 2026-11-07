import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";
import { projectInstallmentSchema, projectInstallmentUpdateSchema } from "@/lib/validation";

export function isInstallmentOverdue(value: Date, now = new Date()) {
  const due = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return due < today;
}

function effectiveStatus(status: string, dueDate: Date) {
  return status !== "PAID" && isInstallmentOverdue(dueDate) ? "OVERDUE" : status;
}

export async function listProjectInstallments(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return notFound("Projeto");
  const installments = await prisma.projectInstallment.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { dueDate: "asc" }],
  });
  return installments.map((item) => ({ ...item, status: effectiveStatus(item.status, item.dueDate) }));
}

export async function createProjectInstallment(input: unknown) {
  const data = projectInstallmentSchema.parse(input);
  const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
  if (!project) return notFound("Projeto");
  return prisma.projectInstallment.create({ data: { ...data, status: effectiveStatus(data.status, data.dueDate) } });
}

export async function updateProjectInstallment(projectId: string, id: string, input: unknown) {
  const data = projectInstallmentUpdateSchema.parse(input);
  const installment = await prisma.projectInstallment.findFirst({ where: { id, projectId }, select: { id: true, status: true, dueDate: true, paidDate: true } });
  if (!installment) return notFound("Parcela");
  const dueDate = data.dueDate ?? installment.dueDate;
  const status = effectiveStatus(data.status ?? installment.status, dueDate);
  return prisma.projectInstallment.update({ where: { id }, data: { ...data, status } });
}

export async function deleteProjectInstallment(projectId: string, id: string) {
  const installment = await prisma.projectInstallment.findFirst({ where: { id, projectId }, select: { id: true } });
  if (!installment) return notFound("Parcela");
  return prisma.projectInstallment.delete({ where: { id } });
}
