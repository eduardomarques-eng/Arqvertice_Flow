import { NextRequest, NextResponse } from "next/server";
import { isClientRole, requireProjectAccess } from "@/server/auth";
import {
  loadExecutiveReportFromDb,
  type ReportAudience,
} from "@/server/eap/executive-report";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const user = await requireProjectAccess(projectId);
    const clientUser = isClientRole(user.role);

    const requestedAudience = (request.nextUrl.searchParams.get("audience") || "CLIENT").toUpperCase();
    const audience: ReportAudience =
      !clientUser && user.role === "ADMIN" && requestedAudience === "INTERNAL"
        ? "INTERNAL"
        : "CLIENT";

    const report = await loadExecutiveReportFromDb(projectId, audience);
    if (!report) {
      return NextResponse.json(
        { ok: false, error: "Relatório EAP ainda não disponível para este projeto." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (clientUser && !report.meta.isPublishedToClient) {
      return NextResponse.json(
        { ok: false, error: "O relatório executivo da EAP ainda não foi publicado para o cliente." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, report },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao carregar relatório." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}
