import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

function requireCronAuth(request: Request): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === CRON_SECRET;
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
      const type = event.type as string;
      const handler = eventHandlers.get(type);

      if (!handler) {
        console.warn(`[CRON] EventHandler não encontrado para tipo: ${type}`);
        await markEventProcessed(event.id as string, { reason: "no_handler" });
        continue;
      }

      try {
        await handler(event.payload, {
          ...(event.metadata as Record<string, unknown>),
          requestId: event.requestId,
        });
        await markEventProcessed(event.id as string, { status: "processed" });
      } catch (error) {
        const retryCount = event.retryCount as number | undefined ?? 0;
        await markEventFailed(
          event.id as string,
          error as Error,
          retryCount,
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
