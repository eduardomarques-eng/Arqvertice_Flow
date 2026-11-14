import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { notFound } from "@/server/errors";
import { projectInstallmentSchema, projectInstallmentUpdateSchema } from "@/lib/validation";
import { withDistributedLock } from "@/lib/distributed-lock";

export function isInstallmentOverdue(value: Date, now = new Date()) {
  const due = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return due < today;
}

function effectiveStatus(status: string, dueDate: Date) {
  return status !== "PAID" && isInstallmentOverdue(dueDate) ? "OVERDUE" : status;
}

/**
 * Atualização otimista de parcela: verifica a versão no banco e rejeita se
 * outrem modificou o registro entre a leitura e a escrita (409 Conflict).
 * O Prisma aplica `version: { increment: 1 }` e retorna 409 se a versão
 * esperada não corresponder.
 */
async function updateWithOptimisticLock(
  projectId: string,
  id: string,
  newStatus: string,
  dueDate: Date | null,
  expectedVersion: number,
) {
  const current = await prisma.projectInstallment.findUnique({
    where: { id },
    select: { version: true, dueDate: true },
  });
  if (!current) return notFound("Parcela");
  if (current.version !== expectedVersion) {
    throw new Error("409 Conflict: Parcela foi modificada concorrentemente.");
  }

  try {
    return await prisma.projectInstallment.update({
      where: { id },
      data: {
        status: newStatus,
        dueDate: dueDate ?? current.dueDate,
        version: { increment: 1 },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound("Parcela");
    }
    throw error;
  }
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
  const installment = await prisma.projectInstallment.findFirst({ where: { id, projectId }, select: { id: true, status: true, dueDate: true, paidDate: true, version: true } });
  if (!installment) return notFound("Parcela");
  const dueDate = data.dueDate ?? installment.dueDate;
  const status = effectiveStatus(data.status ?? installment.status, dueDate);
  return withDistributedLock("installment-update:" + id, async () => {
    return updateWithOptimisticLock(projectId, id, status, dueDate, installment.version ?? 1);
  });
}

export async function deleteProjectInstallment(projectId: string, id: string) {
  const installment = await prisma.projectInstallment.findFirst({ where: { id, projectId }, select: { id: true } });
  if (!installment) return notFound("Parcela");
  return prisma.projectInstallment.delete({ where: { id } });
}
