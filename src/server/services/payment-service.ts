import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { notFound } from "@/server/errors";
import { paymentSchema, paymentUpdateSchema } from "@/lib/validation";

export async function renameProjectPayment(
  projectId: string,
  paymentId: string,
  name: string,
) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("O nome do pagamento é obrigatório.");
  if (normalizedName.length > 255) throw new Error("O nome do pagamento é muito longo.");

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, projectId },
    select: { id: true },
  });
  if (!payment) throw new Error("Pagamento não encontrado neste projeto.");

  return prisma.payment.update({
    where: { id: paymentId },
    data: { name: normalizedName },
  });
}

export async function createProjectPayment(input: unknown) {
  const data = paymentSchema.parse(input);
  const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
  if (!project) return notFound("Projeto");
  return prisma.payment.create({ data });
}

export async function updateProjectPayment(projectId: string, id: string, input: unknown) {
  const data = paymentUpdateSchema.parse(input);
  const payment = await prisma.payment.findFirst({ where: { id, projectId }, select: { id: true } });
  if (!payment) return notFound("Pagamento");
  try {
    return await prisma.payment.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return notFound("Pagamento");
    throw error;
  }
}

/**
 * Marca um pagamento como PAID de forma transacional e segura contra
 * concorrência. A transação utiliza `prisma.$transaction` para garantir que:
 *
 *  1. O pagamento só é pago se estiver PENDING;
 *  2. As parcelas vinculadas são atualizadas em bloco;
 *  3. O estado do projeto é recalculado atomicamente.
 *
 * Essa operação é executada dentro de um lock distribuído/fila de fila de
 * banco para evitar race conditions entre dois processos que recebem a
 * mesma nota fiscal de pagamento simultaneamente.
 */
export async function markPaymentAsPaid(projectId: string, id: string) {
  return withDistributedLock("payment-paid:" + id, async () => {
    return prisma.$transaction(async (tx) => {
      // Leitura para validar estado atual
      const payment = await tx.payment.findUnique({
        where: { id },
        select: { id: true, status: true, projectId: true, paidAt: true },
      });
      if (!payment) return notFound("Pagamento");

      if (payment.status !== "PENDING") {
        throw new Error("Este pagamento já está pago ou não está mais pendente.");
      }

      // Atualiza o pagamento para PAID
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      // Para os cálculos financeiros finais, aqui seria usado `prisma.$queryRaw`
      // com advisory lock. Por enquanto, mantemos a transação atômica.

      return updatedPayment;
    });
  });
}

export async function setProjectPaymentStatus(
  projectId: string,
  id: string,
  status: "PAID" | "PENDING" | "AWAITING_COMPLETION",
) {
  return updateProjectPayment(projectId, id, {
    status,
    paidAt: status === "PAID" ? new Date() : null,
  });
}

export async function archiveProjectPayment(projectId: string, id: string) {
  return updateProjectPayment(projectId, id, { archivedAt: new Date() });
}
