import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { readRawBufferFromSource } from "@/server/eap/pdf-reader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId, sourceId } = await context.params;

    const source = await prisma.eapSourceFile.findFirst({
      where: {
        id: sourceId,
        eapProject: { projectId },
      },
      select: {
        id: true,
        fileName: true,
        storageKey: true,
        url: true,
      },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Arquivo não encontrado na EAP." }, { status: 404 });
    }

    const bytes = await readRawBufferFromSource({
      storageKey: source.storageKey || null,
      url: source.url || null,
    });

    const lowerName = source.fileName.toLowerCase();
    const isHtml =
      lowerName.endsWith(".html") ||
      lowerName.endsWith(".htm") ||
      bytes.subarray(0, 512).toString("utf8").trim().toLowerCase().includes("<html");

    const safeFileName = source.fileName.replace(/["\r\n]/g, "_");
    const headers: Record<string, string> = {
      "Content-Type": isHtml ? "text/html; charset=utf-8" : "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };

    if (isHtml) {
      // Isola HTML do TQS/Revit em sandbox para pré-visualização segura sem execução de scripts
      headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline';";
    }

    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao abrir arquivo da EAP." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
