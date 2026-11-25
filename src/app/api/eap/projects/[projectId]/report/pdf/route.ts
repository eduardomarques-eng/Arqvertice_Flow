import { NextRequest, NextResponse } from "next/server";
import { currentUser, isClientRole, requireProjectAccess } from "@/server/auth";
import { DomainError } from "@/server/errors";
import {
  loadExecutiveReportFromDb,
  renderExecutiveReportPdf,
  type ExecutiveParametricOverrides,
  type ExecutiveStandardLevel,
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

    const sp = request.nextUrl.searchParams;
    const rawStd = (sp.get("standard") || "").toUpperCase();
    const standardLevel: ExecutiveStandardLevel | undefined =
      rawStd === "ECONOMICO" || rawStd === "MEDIO" || rawStd === "ALTO"
        ? (rawStd as ExecutiveStandardLevel)
        : undefined;
    const areaM2 = Number(sp.get("areaM2"));
    const bdi = Number(sp.get("bdi"));
    const months = Number(sp.get("months"));
    const overrides: ExecutiveParametricOverrides | undefined =
      !clientUser &&
      (standardLevel ||
        (Number.isFinite(areaM2) && areaM2 > 0) ||
        (sp.has("bdi") && Number.isFinite(bdi) && bdi >= 0) ||
        (Number.isFinite(months) && months > 0))
        ? {
            ...(Number.isFinite(areaM2) && areaM2 > 0 ? { builtAreaM2: areaM2 } : {}),
            ...(standardLevel ? { standardLevel } : {}),
            ...(sp.has("bdi") && Number.isFinite(bdi) && bdi >= 0 ? { bdiPercent: bdi } : {}),
            ...(Number.isFinite(months) && months > 0 ? { durationMonths: months } : {}),
          }
        : undefined;

    const report = await loadExecutiveReportFromDb(projectId, audience, overrides);
    if (!report) {
      return jsonNoStore({ ok: false, error: "Relatório EAP não encontrado." }, 404);
    }

    if (clientUser && !report.meta.isPublishedToClient) {
      return jsonNoStore(
        { ok: false, error: "Relatório ainda não publicado para o cliente." },
        403
      );
    }

    const pdfBytes = renderExecutiveReportPdf(report);
    const slug = report.meta.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="EAP-Executivo-${slug || "obra"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao exportar PDF executivo.");
  }
}
