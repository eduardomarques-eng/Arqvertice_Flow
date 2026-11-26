import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import {
  generateProcurementPlanForProject,
  getProcurementPlanForProject,
} from "@/server/eap/procurement-plan";
import { handleEapRouteError } from "@/server/eap/route-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const plan = await getProcurementPlanForProject(projectId);
    return NextResponse.json(
      { ok: true, ...plan },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleEapRouteError(err, "Erro ao carregar plano de aquisições.");
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const plan = await generateProcurementPlanForProject(projectId);
    return NextResponse.json(
      { ok: true, ...plan },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleEapRouteError(err, "Erro ao gerar plano de aquisições.");
  }
}
