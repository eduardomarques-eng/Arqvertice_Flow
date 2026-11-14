import { setTimeout as sleep } from "node:timers/promises";
// Use the global AbortController from Node.js/Browser APIs
// instead of importing from node:fetch which causes type conflicts
import { LRUCache, createLRUCache } from "./lru-cache";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  openDuration?: number;
  halfOpenAttempts?: number;
  halfOpenTimeout?: number;
};

export class ResilientFetchError extends Error {
  public status?: number | null;
  public attempt: number;
  public circuitState: CircuitBreakerState;

  constructor(message: string, status: number | null = null, attempt: number = 0, circuitState: CircuitBreakerState = "CLOSED") {
    super(message);
    this.name = "ResilientFetchError";
    this.status = status;
    this.attempt = attempt;
    this.circuitState = circuitState;
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenSuccessCount = 0;
  private readonly failureThreshold: number;
  private readonly openDuration: number;
  private readonly halfOpenAttempts: number;
  private readonly halfOpenTimeout: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.openDuration = options.openDuration ?? 30_000;
    this.halfOpenAttempts = options.halfOpenAttempts ?? 3;
    this.halfOpenTimeout = options.halfOpenTimeout ?? 2000;
  }

  canExecute(): boolean {
    if (this.state === "CLOSED") return true;

    const now = Date.now();
    if (this.state === "OPEN" && now - this.lastFailureTime >= this.openDuration) {
      this.state = "HALF_OPEN";
      return true;
    }

    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.halfOpenAttempts) {
        this.state = "CLOSED";
        this.halfOpenSuccessCount = 0;
      }
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.halfOpenSuccessCount = 0;
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getBlockedDuration(): number {
    if (this.state !== "OPEN") return 0;
    return Math.max(0, this.lastFailureTime + this.openDuration - Date.now());
  }
}

export type BackoffOptions = {
  baseDelay?: number;
  maxDelay?: number;
  maxRetries?: number;
  jitter?: boolean;
};

export async function exponentialBackoffWithJitter(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 30_000,
  options: BackoffOptions = {}
): Promise<void> {
  const { maxRetries = 5, jitter = true } = options;
  if (attempt > maxRetries) return Promise.resolve();

  const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
  const jitterValue = jitter ? Math.random() * delay * 0.3 : 0;
  const totalDelay = delay + jitterValue;

  await sleep(Math.floor(totalDelay));
}

export type ResilientFetchOptions = {
  timeout?: number;
  maxRetries?: number;
  asText?: boolean;
  isRetryable?: (status: number | null, error: Error) => boolean;
  logger?: {
    info?: (message: string, ...args: unknown[]) => void;
    warn?: (message: string, ...args: unknown[]) => void;
    error?: (message: string, ...args: unknown[]) => void;
  };
  breakoutThreshold?: number;
};

export async function resilientFetch(
  input: string | URL | Request,
  init?: RequestInit,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const {
    timeout = 8000,
    maxRetries = 3,
    asText = false,
    isRetryable = (status, error) => {
      if (error instanceof ResilientFetchError) return false;
      return [408, 429, 502, 503, 504].includes(status ?? 0);
    },
    logger,
    breakoutThreshold = 3,
  } = options;

  const breaker = new CircuitBreaker({
    failureThreshold: breakoutThreshold,
    openDuration: 30_000,
    halfOpenAttempts: 3,
    halfOpenTimeout: 2000,
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await exponentialBackoffWithJitter(attempt, 1000, 30_000, { maxRetries, jitter: true });
    }

    if (!breaker.canExecute()) {
      const blocked = breaker.getBlockedDuration();
      logger?.warn?.(
        `[CircuitBreaker] ORDENA BLOQUEADA por ${blocked}ms (estado=${breaker.getState()})`
      );
      throw new ResilientFetchError(
        `Circuit breaker open (estadia bloqueada ${blocked}ms)`,
        null,
        attempt,
        breaker.getState()
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.status === 429 || [502, 503, 504].includes(response.status)) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * 2 ** attempt, 30_000);
        await sleep(delay);
        breaker.recordFailure();
        continue;
      }

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        Object.setPrototypeOf(error, ResilientFetchError.prototype);
        (error as ResilientFetchError).status = response.status;
        (error as ResilientFetchError).attempt = attempt;
        (error as ResilientFetchError).circuitState = breaker.getState();
        breaker.recordFailure();
        throw error as ResilientFetchError;
      }

      breaker.recordSuccess();
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        const e = new ResilientFetchError("Fetch aborted (timeout)", null, attempt, breaker.getState());
        breaker.recordFailure();
        throw e;
      }

      if (isRetryable((error as ResilientFetchError | { status?: number | null })?.status ?? null, error as Error)) {
        breaker.recordFailure();
        if (attempt < maxRetries) {
          await exponentialBackoffWithJitter(attempt, 1000, 30_000, { maxRetries, jitter: true });
          continue;
        }
        throw error as Error;
      }

      throw error as Error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new ResilientFetchError("Max retries exceeded", null, maxRetries, breaker.getState());
}

export function enforcePayloadLimit(body: unknown, maxBytes = 10 * 1024 * 1024): void {
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    throw new Error(
      `Payload limit exceeded: ${(Buffer.byteLength(serialized, "utf8") / 1024 / 1024).toFixed(2)}MB > 10MB`
    );
  }
}

const payloadCache = createLRUCache<string, unknown>(500);

export function getPayloadCacheSize(): number {
  return payloadCache.size;
}

export function clearPayloadCache(): void {
  payloadCache.clear();
}
