import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { clientSchema, clientUpdateSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { randomBytes } from "node:crypto";

function normalizeClientData(data: ReturnType<typeof clientSchema.parse>) {
  const { address, phone, document, ...rest } = data;
  return {
    ...rest,
    phone: phone ? phone.trim() : null,
    document: document ? document.replace(/[^\d.-]/g, "").trim() : null,
    ...(address === undefined
      ? {}
      : { address: address === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(address)) as Prisma.InputJsonValue }),
  };
}

export async function createClient(input: unknown) {
  return prisma.client.create({ data: normalizeClientData(clientSchema.parse(input)) });
}

/**
 * Listagem com busca real no banco. A filtragem acontece na base de dados e
 * não depois de trazer tudo para a memória — que era o que a barra de pesquisa
 * fazia antes (nada).
 */
export async function listClients(query?: string) {
  const term = query?.trim();
  return prisma.client.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  return (await prisma.client.findUnique({
    where: { id },
    include: { projects: { include: { installments: { orderBy: [{ order: "asc" }, { dueDate: "asc" }] } } }, users: { select: { id: true, email: true, role: true } } },
  })) ?? notFound("Cliente");
}

export async function updateClient(id: string, input: unknown) {
  const data = clientUpdateSchema.parse(input);
  const { address, ...rest } = data;
  const normalizedData = {
    ...rest,
    ...(address === undefined
      ? {}
      : { address: address === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(address)) as Prisma.InputJsonValue }),
  };
  try {
    return await prisma.$transaction(async (transaction) => {
      const client = await transaction.client.update({ where: { id }, data: normalizedData });
      if (client.email) {
        await transaction.user.updateMany({
          where: { clientId: id },
          data: { name: client.fullName ?? client.name, email: client.email },
        });
      }
      return client;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return notFound("Cliente");
    throw error;
  }

}

function initialPassword() {
  return `Arq${randomBytes(6).toString("base64url")}!`;
}

export async function provisionClientAccess(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return notFound("Cliente");
  if (!client.email) throw new DomainError("Cadastre um e-mail antes de criar o acesso.", "VALIDATION");

  const email = client.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.clientId && existing.clientId !== id) {
    throw new DomainError("Este e-mail já está vinculado a outro cliente.", "CONFLICT");
  }
  if (existing && existing.role !== "CLIENT") {
    throw new DomainError("Este e-mail já pertence a uma conta interna.", "CONFLICT");
  }

  const password = existing ? null : initialPassword();
  const user = await prisma.$transaction(async (transaction) => {
    const account = existing
      ? await transaction.user.update({
          where: { id: existing.id },
          data: { clientId: id, name: client.fullName ?? client.name, email },
        })
      : await transaction.user.create({
          data: {
            clientId: id,
            name: client.fullName ?? client.name,
            email,
            passwordHash: hashPassword(password!),
            role: "CLIENT",
          },
        });
    return account;
  });
  return { userId: user.id, email: user.email, ready: true, temporaryPassword: password };
}

export async function archiveClient(id: string) {
  const result = await prisma.client.updateMany({ where: { id }, data: { status: "INACTIVE" } });
  if (!result.count) return notFound("Cliente");
  return getClient(id);
}

export function explainClientError(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  return "Não foi possível salvar o cliente.";
}
