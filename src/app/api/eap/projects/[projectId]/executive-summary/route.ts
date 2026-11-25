import { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { buildComparativeProjectAnalytics } from "@/server/eap/executive-analytics-ai";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);

    const analytics = await buildComparativeProjectAnalytics(projectId, {
      allowExternalLlm: true,
    });
    if (!analytics) {
      return jsonNoStore({ ok: false, error: "Projeto EAP não encontrado." }, 404);
    }

    return jsonNoStore({ ok: true, analytics });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao atualizar análise executiva de desvios.");
  }
}
