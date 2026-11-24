import { NextResponse } from "next/server";
import { getContractPdfBytes } from "@/server/services/contract-service";
import { DomainError } from "@/server/errors";
import { createRequestContext, logError } from "@/server/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request);
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const archiveParam = url.searchParams.get("archive");
    const archiveInAcervo = archiveParam === "1" || archiveParam === "true";

    const result = await getContractPdfBytes(id, { archiveInAcervo });

    return new NextResponse(Buffer.from(result.pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.pdfBytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Acervo-Archived": result.acervoArchived ? "1" : "0",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Contrato não encontrado.", requestId },
        { status: 404, headers: { "X-Request-Id": requestId } },
      );
    }
    logError("contract_pdf_failed", error, { requestId });
    return NextResponse.json(
      { error: "Não foi possível gerar o PDF do contrato.", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}
