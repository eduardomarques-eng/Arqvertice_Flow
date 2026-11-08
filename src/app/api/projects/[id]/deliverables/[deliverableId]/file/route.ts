import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/server/auth";
import { getDeliverableById } from "@/server/services/deliverable-service";
import { getStoredObject } from "@/server/storage";
import { createRequestContext, logError } from "@/server/observability";
import { logDeliverableAccess } from "@/server/actions/deliverables";

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

    const url = new URL(request.url);
    const isDownload = url.searchParams.get("download") === "1" || url.searchParams.get("download") === "true";

    // Registrar log de auditoria de forma assíncrona e resiliente
    void logDeliverableAccess({
      projectId: id,
      deliverableId: deliverable.id,
      userId: user.id,
      userName: user.name || user.email || "Usuário",
      userRole: user.role,
      action: isDownload ? "DOWNLOAD" : "VIEW",
      sheetTitle: deliverable.subtitle ? `${deliverable.title} - ${deliverable.subtitle}` : deliverable.title,
    }).catch((err) => {
      console.warn("Falha não bloqueante ao registrar log de acesso da prancha:", err);
    });

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

    // Determina mimeType e extensão
    let contentType = "application/pdf";
    let extension = "pdf";
    const lower = (deliverable.sheetCode?.toLowerCase() || "") + (deliverable.title.toLowerCase() || "");
    if (lower.endsWith(".png") || storageKey.endsWith(".png")) {
      contentType = "image/png";
      extension = "png";
    } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || storageKey.endsWith(".jpg")) {
      contentType = "image/jpeg";
      extension = "jpg";
    } else if (lower.endsWith(".webp") || storageKey.endsWith(".webp")) {
      contentType = "image/webp";
      extension = "webp";
    }

    const baseName = deliverable.sheetCode
      ? `${deliverable.sheetCode}_${deliverable.title}`.replace(/[^a-zA-Z0-9_-]/g, "_")
      : deliverable.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${baseName}.${extension}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
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
