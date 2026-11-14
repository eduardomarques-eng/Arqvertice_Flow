import { prisma } from "@/server/db";
import { z } from "zod";

export const DomainEventTypeSchema = z.enum([
  "PROJECT_APPROVED",
  "PROJECT_CREATED",
  "STAGE_COMPLETED",
  "PAYMENT_RECEIVED",
  "INSTALLMENT_DUE",
  "NOTIFICATION_SENT",
  "EMAIL_DELIVERED",
  "CRONOMETER_TICK",
  "SYSTEM_CHECK",
  "DEFAULT",
]);

export type DomainEventType = z.infer<typeof DomainEventTypeSchema>;

export const DomainEventStatusSchema = z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);
export type DomainEventStatus = z.infer<typeof DomainEventStatusSchema>;

export const DomainEventSchema = z.object({
  id: z.string(),
  type: DomainEventTypeSchema,
  payload: z.any(),
  metadata: z.record(z.any()).optional(),
  retryCount: z.number().int().min(0).default(0),
  status: DomainEventStatusSchema,
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  occurredAt: z.date().default(() => new Date()),
  processedAt: z.date().optional(),
  error: z.string().max(1000).optional(),
  deadline: z.date().optional(),
  route: z.string().optional(),
  requestId: z.string().optional(),
});

export type DomainEvent = z.infer<typeof DomainEventSchema>;

export type EventSubscriber<T = unknown> = (payload: T, context: EventContext) => Promise<void>;

export interface EventContext {
  requestId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/** Container para evento + contexto de emissão. */
export class DomainEventEnvelope {
  constructor(public event: DomainEvent, public context: EventContext) {}
}

/**
 * Transactional Outbox / Event Queue
 *
 * Fluxo de justiça:
 *  1. O serviço grava um DomainEvent com status PENDING (dentro da mesma transação que o domínio).
 *  2. /api/cron/process-events faz pop de eventos PENDING e chama os handlers.
 *  3. Em caso de falha, o retry incrementa retryCount ate 3; depois o evento e copiado para DeadLetterEvent
 *     e deixado para reprocessamento manual.
 */
export async function enqueueDomainEvent(data: {
  type: DomainEventType;
  payload: unknown;
  metadata?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  route?: string;
  requestId?: string;
}) {
  const { type, payload, metadata = {}, entityType, entityId, route, requestId } = data;

  return prisma.domainEvent.create({
    data: {
      type,
      payload,
      metadata,
      status: "PENDING",
      entityType,
      entityId,
      route,
      requestId,
      occurredAt: new Date(),
    },
  });
}

/** Marca evento como processado com sucesso */
export async function markEventProcessed(id: string, result?: unknown) {
  await prisma.domainEvent.update({
    where: { id },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      metadata: result ? { ...result, updatedAt: new Date() } : undefined,
    },
  });
}

/** Marca evento como com falha, incrementando retryCount e movendo para DLQ se exceder o limite */
export async function markEventFailed(id: string, error: Error, retryCount: number, maxRetries: number = 3) {
  const isExhausted = retryCount >= maxRetries;

  const updateData: {
    status: DomainEventStatus;
    processedAt: Date;
    error: string;
    retryCount: number;
  } = {
    status: "FAILED",
    processedAt: new Date(),
    error: error.message,
    retryCount: retryCount + 1,
  };

  if (isExhausted) {
    await prisma.deadLetterEvent.create({
      data: {
        domainEventId: id,
        originalPayload: await prisma.domainEvent.findUnique({ where: { id }, select: { payload: true } })?.payload,
        originalMetadata: await prisma.domainEvent.findUnique({ where: { id }, select: { metadata: true } })?.metadata,
        error: error.message,
        stackTrace: error.stack ?? undefined,
        failedAt: new Date(),
        retryCount,
        endpoint: await prisma.domainEvent.findUnique({ where: { id }, select: { route: true } })?.route,
        entityType: await prisma.domainEvent.findUnique({ where: { id }, select: { entityType: true } })?.entityType,
        entityId: await prisma.domainEvent.findUnique({ where: { id }, select: { entityId: true } })?.entityId,
        requestId: await prisma.domainEvent.findUnique({ where: { id }, select: { requestId: true } })?.requestId,
      },
    });

    // Remove o evento original da fila (ja esta no DLQ)
    updateData.status = "COMPLETED";
  }

  await prisma.domainEvent.update({
    where: { id },
    data: updateData,
  });
}

/** Typed Pub / Sub container para eventos de dominio. */
export class EventBus {
  private subscribers = new Map<string, Set<EventSubscriber<unknown>>>();

  /** Assina um evento por tipo. */
  on<T = unknown>(type: string, subscriber: EventSubscriber<T>): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(subscriber as EventSubscriber<unknown>);

    return () => {
      this.subscribers.get(type)?.delete(subscriber as EventSubscriber<unknown>);
    };
  }

  /**
   * Publica um evento para todos os subscribers registrados.
   * Implementa o padrao Saga: os handlers sao executados sequentialmente.
   * Se um handler falhar, a execucao para e o erro e registrado (compensacao manual).
   */
  async publish(envelope: DomainEventEnvelope): Promise<void> {
    const { event, context } = envelope;
    const handlers = this.subscribers.get(event.type);

    if (!handlers || handlers.size === 0) {
      console.debug(`[EventBus] Nenhum subscriber para o evento ${event.type}`);
      return;
    }

    console.debug(`[EventBus] Publicando evento ${event.type} (retryCount=${event.retryCount})`);

    for (const handler of handlers) {
      try {
        await handler(event.payload, context);
      } catch (error) {
        console.error(`[EventBus] Handler falhou para ${event.type}: ${(error as Error).message}`);
        throw new Error(`Handler falhou para ${event.type}: ${(error as Error).message}`);
      }
    }
  }
}

/** Instancia global do barramento de eventos. */
export const eventBus = new EventBus();

/** Registra handlers globais para os controladores de cron. */
export const eventHandlers = new Map<string, EventSubscriber<unknown>[]>();

/** Retorna todos os eventos PENDING (limite opcional) */
export async function listPendingEvents(limit = 100): Promise<DomainEvent[]> {
  return prisma.domainEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { occurredAt: "asc" },
    take: limit,
    select: {
      id: true,
      type: true,
      payload: true,
      metadata: true,
      retryCount: true,
      status: true,
      entityType: true,
      entityId: true,
      occurredAt: true,
      processedAt: true,
      error: true,
      deadline: true,
      route: true,
      requestId: true,
    },
  });
}

/** Marca eventos como PROCESSING (lock por janelas de tempo) */
export async function lockPendingEvents(ids: string[]) {
  if (ids.length === 0) return;

  await prisma.domainEvent.updateMany({
    where: {
      id: { in: ids },
      status: "PENDING",
    },
    data: { status: "PROCESSING" },
  });
}

/** Verifica se ha eventos pendentes */
export async function hasPendingEvents(): Promise<boolean> {
  const count = await prisma.domainEvent.count({ where: { status: "PENDING" } });
  return count > 0;
}

/** Reprocessa eventos do DLQ com retries disponiveis */
export async function reprocessDeadLetterEvents(limit = 50): Promise<number> {
  const dlq = await prisma.deadLetterEvent.findMany({
    where: { retryCount: { lt: 3 } },
    orderBy: { failedAt: "asc" },
    take: limit,
    select: {
      id: true,
      domainEventId: true,
      originalPayload: true,
      originalMetadata: true,
      error: true,
      stackTrace: true,
      failedAt: true,
      retryCount: true,
      endpoint: true,
      entityType: true,
      entityId: true,
      requestId: true,
    },
  });

  for (const item of dlq) {
    await prisma.domainEvent.update({
      where: { id: item.domainEventId },
      data: {
        type: item.endpoint ?? item.domainEventId ?? "UNKNOWN",
        payload: item.originalPayload,
        metadata: item.originalMetadata,
        status: "PENDING",
        retryCount: 0,
        error: null,
        processedAt: null,
      },
    });
  }

  return dlq.length;
}

/** Executa housekeeping de eventos (limpeza de registros antigos) */
export async function housekeepingCleaner(domainEventLimit = 10_000, deadLetterLimit = 5_000) {
  await prisma.domainEvent.deleteMany({
    where: {
      status: "COMPLETED",
      occurredAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  await prisma.deadLetterEvent.deleteMany({
    where: {
      failedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });
}
