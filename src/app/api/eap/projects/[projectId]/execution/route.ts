import { NextRequest, NextResponse } from "next/server";
import { isClientRole, requireProjectAccess } from "@/server/auth";
import {
  buildProgressEvolutionPayload,
  loadExecutionDashboardFromDb,
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
        { ok: false, error: "EAP ainda não inicializada para este projeto." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (clientUser && !dashboard.meta.isPublishedToClient) {
      return NextResponse.json(
        { ok: false, error: "Acompanhamento de obra ainda não publicado para o cliente." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const safeDashboard = buildProgressEvolutionPayload(
      dashboard,
      clientUser ? "CLIENT" : "INTERNAL"
    );

    return NextResponse.json(
      { ok: true, dashboard: safeDashboard },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao carregar execução." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
}
