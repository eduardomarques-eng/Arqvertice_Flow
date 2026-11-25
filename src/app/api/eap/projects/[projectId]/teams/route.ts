import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import {
  computeTeamCostSummary,
  computeWorkerHourlyRate,
  ensureDefaultTeamsAndPackages,
  getNextTeamCode,
} from "@/server/eap/teams-and-packages";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const workerInputSchema = z.object({
  roleName: z.string().trim().min(1).max(120),
  headcount: z.number().int().min(1).max(100).default(1),
  dailyRate: z.number().min(0).max(50000),
  hourlyRate: z.number().min(0).max(10000).optional(),
  socialChargesPct: z.number().min(0).max(300).default(0),
  maxDailyOutput: z.number().positive().max(100000).nullable().optional(),
});

const createTeamSchema = z.object({
  teamCode: z.string().trim().min(1).max(6).optional(),
  name: z.string().trim().min(2).max(160),
  specialty: z.string().trim().min(2).max(160).default("Execução Geral"),
  maxDailyHours: z.number().positive().max(24).default(8),
  maxSimultaneousFronts: z.number().int().min(1).max(20).default(1),
  isActive: z.boolean().default(true),
  workers: z.array(workerInputSchema).max(50).default([]),
});

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

    await ensureDefaultTeamsAndPackages(eap.id);

    const teams = await prisma.eapWorkTeam.findMany({
      where: { eapProjectId: eap.id },
      include: {
        workers: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { teamCode: "asc" },
    });

    const teamsWithSummary = teams.map((team) => ({
      ...team,
      summary: computeTeamCostSummary(team),
    }));

    return jsonNoStore({ ok: true, teams: teamsWithSummary });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao listar equipes.");
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
    const parsed = createTeamSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    let teamCode = parsed.teamCode?.toUpperCase();
    if (!teamCode) {
      const existingTeams = await prisma.eapWorkTeam.findMany({
        where: { eapProjectId: eap.id },
        select: { teamCode: true },
      });
      teamCode = getNextTeamCode(existingTeams.map((t) => t.teamCode));
    }

    const created = await prisma.eapWorkTeam.create({
      data: {
        eapProjectId: eap.id,
        teamCode,
        name: parsed.name,
        specialty: parsed.specialty,
        maxDailyHours: parsed.maxDailyHours,
        maxSimultaneousFronts: parsed.maxSimultaneousFronts,
        isActive: parsed.isActive,
        workers: {
          create: parsed.workers.map((w) => ({
            roleName: w.roleName,
            headcount: w.headcount,
            dailyRate: w.dailyRate,
            hourlyRate: computeWorkerHourlyRate(w.dailyRate, parsed.maxDailyHours, w.hourlyRate),
            socialChargesPct: w.socialChargesPct,
            maxDailyOutput: w.maxDailyOutput ?? null,
          })),
        },
      },
      include: {
        workers: { orderBy: { createdAt: "asc" } },
      },
    });

    return jsonNoStore(
      {
        ok: true,
        team: {
          ...created,
          summary: computeTeamCostSummary(created),
        },
      },
      201
    );
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao criar equipe.",
      "Já existe uma equipe com este código neste projeto."
    );
  }
}
