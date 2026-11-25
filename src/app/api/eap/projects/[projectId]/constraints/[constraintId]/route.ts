import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import {
  computeOrderDeadlineDate,
  CONSTRAINT_CATEGORIES,
  CONSTRAINT_PRIORITIES,
  CONSTRAINT_STATUSES,
} from "@/server/eap/constraints-lookahead";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD.")
  .refine((val) => {
    const dt = new Date(`${val}T00:00:00.000Z`);
    return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === val;
  }, "Data de calendário inválida.");

const patchConstraintSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.enum(CONSTRAINT_CATEGORIES).optional(),
  status: z.enum(CONSTRAINT_STATUSES).optional(),
  priority: z.enum(CONSTRAINT_PRIORITIES).optional(),
  floorId: z.string().trim().min(1).max(40).nullable().optional(),
  floorName: z.string().trim().min(1).max(120).nullable().optional(),
  packageNumber: z.number().int().min(1).max(999).nullable().optional(),
  teamCode: z.string().trim().min(1).max(6).nullable().optional(),
  neededByDate: isoDateSchema.optional(),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  estimatedCost: z.number().min(0).max(100_000_000).nullable().optional(),
  supplierName: z.string().trim().max(160).nullable().optional(),
  responsibleName: z.string().trim().max(120).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; constraintId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const constraintId = uuidParamSchema.parse(rawParams.constraintId);
    const body = await request.json();
    const parsed = patchConstraintSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const existing = await prisma.eapConstraint.findFirst({
      where: { id: constraintId, eapProjectId: eap.id },
      select: {
        id: true,
        neededByDate: true,
        leadTimeDays: true,
        status: true,
      },
    });
    if (!existing) {
      return jsonNoStore({ ok: false, error: "Restrição não encontrada." }, 404);
    }

    const nextNeededByDate = parsed.neededByDate
      ? new Date(`${parsed.neededByDate}T00:00:00.000Z`)
      : existing.neededByDate;
    const nextLeadTimeDays = parsed.leadTimeDays ?? existing.leadTimeDays;
    const nextOrderDeadlineDate = computeOrderDeadlineDate(nextNeededByDate, nextLeadTimeDays);

    let resolvedAtUpdate: { resolvedAt?: Date | null } = {};
    if (parsed.status !== undefined && parsed.status !== existing.status) {
      resolvedAtUpdate = {
        resolvedAt: parsed.status === "LIBERADA" ? new Date() : null,
      };
    }

    const updated = await prisma.eapConstraint.update({
      where: { id: existing.id },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.priority !== undefined ? { priority: parsed.priority } : {}),
        ...(parsed.floorId !== undefined ? { floorId: parsed.floorId } : {}),
        ...(parsed.floorName !== undefined ? { floorName: parsed.floorName } : {}),
        ...(parsed.packageNumber !== undefined ? { packageNumber: parsed.packageNumber } : {}),
        ...(parsed.teamCode !== undefined
          ? { teamCode: parsed.teamCode ? parsed.teamCode.toUpperCase() : null }
          : {}),
        ...(parsed.neededByDate !== undefined ? { neededByDate: nextNeededByDate } : {}),
        ...(parsed.leadTimeDays !== undefined ? { leadTimeDays: nextLeadTimeDays } : {}),
        ...(parsed.neededByDate !== undefined || parsed.leadTimeDays !== undefined
          ? { orderDeadlineDate: nextOrderDeadlineDate }
          : {}),
        ...(parsed.estimatedCost !== undefined ? { estimatedCost: parsed.estimatedCost } : {}),
        ...(parsed.supplierName !== undefined ? { supplierName: parsed.supplierName } : {}),
        ...(parsed.responsibleName !== undefined ? { responsibleName: parsed.responsibleName } : {}),
        ...resolvedAtUpdate,
      },
    });

    return jsonNoStore({
      ok: true,
      constraint: {
        ...updated,
        neededByDate: updated.neededByDate.toISOString().slice(0, 10),
        orderDeadlineDate: updated.orderDeadlineDate
          ? updated.orderDeadlineDate.toISOString().slice(0, 10)
          : null,
        resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
      },
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao atualizar restrição.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; constraintId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const constraintId = uuidParamSchema.parse(rawParams.constraintId);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const existing = await prisma.eapConstraint.findFirst({
      where: { id: constraintId, eapProjectId: eap.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonNoStore({ ok: false, error: "Restrição não encontrada." }, 404);
    }

    await prisma.eapConstraint.delete({ where: { id: existing.id } });

    return jsonNoStore({ ok: true, deletedId: existing.id });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao remover restrição.");
  }
}
