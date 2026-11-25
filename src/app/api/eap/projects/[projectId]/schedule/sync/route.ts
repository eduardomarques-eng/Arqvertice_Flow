import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
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

const syncSegmentSchema = z
  .object({
    zoneCode: z.enum(["FUND_TERREO", "PAV_SUPERIOR", "COBERTURA", "EXTERNO"]),
    segmentOrder: z.number().int().min(1).max(1000).default(1),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    workingDays: z.number().int().min(1).max(365),
    parallelLane: z.number().int().min(1).max(20).default(1),
    progressPercent: z.number().min(0).max(100).optional(),
    notes: z.string().max(300).nullable().optional(),
  })
  .refine((seg) => seg.endDate >= seg.startDate, {
    message: "Data final do trecho não pode ser anterior à data inicial.",
  });

const legacySyncSchema = z.object({
  mode: z.literal("LEGACY").optional(),
  updates: z
    .array(
      z.object({
        packageId: z.string().uuid(),
        durationWorkingDays: z.number().int().min(0).max(1000).optional(),
        teamsCount: z.number().int().min(1).max(20).optional(),
        segments: z.array(syncSegmentSchema).max(500),
      })
    )
    .min(1)
    .max(60),
});

const floorDefinitionSchema = z.object({
  floorId: z.string().trim().min(1).max(40),
  floorName: z.string().trim().min(1).max(120),
  floorOrder: z.number().int().min(0).max(200),
});

const floorAllocationSchema = z.object({
  floorId: z.string().trim().min(1).max(40),
  floorName: z.string().trim().min(1).max(120),
  floorOrder: z.number().int().min(0).max(200),
  dateIso: isoDateSchema,
  teamCode: z.string().trim().min(1).max(6),
  packageNumber: z.number().int().min(1).max(999),
  isOvertime: z.boolean().default(false),
  dataOrigin: z
    .enum(["PRELIMINAR_PADRAO", "QUANTITATIVO_IMPORTADO", "EDITADO_USUARIO"])
    .optional(),
});

const floorMatrixSyncSchema = z.object({
  mode: z.literal("FLOOR_MATRIX"),
  plannedStartDate: isoDateSchema.optional(),
  floors: z.array(floorDefinitionSchema).min(1).max(50).optional(),
  allocations: z.array(floorAllocationSchema).max(5000),
});

const syncPayloadSchema = z.union([floorMatrixSyncSchema, legacySyncSchema]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const body = await request.json();
    const parsed = syncPayloadSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: {
        id: true,
        schedulePackages: { select: { id: true } },
      },
    });

    if (!eap) {
      return jsonNoStore({ ok: false, error: "EAP não encontrada para este projeto." }, 404);
    }

    if ("allocations" in parsed) {
      const dedupedMap = new Map<string, z.infer<typeof floorAllocationSchema>>();
      for (const item of parsed.allocations) {
        const normalizedTeam = item.teamCode.toUpperCase();
        const key = `${item.floorId}::${item.dateIso}::${normalizedTeam}::${item.packageNumber}`;
        dedupedMap.set(key, {
          ...item,
          teamCode: normalizedTeam,
        });
      }
      const uniqueAllocations = Array.from(dedupedMap.values());

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "EapProject" WHERE "id" = ${eap.id}::uuid FOR UPDATE`;

        if (parsed.plannedStartDate || parsed.floors) {
          await tx.eapProject.update({
            where: { id: eap.id },
            data: {
              ...(parsed.plannedStartDate
                ? { plannedStartDate: new Date(`${parsed.plannedStartDate}T00:00:00.000Z`) }
                : {}),
              ...(parsed.floors ? { lobFloorsJson: parsed.floors } : {}),
            },
          });
        }

        await tx.eapLobFloorAllocation.deleteMany({
          where: { eapProjectId: eap.id },
        });

        if (uniqueAllocations.length > 0) {
          await tx.eapLobFloorAllocation.createMany({
            data: uniqueAllocations.map((a) => ({
              eapProjectId: eap.id,
              floorId: a.floorId,
              floorName: a.floorName,
              floorOrder: a.floorOrder,
              dateIso: a.dateIso,
              teamCode: a.teamCode,
              packageNumber: a.packageNumber,
              isOvertime: a.isOvertime,
              dataOrigin: a.dataOrigin ?? "EDITADO_USUARIO",
            })),
            skipDuplicates: true,
          });
        }
      });

      return jsonNoStore({
        ok: true,
        mode: "FLOOR_MATRIX",
        savedAllocationsCount: uniqueAllocations.length,
      });
    }

    const validPackageIds = new Set(eap.schedulePackages.map((p) => p.id));
    for (const upd of parsed.updates) {
      if (!validPackageIds.has(upd.packageId)) {
        return jsonNoStore(
          { ok: false, error: `Pacote ${upd.packageId} não pertence a este projeto.` },
          404
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const upd of parsed.updates) {
        const computedWorkingDays = upd.segments.reduce((acc, s) => acc + s.workingDays, 0);
        const nextDuration =
          upd.durationWorkingDays !== undefined
            ? Math.max(1, upd.durationWorkingDays || computedWorkingDays || 1)
            : Math.max(1, computedWorkingDays || 1);

        await tx.schedulePackage.update({
          where: { id: upd.packageId },
          data: {
            durationWorkingDays: nextDuration,
            ...(upd.teamsCount !== undefined ? { teamsCount: upd.teamsCount } : {}),
          },
        });

        await tx.scheduleSegment.deleteMany({
          where: { packageId: upd.packageId },
        });

        if (upd.segments.length > 0) {
          await tx.scheduleSegment.createMany({
            data: upd.segments.map((seg, idx) => ({
              packageId: upd.packageId,
              zoneCode: seg.zoneCode,
              segmentOrder: seg.segmentOrder || idx + 1,
              startDate: new Date(`${seg.startDate}T00:00:00.000Z`),
              endDate: new Date(`${seg.endDate}T00:00:00.000Z`),
              workingDays: seg.workingDays,
              parallelLane: seg.parallelLane || 1,
              progressPercent: seg.progressPercent ?? 0,
              notes: seg.notes ?? null,
            })),
          });
        }
      }
    });

    return jsonNoStore({ ok: true, updatedPackagesCount: parsed.updates.length });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao sincronizar cronograma.");
  }
}
