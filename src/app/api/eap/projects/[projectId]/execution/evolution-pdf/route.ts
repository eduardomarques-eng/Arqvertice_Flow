import { NextRequest, NextResponse } from "next/server";
import { isClientRole, requireProjectAccess } from "@/server/auth";
import {
  loadExecutionDashboardFromDb,
  renderProgressEvolutionPdf,
} from "@/server/eap/execution-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const user = await requireProjectAccess(projectId);
    const clientUser = isClientRole(user.role);

    const dashboard = await loadExecutionDashboardFromDb(projectId);
    if (!dashboard) {
      return NextResponse.json(
        { ok: false, error: "EAP não encontrada para este projeto." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (clientUser && !dashboard.meta.isPublishedToClient) {
      return NextResponse.json(
        { ok: false, error: "O boletim de evolução ainda não foi publicado para o cliente." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const pdfBytes = renderProgressEvolutionPdf(
      dashboard,
      clientUser ? "CLIENT" : "INTERNAL"
    );

    const safeSlug = dashboard.meta.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="boletim-evolucao-${safeSlug || "obra"}-${dashboard.meta.activeBaselineLabel}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao gerar PDF de evolução." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}
