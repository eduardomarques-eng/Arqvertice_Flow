/**
 * src/lib/distributed-lock.ts
 *
 * Locks distribuídos via advisory locks do PostgreSQL (pg_try_advisory_xact_lock).
 *
 * Para cada sessão de solicitação, gera um hash determinístico a partir de
 * uma string de chave (ex.: fechamento-financeiro, geracao-proposta:123).
 * Este lock é automaticamente liberado no final da transação, garantindo que:
 *
 *   - duas requisições simultâneas de fechamento financeiro de um mesmo
 *     projeto NÃO executem a lógica em paralelo;
 *   - cada sessão (transação) impede a outra, inclusive entre containers
 *     diferentes, desde que reutilizem a mesma conexão PostgreSQL (Neon pooler).
 *
 * Como o Neon Postgres utiliza o pooler, o lock é distribuído entre todas as
 * fatias de compute/replica que compõem o pool de conexões.
 */

import { prisma } from "@/server/db";

/**
 * Cria um hash determinístico a partir de uma string de chave.
 */
function shasum(key: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const data = new TextEncoder().encode(key);

  for (let i = 0; i < data.length; i++) {
    h1 = Math.imul(h1 ^ data[i], 2654435761);
    h2 = Math.imul(h2 ^ data[i], 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h2 >>> 0) % 1000000;
}

/**
 * Retry com backoff exponencial para tentar adquirir o lock.
 */
async function tryAcquireLock(lockKey: string, retries = 5): Promise<boolean> {
  const hash = shasum(lockKey);

  for (let i = 0; i < retries; i++) {
    try {
      const result = (await prisma.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${BigInt(hash)}) AS acquired
      `);

      if (result && result.length > 0 && result[0].acquired) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 100));
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }

  return false;
}

export async function withDistributedLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  retries = 5,
): Promise<T> {
  const acquired = await tryAcquireLock(lockKey, retries);
  if (!acquired) {
    throw new Error("[distributed-lock] Não foi possível adquirir o lock " + lockKey + " após " + retries + " tentativas.");
  }

  try {
    return await fn();
  } finally {
    // O advisory lock é liberado automaticamente no final da transação.
  }
}

/**
 * Executa uma função dentro de um advisory lock, retornando o resultado.
 * Se o lock não puder ser adquirido, retorna null.
 */
export async function withDistributedLockOrNull<T>(
  lockKey: string,
  fn: () => Promise<T>,
  retries = 5,
): Promise<T | null> {
  const acquired = await tryAcquireLock(lockKey, retries);
  if (!acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    // Liberação automática no final da transação
  }
}

/**
 * Verifica se o lock está disponível (sem adquiri-lo).
 * Útil para logs e monitoramento.
 */
export async function isLockAvailable(lockKey: string): Promise<boolean> {
  const hash = shasum(lockKey);
  const result = (await prisma.$queryRaw<{ available: boolean }[]>`
    SELECT pg_try_advisory_xact_lock(${BigInt(hash)}) AS available
  `);

  if (!result || result.length === 0) return true;

  return result[0].available;
}
