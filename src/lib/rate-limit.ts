import { createHash } from "node:crypto";
import { LRUCache } from "./lru-cache";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
  windowMs: number;
}
export type RateLimitPolicy = {
  routes: readonly string[];
  limit: number;
  windowMs: number;
  key: (request: Request, payload: Record<string, unknown>) => string;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000;
const RATE_LIMIT_CACHE_MAX = 5000;

type StoredBucket = { count: number; resetAt: number };

/** LRU Cache para buckets de rate limiting, limitando uso de memória */
const policyBuckets = new Map<string, LRUCache<string, StoredBucket>>();
let lastSweep = 0;

function sweepBuckets(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [policyName, cache] of policyBuckets) {
    for (const [key, bucket] of cache) {
      if (bucket.resetAt <= now) {
        cache.delete(key);
      }
    }
  }
}

function hashKey(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 64);
}

/**
 * Gera uma chave de bucket transparente e limitada em tamanho (anti-DoS por header).
 */
export function buildBucketKey(prefix: string, raw: string, maxLength = 512): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const safe = trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  return `${prefix}:${hashKey(safe)}`;
}

/**
 * Limite de requisições em memória, por processo.
 *
 * Em ambientes multi-instância (serverless, containers), este controle é
 * apenas por instância. O ponto único a trocar por um armazenamento
 * compartilhado (Redis, Vercel KV) é este arquivo.
 *
 * Memory leak prevention: LRU cache com teto maximo de entradas.
 */
export const RATE_LIMITS: RateLimitPolicy[] = [
  // Autenticação: max 8 req / 5 min por IP+e-mail.
  {
    routes: ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password"],
    limit: 8,
    windowMs: 5 * 60_000,
    key: (request, _payload) =>
      buildBucketKey("auth", request.headers.get("x-forwarded-for") ?? "local", 128),
  },
  // Mutações críticas: max 60 req/min por usuário.
  {
    routes: ["/api/finance/**", "/api/financeiro/**", "/api/projects/**", "/api/propostas/**", "/api/proposals/**"],
    limit: 60,
    windowMs: 60_000,
    key: (request, payload) =>
      buildBucketKey("user", typeof payload.userId === "string" ? payload.userId : request.headers.get("x-forwarded-for") ?? "anon", 128),
  },
  // Rotas públicas: max 30 req/min por IP.
  {
    routes: ["/api/briefings", "/api/briefings/**", "/api/health", "/api/health/**", "/api/auth/session-status"],
    limit: 30,
    windowMs: 60_000,
    key: (request, _payload) =>
      buildBucketKey("ip", request.headers.get("x-forwarded-for") ?? "local", 128),
  },
];

function getPolicyBuckets(policyName: string): LRUCache<string, StoredBucket> {
  if (!policyBuckets.has(policyName)) {
    policyBuckets.set(policyName, new LRUCache<string, StoredBucket>(RATE_LIMIT_CACHE_MAX));
  }
  return policyBuckets.get(policyName)!;
}

/**
 * Resolve a política aplicável a uma rota e chave de contagem.
 * Retorna `null` quando nenhuma política rege a rota.
 */
export function resolvePolicy(
  pathname: string,
  policies: readonly RateLimitPolicy[] = RATE_LIMITS,
): RateLimitPolicy | null {
  for (const policy of policies) {
    if (policy.routes.some((route) => pathname === route || pathname.startsWith(route))) {
      return policy;
    }
  }
  return null;
}

export function checkRateLimit(
  request: Request,
  pathname: string,
  payload: Record<string, unknown> = {},
): RateLimitResult {
  const now = Date.now();
  const policy = resolvePolicy(pathname);
  if (!policy) {
    return {
      ok: true,
      remaining: DEFAULT_LIMIT,
      retryAfterSeconds: 0,
      limit: DEFAULT_LIMIT,
      windowMs: DEFAULT_WINDOW_MS,
    };
  }

  const key = policy.key(request, payload);
  const cache = getPolicyBuckets(policy.routes[0]);
  sweepBuckets(now);
  const existing = cache.get(key);

  if (!existing || existing.resetAt <= now) {
    cache.set(key, { count: 1, resetAt: now + policy.windowMs });
    return {
      ok: true,
      remaining: policy.limit - 1,
      retryAfterSeconds: Math.ceil(policy.windowMs / 1000),
      limit: policy.limit,
      windowMs: policy.windowMs,
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > policy.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds,
      limit: policy.limit,
      windowMs: policy.windowMs,
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, policy.limit - existing.count),
    retryAfterSeconds,
    limit: policy.limit,
    windowMs: policy.windowMs,
  };
}

export function resetRateLimit(key?: string): void {
  if (key) {
    for (const cache of policyBuckets.values()) {
      cache.delete(key);
    }
    return;
  }
  for (const cache of policyBuckets.values()) {
    cache.clear();
  }
}

export function resetPolicyBuckets(policyName: string): void {
  const cache = policyBuckets.get(policyName);
  if (cache) {
    cache.clear();
  }
}

export function getRateLimitCacheSize(): number {
  let total = 0;
  for (const cache of policyBuckets.values()) {
    total += cache.size;
  }
  return total;
}

export function clearRateLimitBuckets(): void {
  for (const cache of policyBuckets.values()) {
    cache.clear();
  }
}

export default RATE_LIMITS;
