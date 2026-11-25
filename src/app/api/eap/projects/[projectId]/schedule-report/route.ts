import { NextRequest } from "next/server";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { loadEapScheduleReportFromDb } from "@/server/eap/eap-schedule-report";
import {
  handleEapRouteError,
  jsonNoStore,
  uuidParamSchema,
} from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
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
    if (isClientRole(user.role)) {
      throw new DomainError(
        "Acesso ao relatório analítico de planejamento restrito à equipe técnica.",
        "INTEGRITY"
      );
    }

    const report = await loadEapScheduleReportFromDb(projectId);
    if (!report) {
      return jsonNoStore(
        { ok: false, error: "Planejamento LOB não encontrado para este projeto." },
        404
      );
    }

    return jsonNoStore({ ok: true, report });
  } catch (err) {
    return handleEapRouteError(
      err,
      "Erro ao carregar Relatório de Planejamento & Cronograma."
    );
  }
}
