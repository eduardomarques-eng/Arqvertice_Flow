import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { getStoredObject } from "@/server/storage";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; evidenceId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const evidenceId = uuidParamSchema.parse(rawParams.evidenceId);

    const evidence = await prisma.eapMeasurementEvidence.findFirst({
      where: {
        id: evidenceId,
        eapProject: { projectId },
      },
    });

    if (!evidence) {
      return jsonNoStore({ ok: false, error: "Evidência não encontrada." }, 404);
    }

    let bytes: Buffer;
    if (evidence.dataBase64) {
      bytes = Buffer.from(evidence.dataBase64, "base64");
    } else if (!evidence.storageKey.startsWith("db://")) {
      bytes = await getStoredObject(evidence.storageKey);
    } else {
      return jsonNoStore({ ok: false, error: "Conteúdo de mídia indisponível." }, 404);
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": evidence.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${evidence.fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao carregar mídia da medição.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; evidenceId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const evidenceId = uuidParamSchema.parse(rawParams.evidenceId);

    const existing = await prisma.eapMeasurementEvidence.findFirst({
      where: {
        id: evidenceId,
        eapProject: { projectId },
      },
      select: { id: true },
    });
    if (!existing) {
      return jsonNoStore({ ok: false, error: "Evidência não encontrada." }, 404);
    }

    await prisma.eapMeasurementEvidence.delete({ where: { id: existing.id } });
    return jsonNoStore({ ok: true });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao remover evidência da medição.");
  }
}
