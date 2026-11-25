import { NextRequest, NextResponse } from "next/server";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { DomainError } from "@/server/errors";
import {
  loadEapCostReportFromDb,
  renderEapCostReportPdf,
} from "@/server/eap/eap-cost-report";
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
        "Acesso ao PDF analítico de custos da EAP restrito à equipe técnica.",
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

    const pdfBytes = renderEapCostReportPdf(report);
    const slug = report.meta.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="EAP-Custos-${slug || "obra"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao exportar PDF de custos da EAP.");
  }
}
