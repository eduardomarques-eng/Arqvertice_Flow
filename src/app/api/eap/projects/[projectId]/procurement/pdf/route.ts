import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { buildProcurementPdfBuffer } from "@/server/eap/procurement-plan";
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
    const buffer = await buildProcurementPdfBuffer(projectId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="plano-aquisicoes-${projectId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao gerar PDF do plano de aquisições.");
  }
}
