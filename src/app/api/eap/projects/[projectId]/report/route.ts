import { NextRequest } from "next/server";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { DomainError } from "@/server/errors";
import {
  loadExecutiveReportFromDb,
  type ReportAudience,
} from "@/server/eap/executive-report";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await currentUser();
    if (!caller) {
      throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
    }
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    const user = await requireProjectAccess(projectId);
    const clientUser = isClientRole(user.role);

    const requestedAudience = (request.nextUrl.searchParams.get("audience") || "CLIENT").toUpperCase();
    const audience: ReportAudience =
      !clientUser && user.role === "ADMIN" && requestedAudience === "INTERNAL"
        ? "INTERNAL"
        : "CLIENT";

    const report = await loadExecutiveReportFromDb(projectId, audience);
    if (!report) {
      return jsonNoStore(
        { ok: false, error: "Relatório EAP ainda não disponível para este projeto." },
        404
      );
    }

    if (clientUser && !report.meta.isPublishedToClient) {
      return jsonNoStore(
        { ok: false, error: "O relatório executivo da EAP ainda não foi publicado para o cliente." },
        403
      );
    }

    return jsonNoStore({ ok: true, report });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao carregar relatório executivo.");
  }
}
