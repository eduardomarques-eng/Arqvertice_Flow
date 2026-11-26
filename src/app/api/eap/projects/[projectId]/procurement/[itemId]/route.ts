import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import {
  getProcurementPlanForProject,
  subtractWorkingDays,
  syncProcurementToFinance,
} from "@/server/eap/procurement-plan";
import { handleEapRouteError } from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z.object({
  status: z.enum(["A_COTAR", "EM_COTACAO", "PEDIDO_EMITIDO", "ENTREGUE"]).optional(),
  supplierName: z.string().max(200).nullable().optional(),
  closedAmount: z.number().min(0).nullable().optional(),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(500).nullable().optional(),
  syncToFinance: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId, itemId } = await context.params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const existing = await prisma.eapProcurementItem.findUnique({
      where: { id: itemId },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Item de aquisição não encontrado." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const nextLead = parsed.leadTimeDays ?? existing.leadTimeDays;
    const nextOrderDeadline =
      parsed.leadTimeDays !== undefined
        ? subtractWorkingDays(existing.needDate, nextLead)
        : existing.orderDeadlineDate;

    await prisma.eapProcurementItem.update({
      where: { id: itemId },
      data: {
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.supplierName !== undefined
          ? { supplierName: parsed.supplierName?.trim() || null }
          : {}),
        ...(parsed.closedAmount !== undefined ? { closedAmount: parsed.closedAmount } : {}),
        ...(parsed.leadTimeDays !== undefined
          ? { leadTimeDays: nextLead, orderDeadlineDate: nextOrderDeadline }
          : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes?.trim() || null } : {}),
      },
    });

    if (
      parsed.syncToFinance ||
      parsed.status === "PEDIDO_EMITIDO" ||
      parsed.status === "ENTREGUE"
    ) {
      const synced = await syncProcurementToFinance(projectId, itemId);
      return NextResponse.json(
        { ok: true, syncedCount: synced.syncedCount, ...synced.plan },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const plan = await getProcurementPlanForProject(projectId);
    return NextResponse.json(
      { ok: true, ...plan },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleEapRouteError(err, "Erro ao atualizar item de aquisição.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; itemId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId, itemId } = await context.params;
    await prisma.eapProcurementItem.delete({ where: { id: itemId } });
    const plan = await getProcurementPlanForProject(projectId);
    return NextResponse.json(
      { ok: true, ...plan },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleEapRouteError(err, "Erro ao remover item de aquisição.");
  }
}
