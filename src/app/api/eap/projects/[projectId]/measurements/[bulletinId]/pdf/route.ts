import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { generateAutomaticMeasurementBulletinPdf } from "@/server/eap/field-measurement";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bulletinParamSchema = z.union([z.literal("latest"), uuidParamSchema]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; bulletinId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const bulletinId = bulletinParamSchema.parse(rawParams.bulletinId);

    const generated = await generateAutomaticMeasurementBulletinPdf(
      projectId,
      bulletinId === "latest" ? undefined : bulletinId
    );
    if (!generated) {
      return jsonNoStore({ ok: false, error: "Boletim de medição não encontrado." }, 404);
    }

    const safeSlug = generated.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");

    return new NextResponse(Buffer.from(generated.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="boletim-${generated.bulletinCode}-${safeSlug || "obra"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao exportar PDF do boletim de medição.");
  }
}
