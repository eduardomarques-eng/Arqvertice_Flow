import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { hasPendingEvents } from "@/server/events/event-bus";

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

  const now = new Date();
  const results: Record<string, unknown> = { success: true, timestamp: now.toISOString() };

  try {
    const idempotencyDeleted = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    results.idempotencyDeleted = idempotencyDeleted.count;

    const dueDate = new Date(now);
    dueDate.setUTCDate(dueDate.getUTCDate() - 1);

    const installmentsOverdue = await prisma.projectInstallment.updateMany({
      where: {
        status: "PENDING",
        dueDate: { lte: dueDate },
      },
      data: {
        status: "OVERDUE",
        paidDate: null,
      },
    });
    results.installmentsOverdueUpdated = installmentsOverdue.count;

    const pendingEvents = await hasPendingEvents();
    results.pendingEvents = pendingEvents;

    const dlqCount = await prisma.deadLetterEvent.count({
      where: {
        retryCount: { lt: 3 },
      },
    });
    results.dlqActive = dlqCount > 0;
    results.dlqCount = dlqCount;

    await prisma.$queryRaw`SELECT 1`;
    results.dbConnections = 1;

    const oldEventsDeleted = await prisma.domainEvent.deleteMany({
      where: {
        status: "COMPLETED",
        occurredAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    results.oldEventsDeleted = oldEventsDeleted.count;

    return NextResponse.json({
      ...results,
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao executar rotina de housekeeping", details: (error as Error).message },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
