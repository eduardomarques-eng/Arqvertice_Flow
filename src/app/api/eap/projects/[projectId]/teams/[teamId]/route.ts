import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import {
  computeTeamCostSummary,
  computeWorkerHourlyRate,
  syncTeamLaborRatesToEap,
} from "@/server/eap/teams-and-packages";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const workerInputSchema = z.object({
  id: z.string().uuid().optional(),
  roleName: z.string().trim().min(1).max(120),
  headcount: z.number().int().min(1).max(100).default(1),
  dailyRate: z.number().min(0).max(50000),
  hourlyRate: z.number().min(0).max(10000).optional(),
  socialChargesPct: z.number().min(0).max(300).default(0),
  maxDailyOutput: z.number().positive().max(100000).nullable().optional(),
});

const patchTeamSchema = z.object({
  teamCode: z.string().trim().min(1).max(6).optional(),
  name: z.string().trim().min(2).max(160).optional(),
  specialty: z.string().trim().min(2).max(160).optional(),
  maxDailyHours: z.number().positive().max(24).optional(),
  maxSimultaneousFronts: z.number().int().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  workers: z.array(workerInputSchema).max(50).optional(),
});

const syncLaborSchema = z.object({
  stageCodes: z.array(z.string().trim().min(1).max(10)).min(1).max(30),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; teamId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const teamId = uuidParamSchema.parse(rawParams.teamId);
    const body = await request.json();
    const parsed = patchTeamSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const existing = await prisma.eapWorkTeam.findFirst({
      where: { id: teamId, eapProjectId: eap.id },
      select: { id: true, maxDailyHours: true },
    });
    if (!existing) {
      return jsonNoStore({ ok: false, error: "Equipe não encontrada." }, 404);
    }

    const effectiveHours = parsed.maxDailyHours ?? existing.maxDailyHours;

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.workers !== undefined) {
        await tx.eapTeamWorker.deleteMany({ where: { teamId: existing.id } });
        if (parsed.workers.length > 0) {
          await tx.eapTeamWorker.createMany({
            data: parsed.workers.map((w) => ({
              teamId: existing.id,
              roleName: w.roleName,
              headcount: w.headcount,
              dailyRate: w.dailyRate,
              hourlyRate: computeWorkerHourlyRate(w.dailyRate, effectiveHours, w.hourlyRate),
              socialChargesPct: w.socialChargesPct,
              maxDailyOutput: w.maxDailyOutput ?? null,
            })),
          });
        }
      }

      return tx.eapWorkTeam.update({
        where: { id: existing.id },
        data: {
          ...(parsed.teamCode !== undefined ? { teamCode: parsed.teamCode.toUpperCase() } : {}),
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.specialty !== undefined ? { specialty: parsed.specialty } : {}),
          ...(parsed.maxDailyHours !== undefined ? { maxDailyHours: parsed.maxDailyHours } : {}),
          ...(parsed.maxSimultaneousFronts !== undefined
            ? { maxSimultaneousFronts: parsed.maxSimultaneousFronts }
            : {}),
          ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        },
        include: {
          workers: { orderBy: { createdAt: "asc" } },
        },
      });
    });

    return jsonNoStore({
      ok: true,
      team: {
        ...updated,
        summary: computeTeamCostSummary(updated),
      },
    });
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao atualizar equipe.",
      "Código de equipe já utilizado neste projeto."
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; teamId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const teamId = uuidParamSchema.parse(rawParams.teamId);
    const body = await request.json();
    const parsed = syncLaborSchema.parse(body);

    const result = await syncTeamLaborRatesToEap({
      projectId,
      teamId,
      stageCodes: parsed.stageCodes,
    });
    if (!result) {
      return jsonNoStore({ ok: false, error: "Equipe ou projeto EAP não encontrado." }, 404);
    }

    return jsonNoStore({ ok: true, ...result });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao sincronizar mão de obra com a EAP.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; teamId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const teamId = uuidParamSchema.parse(rawParams.teamId);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const existing = await prisma.eapWorkTeam.findFirst({
      where: { id: teamId, eapProjectId: eap.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonNoStore({ ok: false, error: "Equipe não encontrada." }, 404);
    }

    await prisma.eapWorkTeam.delete({ where: { id: existing.id } });

    return jsonNoStore({ ok: true, deletedId: existing.id });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao remover equipe.");
  }
}
