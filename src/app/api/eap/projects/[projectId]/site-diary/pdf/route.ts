import { NextRequest, NextResponse } from "next/server";
import { currentUser, requireProjectAccess } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { handleEapRouteError, uuidParamSchema } from "@/server/eap/route-error";
import { renderSiteDiaryPdfBuffer } from "@/server/eap/site-diary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await currentUser();
    if (!caller) throw new DomainError("É necessário entrar para continuar.", "NOT_FOUND");
    const rawParams = await context.params;
    const projectId = uuidParamSchema.parse(rawParams.projectId);
    await requireProjectAccess(projectId);

    const pdfBuf = await renderSiteDiaryPdfBuffer(projectId);
    return new NextResponse(new Uint8Array(pdfBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="diario-de-obra.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleEapRouteError(err, "Erro ao gerar PDF do Diário de Obra.");
  }
}
