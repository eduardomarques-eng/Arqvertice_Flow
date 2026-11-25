import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import {
  buildFieldMeasurementSnapshot,
  BULLETIN_STATUSES,
  ENTRY_STATUSES,
  saveFieldMeasurementBulletin,
  WEATHER_CONDITIONS,
} from "@/server/eap/field-measurement";
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

const entryInputSchema = z.object({
  floorId: z.string().trim().min(1).max(40),
  floorName: z.string().trim().min(1).max(120),
  packageNumber: z.number().int().min(1).max(999).nullable().optional(),
  teamCode: z.string().trim().min(1).max(6).nullable().optional(),
  eapItemId: z.string().uuid().nullable().optional(),
  serviceLabel: z.string().trim().min(1).max(260),
  unit: z.string().trim().min(1).max(20),
  plannedQty: z.number().min(0).max(1_000_000),
  previousExecutedQty: z.number().min(0).max(1_000_000).default(0),
  currentExecutedQty: z.number().min(0).max(1_000_000).default(0),
  unitPrice: z.number().min(0).max(100_000_000).default(0),
  status: z.enum(ENTRY_STATUSES).optional(),
  fieldNote: z.string().trim().max(500).nullable().optional(),
});

const saveBulletinSchema = z.object({
  bulletinId: z.string().uuid().optional(),
  referenceDate: isoDateSchema,
  status: z.enum(BULLETIN_STATUSES).default("RASCUNHO"),
  inspectorName: z.string().trim().max(120).nullable().optional(),
  weatherCondition: z.enum(WEATHER_CONDITIONS).nullable().optional(),
  generalNotes: z.string().trim().max(2000).nullable().optional(),
  entries: z.array(entryInputSchema).min(1).max(1000),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);

    const refParam = request.nextUrl.searchParams.get("referenceDate");
    const safeRefDate = refParam ? isoDateSchema.parse(refParam) : undefined;

    const snapshot = await buildFieldMeasurementSnapshot(projectId, safeRefDate);
    if (!snapshot) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    return jsonNoStore({ ok: true, ...snapshot });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao carregar medições de canteiro.");
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
    const parsed = saveBulletinSchema.parse(body);

    const saved = await saveFieldMeasurementBulletin({
      projectId,
      bulletinId: parsed.bulletinId,
      referenceDate: parsed.referenceDate,
      status: parsed.status,
      inspectorName: parsed.inspectorName ?? null,
      weatherCondition: parsed.weatherCondition ?? null,
      generalNotes: parsed.generalNotes ?? null,
      entries: parsed.entries,
    });

    if (!saved) {
      return jsonNoStore(
        { ok: false, error: "Projeto EAP, boletim ou item vinculado não encontrado." },
        404
      );
    }

    return jsonNoStore({ ok: true, bulletin: saved }, parsed.bulletinId ? 200 : 201);
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao salvar boletim de medição.",
      "Conflito na numeração sequencial do boletim."
    );
  }
}
