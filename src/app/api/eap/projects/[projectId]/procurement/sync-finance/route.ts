import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { syncProcurementToFinance } from "@/server/eap/procurement-plan";
import { handleEapRouteError } from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const result = await syncProcurementToFinance(projectId);
    return NextResponse.json(
      {
        ok: true,
        syncedCount: result.syncedCount,
        totalCommittedFinance: result.totalCommittedFinance,
        ...result.plan,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleEapRouteError(err, "Erro ao sincronizar aquisições com o Financeiro.");
  }
}
