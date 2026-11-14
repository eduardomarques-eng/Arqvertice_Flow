import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;

function requireCronAuth(request: Request): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === CRON_SECRET;
}

/**
 * Rotina de CRON: housekeeping de base de dados.
 *
 * Atua sobre:
 *  - Limpa registros de idempotência expirados (> 24h)
 *  - Executa verificação de parcelas vencidas (retornando para OVERDUE)
 *  - Executa verificação de integridade (eventos pendentes, DLQ, conexões)
 *
 * Protegida por CRON_SECRET via Authorization.
 */
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
    // 1. Limpa registros de idempotência expirados (> 24h)
    const idempotencyDeleted = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    results.idempotencyDeleted = idempotencyDeleted.count;

    // 2. Verifica parcelas vencidas (status PENDING e vencidas -> OVERDUE)
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

    // 3. Executa verificação de integridade: eventos pendentes
    const pendingEvents = await hasPendingEvents();
    results.pendingEvents = pendingEvents;

    // 4. Verifica DLQ ativo
    const dlqCount = await prisma.deadLetterEvent.count({
      where: {
        retryCount: { lt: 3 },
      },
    });
    results.dlqActive = dlqCount > 0;
    results.dlqCount = dlqCount;

    // 5. Verifica conexões ativas com o banco
    const connections = await prisma.$connect();
    results.dbConnections = connections ? 1 : 0;
    await prisma.$disconnect();

    // 6. Limpa eventos de domínio COMPLETED antigos (> 30 dias)
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
    results.success = false;
    results.error = (error as Error).message;
    return NextResponse.json(
      { ...results, error: "Falha no housekeeping" },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
