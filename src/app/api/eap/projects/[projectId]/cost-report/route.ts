import { NextRequest } from "next/server";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { loadEapCostReportFromDb } from "@/server/eap/eap-cost-report";
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
        "Acesso ao relatório analítico de custos da EAP restrito à equipe técnica.",
        "INTEGRITY"
      );
    }

    const report = await loadEapCostReportFromDb(projectId);
    if (!report) {
      return jsonNoStore(
        { ok: false, error: "Planilha EAP não encontrada para este projeto." },
        404
      );
    }

    return jsonNoStore({ ok: true, report });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao gerar relatório de custos da EAP.");
  }
}
