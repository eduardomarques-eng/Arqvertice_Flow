import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { putStoredObject, s3Config } from "@/server/storage";
import { toEvidenceDto } from "@/server/eap/field-measurement";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const metaSchema = z.object({
  rowKey: z.string().trim().min(1).max(160),
  floorId: z.string().trim().min(1).max(60),
  floorName: z.string().trim().min(1).max(120),
  serviceLabel: z.string().trim().min(1).max(260),
  eapItemId: z.string().uuid().nullable().optional(),
  bulletinId: z.string().uuid().nullable().optional(),
  durationSec: z.number().min(0).max(3600).nullable().optional(),
});

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

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

    const rows = await prisma.eapMeasurementEvidence.findMany({
      where: { eapProjectId: eap.id },
      orderBy: { capturedAt: "desc" },
    });

    return jsonNoStore({
      ok: true,
      evidences: rows.map((r) => toEvidenceDto(projectId, r)),
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao listar evidências da medição.");
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

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonNoStore({ ok: false, error: "Arquivo de foto ou vídeo obrigatório." }, 400);
    }

    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(file.name);
    if (!isImage && !isVideo) {
      return jsonNoStore(
        { ok: false, error: "Formato não suportado. Envie uma imagem ou vídeo válido." },
        400
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const maxAllowed = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (bytes.byteLength === 0 || bytes.byteLength > maxAllowed) {
      return jsonNoStore(
        {
          ok: false,
          error: isVideo
            ? "Vídeo excede o limite de 25 MB."
            : "Foto excede o limite de 6 MB após compressão.",
        },
        400
      );
    }

    const rawDuration = formData.get("durationSec");
    const parsedMeta = metaSchema.parse({
      rowKey: String(formData.get("rowKey") || ""),
      floorId: String(formData.get("floorId") || "GERAL"),
      floorName: String(formData.get("floorName") || "Geral"),
      serviceLabel: String(formData.get("serviceLabel") || "Serviço em Campo"),
      eapItemId: formData.get("eapItemId") ? String(formData.get("eapItemId")) : null,
      bulletinId: formData.get("bulletinId") ? String(formData.get("bulletinId")) : null,
      durationSec:
        rawDuration !== null && String(rawDuration).trim() !== "" && Number.isFinite(Number(rawDuration))
          ? Number(rawDuration)
          : null,
    });

    const evidenceId = randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "evidencia";
    const mimeType =
      file.type || (isVideo ? "video/mp4" : "image/jpeg");
    const mediaType: "IMAGE" | "VIDEO" = isVideo ? "VIDEO" : "IMAGE";

    let storageKey = `db://${evidenceId}`;
    let dataBase64: string | null = bytes.toString("base64");

    if (s3Config()) {
      try {
        const key = `eap/${projectId}/measurements/${Date.now()}-${evidenceId}-${safeName}`;
        await putStoredObject(key, bytes, mimeType);
        storageKey = key;
        // Para fotos em R2, não precisamos duplicar em Base64 se couber buscar no R2,
        // mas mantemos nulo para manter o banco enxuto.
        dataBase64 = null;
      } catch {
        // Fallback seguro para banco caso R2 falhe temporariamente
        storageKey = `db://${evidenceId}`;
        dataBase64 = bytes.toString("base64");
      }
    }

    const created = await prisma.eapMeasurementEvidence.create({
      data: {
        id: evidenceId,
        eapProjectId: eap.id,
        bulletinId: parsedMeta.bulletinId ?? null,
        rowKey: parsedMeta.rowKey,
        floorId: parsedMeta.floorId,
        floorName: parsedMeta.floorName,
        eapItemId: parsedMeta.eapItemId ?? null,
        serviceLabel: parsedMeta.serviceLabel,
        mediaType,
        fileName: safeName,
        mimeType,
        sizeBytes: bytes.byteLength,
        storageKey,
        dataBase64,
        durationSec: parsedMeta.durationSec ?? null,
      },
    });

    return jsonNoStore(
      { ok: true, evidence: toEvidenceDto(projectId, created) },
      201
    );
  } catch (err) {
    return handleEapRouteError(err, "Erro ao enviar evidência da medição.");
  }
}
