import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { DomainError } from "@/server/errors";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";
import {
  createSiteDiaryEntry,
  deleteSiteDiaryEntry,
  listSiteDiaryEntries,
  summarizeSiteDiaryPeriod,
} from "@/server/eap/site-diary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createDiarySchema = z.object({
  bulletinId: z.string().uuid().nullable().optional(),
  entryDate: z.string().min(8).max(20),
  weatherMorning: z.enum(["SOL", "NUBLADO", "CHUVA", "IMPRATICAVEL"]).default("SOL"),
  weatherAfternoon: z.enum(["SOL", "NUBLADO", "CHUVA", "IMPRATICAVEL"]).default("SOL"),
  siteCondition: z.enum(["OPERAVEL", "PARCIAL", "PARALISADO"]).default("OPERAVEL"),
  workforceSummary: z
    .object({
      teamA: z.number().min(0).default(0),
      teamB: z.number().min(0).default(0),
      teamC: z.number().min(0).default(0),
      thirdParty: z.number().min(0).default(0),
      notes: z.string().max(300).optional(),
    })
    .default({ teamA: 0, teamB: 0, teamC: 0, thirdParty: 0 }),
  activitiesExecuted: z.string().min(2).max(2000),
  occurrencesAndNotes: z.string().max(2000).optional(),
  mediaItems: z
    .array(
      z.object({
        id: z.string(),
        mediaType: z.enum(["IMAGE", "VIDEO"]),
        fileName: z.string(),
        dataBase64: z.string().optional(),
        caption: z.string().optional(),
        timeLabel: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await currentUser();
    if (!caller) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    await requireProjectAccess(projectId);

    const entries = await listSiteDiaryEntries(projectId);
    const summary = summarizeSiteDiaryPeriod(entries);
    return jsonNoStore({ ok: true, entries, summary });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao carregar Diário de Obra.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await currentUser();
    if (!caller) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const user = await requireProjectAccess(projectId);
    if (isClientRole(user.role)) {
      throw new DomainError("Lançamento no Diário de Obra restrito à equipe técnica.", "INTEGRITY");
    }

    const body = createDiarySchema.parse(await request.json());
    const entry = await createSiteDiaryEntry(projectId, body);
    return jsonNoStore({ ok: true, entry }, 201);
  } catch (err) {
    return handleEapRouteError(err, "Erro ao salvar registro no Diário de Obra.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await currentUser();
    if (!caller) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const user = await requireProjectAccess(projectId);
    if (isClientRole(user.role)) {
      throw new DomainError("Exclusão no Diário de Obra restrita à equipe técnica.", "INTEGRITY");
    }

    const entryId = request.nextUrl.searchParams.get("entryId");
    if (!entryId) {
      return jsonNoStore({ ok: false, error: "entryId é obrigatório." }, 400);
    }
    const deleted = await deleteSiteDiaryEntry(projectId, entryId);
    return jsonNoStore({ ok: true, deleted });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao remover registro do Diário de Obra.");
  }
}
