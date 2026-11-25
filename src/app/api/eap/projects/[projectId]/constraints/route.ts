import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import {
  computeOrderDeadlineDate,
  CONSTRAINT_CATEGORIES,
  CONSTRAINT_PRIORITIES,
  CONSTRAINT_STATUSES,
  evaluateConstraintRisks,
  generateSuggestedConstraintsFromLob,
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

const createConstraintSchema = z.object({
  action: z.literal("CREATE").optional(),
  title: z.string().trim().min(2, "Título deve ter ao menos 2 caracteres.").max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.enum(CONSTRAINT_CATEGORIES).default("COMPRAS_SUPRIMENTOS"),
  status: z.enum(CONSTRAINT_STATUSES).default("IDENTIFICADA"),
  priority: z.enum(CONSTRAINT_PRIORITIES).default("MEDIA"),
  floorId: z.string().trim().min(1).max(40).nullable().optional(),
  floorName: z.string().trim().min(1).max(120).nullable().optional(),
  packageNumber: z.number().int().min(1).max(999).nullable().optional(),
  teamCode: z.string().trim().min(1).max(6).nullable().optional(),
  linkedEapItemId: z.string().uuid().nullable().optional(),
  neededByDate: isoDateSchema,
  leadTimeDays: z.number().int().min(0).max(365).default(7),
  estimatedCost: z.number().min(0).max(100_000_000).nullable().optional(),
  supplierName: z.string().trim().max(160).nullable().optional(),
  responsibleName: z.string().trim().max(120).nullable().optional(),
});

const generateLookaheadSchema = z.object({
  action: z.literal("GENERATE_LOOKAHEAD"),
  windowDays: z.number().int().min(7).max(90).optional(),
});

const postBodySchema = z.union([generateLookaheadSchema, createConstraintSchema]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const constraints = await prisma.eapConstraint.findMany({
      where: { eapProjectId: eap.id },
      orderBy: [{ neededByDate: "asc" }, { createdAt: "desc" }],
    });

    const riskEvaluation = evaluateConstraintRisks(constraints);

    return jsonNoStore({
      ok: true,
      constraints: constraints.map((c) => ({
        ...c,
        neededByDate: c.neededByDate.toISOString().slice(0, 10),
        orderDeadlineDate: c.orderDeadlineDate
          ? c.orderDeadlineDate.toISOString().slice(0, 10)
          : null,
        resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
        riskLevel: riskEvaluation.riskById[c.id] ?? "NO_PRAZO",
      })),
      lobBlockMap: riskEvaluation.lobBlockMap,
      metrics: riskEvaluation.metrics,
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao carregar restrições e suprimentos.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const body = await request.json();
    const parsed = postBodySchema.parse(body);

    if ("action" in parsed && parsed.action === "GENERATE_LOOKAHEAD") {
      const result = await generateSuggestedConstraintsFromLob(projectId, {
        windowDays: parsed.windowDays,
      });
      if (!result) {
        return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
      }
      return jsonNoStore({ ok: true, ...result });
    }

    const data = parsed as z.infer<typeof createConstraintSchema>;
    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    if (data.linkedEapItemId) {
      const linkedItem = await prisma.eapItem.findFirst({
        where: {
          id: data.linkedEapItemId,
          group: { stage: { eapProjectId: eap.id } },
        },
        select: { id: true },
      });
      if (!linkedItem) {
        return jsonNoStore(
          { ok: false, error: "Item da EAP vinculado não pertence a este projeto." },
          404
        );
      }
    }

    const neededByDate = new Date(`${data.neededByDate}T00:00:00.000Z`);
    const orderDeadlineDate = computeOrderDeadlineDate(neededByDate, data.leadTimeDays);

    const created = await prisma.eapConstraint.create({
      data: {
        eapProjectId: eap.id,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        status: data.status,
        priority: data.priority,
        floorId: data.floorId ?? null,
        floorName: data.floorName ?? null,
        packageNumber: data.packageNumber ?? null,
        teamCode: data.teamCode ? data.teamCode.toUpperCase() : null,
        linkedEapItemId: data.linkedEapItemId ?? null,
        neededByDate,
        leadTimeDays: data.leadTimeDays,
        orderDeadlineDate,
        estimatedCost: data.estimatedCost ?? null,
        supplierName: data.supplierName ?? null,
        responsibleName: data.responsibleName ?? null,
        resolvedAt: data.status === "LIBERADA" ? new Date() : null,
      },
    });

    return jsonNoStore(
      {
        ok: true,
        constraint: {
          ...created,
          neededByDate: created.neededByDate.toISOString().slice(0, 10),
          orderDeadlineDate: created.orderDeadlineDate
            ? created.orderDeadlineDate.toISOString().slice(0, 10)
            : null,
          resolvedAt: created.resolvedAt ? created.resolvedAt.toISOString() : null,
        },
      },
      201
    );
  } catch (err) {
    return handleEapRouteError(err, "Erro ao criar restrição.");
  }
}
