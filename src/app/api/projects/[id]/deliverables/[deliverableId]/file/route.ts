import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/server/auth";
import { getDeliverableById } from "@/server/services/deliverable-service";
import { getStoredObject } from "@/server/storage";
import { createRequestContext, logError } from "@/server/observability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> },
) {
  const { requestId } = createRequestContext(request);
  try {
    const { id, deliverableId } = await params;
    const user = await requireProjectAccess(id);
    const deliverable = await getDeliverableById(deliverableId);

    if (user.role === "CLIENT" || user.role === "CLIENTE") {
      if (!deliverable.isClientView) {
        return NextResponse.json({ error: "Documento privado do estúdio.", requestId }, { status: 403 });
      }
    }

    let storageKey = deliverable.fileUrl;
    if (storageKey.includes("/deliverables/")) {
      const parts = storageKey.split("/deliverables/");
      if (parts[1]) {
        storageKey = parts[1].replace(/\/file$/, "");
        if (!storageKey.startsWith("deliverables/")) {
          storageKey = `deliverables/${storageKey}`;
        }
      }
    }

    const buffer = await getStoredObject(storageKey);

    // Determina mimeType
    let contentType = "application/pdf";
    const lower = deliverable.sheetCode?.toLowerCase() || deliverable.title.toLowerCase();
    if (lower.endsWith(".png") || storageKey.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || storageKey.endsWith(".jpg")) contentType = "image/jpeg";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${(deliverable.sheetCode || "prancha")}.pdf"`,
        "Cache-Control": "public, max-age=3600",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    logError("deliverable_file_get_failed", error, { requestId });
    return NextResponse.json(
      { error: "Arquivo da prancha não encontrado no storage.", requestId },
      { status: 404 },
    );
  }
}
