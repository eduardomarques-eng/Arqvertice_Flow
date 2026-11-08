import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/server/auth";
import { putStoredObject } from "@/server/storage";
import { catalogUploadedDeliverables, type CatalogUploadedDeliverableItem } from "@/server/actions/deliverables";
import { createRequestContext, logError } from "@/server/observability";
import type {
  ProjectDiscipline,
  ProjectStagePhase,
  AcervoCategory,
  DeliverableType,
  ApprovalStatus,
} from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requestId } = createRequestContext(request);
  try {
    const { id: projectId } = await params;
    await requireRole("ADMIN");

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const metadataRaw = formData.get("metadata") ? String(formData.get("metadata")) : "[]";
    const metadataList: Array<Partial<CatalogUploadedDeliverableItem>> = JSON.parse(metadataRaw);

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado para catalogação.", requestId },
        { status: 400 },
      );
    }

    const itemsToCatalog: CatalogUploadedDeliverableItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadataList[i] || {};

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storageKey = `deliverables/${projectId}/${randomUUID()}-${safeName}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      await putStoredObject(storageKey, bytes, file.type || "application/pdf");

      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      const fileSize = file.size > 1024 * 1024 ? `${sizeInMB} MB` : `${Math.round(file.size / 1024)} KB`;

      const sheetCode = meta.sheetCode || safeName.replace(/\.[^/.]+$/, "");
      const subject = meta.subject || "Plantas Baixas e Layout";
      const title = meta.title || `${sheetCode} - ${subject}`;

      itemsToCatalog.push({
        projectId,
        sheetCode,
        title,
        subtitle: meta.subtitle || null,
        subject,
        discipline: (meta.discipline || "ARQUITETURA") as ProjectDiscipline,
        phaseFolder: (meta.phaseFolder || "PROJETO_EXECUTIVO") as ProjectStagePhase,
        category: (meta.category || "PLANTA_TECNICA_PDF") as AcervoCategory,
        type: (meta.type || "PRANCHA_EXECUTIVA") as DeliverableType,
        version: meta.version || "R00",
        description: meta.description || null,
        stageId: meta.stageId || null,
        environmentId: meta.environmentId || null,
        folderId: meta.folderId || null,
        fileUrl: storageKey,
        fileSize,
        thumbnailUrl: null,
        isClientView: meta.isClientView ?? true,
        isRequired: meta.isRequired ?? true,
        status: (meta.status || "APROVADO_INTERNO") as ApprovalStatus,
      });
    }

    const result = await catalogUploadedDeliverables(itemsToCatalog);

    return NextResponse.json(
      { success: true, count: result.count, deliverables: result.deliverables, requestId },
      { status: 201 },
    );
  } catch (error) {
    logError("batch_deliverables_post_failed", error, { requestId });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao catalogar pranchas em lote.",
        requestId,
      },
      { status: 400 },
    );
  }
}

