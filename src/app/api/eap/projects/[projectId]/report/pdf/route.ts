import { NextRequest, NextResponse } from "next/server";
import { isClientRole, requireProjectAccess } from "@/server/auth";
import {
  loadExecutiveReportFromDb,
  renderExecutiveReportPdf,
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
        { ok: false, error: "Relatório EAP não encontrado." },
        { status: 404 }
      );
    }

    if (clientUser && !report.meta.isPublishedToClient) {
      return NextResponse.json(
        { ok: false, error: "Relatório ainda não publicado para o cliente." },
        { status: 403 }
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
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao exportar PDF." },
      { status: 401 }
    );
  }
}
