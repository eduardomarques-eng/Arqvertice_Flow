import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  listPendingEvents,
  markEventProcessed,
  markEventFailed,
  hasPendingEvents,
  eventBus,
} from "@/server/events/event-bus";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

function requireCronAuth(request: Request): boolean {
  if (!CRON_SECRET || CRON_SECRET.length < 16) return false;
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const isAuthenticated = requireCronAuth(request);
  if (!isAuthenticated) {
    return NextResponse.json(
      { error: "Não autorizado. Credenciais de CRON inválidas." },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const events = await listPendingEvents(200);

    for (const event of events) {
      try {
        await eventBus.publish({
          event: {
            id: event.id,
            type: event.type as any,
            payload: event.payload,
            metadata: (event.metadata as Record<string, unknown>) ?? undefined,
            retryCount: event.retryCount,
            status: event.status as any,
            occurredAt: event.occurredAt,
            entityType: event.entityType ?? undefined,
            entityId: event.entityId ?? undefined,
            route: event.route ?? undefined,
            requestId: event.requestId ?? undefined,
          },
          context: {
            requestId: event.requestId ?? undefined,
          },
        });
        await markEventProcessed(event.id, { status: "processed" });
      } catch (error) {
        await markEventFailed(
          event.id,
          error as Error,
          event.retryCount ?? 0,
          3
        );
      }
    }

    return NextResponse.json({
      processed: events.length,
      queueRemaining: await hasPendingEvents(),
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao processar eventos", details: (error as Error).message },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
