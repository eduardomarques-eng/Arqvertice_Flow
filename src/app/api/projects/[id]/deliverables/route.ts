import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { putStoredObject } from "@/server/storage";
import {
  createProjectDeliverable,
  getDeliverableMatrix,
  listProjectDeliverables,
} from "@/server/services/deliverable-service";
import { createRequestContext, logError } from "@/server/observability";
import type { ApprovalStatus, DeliverableType, ProjectDiscipline } from "@prisma/client";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request);
  try {
    const { id } = await params;
    const user = await requireProjectAccess(id);
    const clientVisibleOnly = user.role === "CLIENT" || user.role === "CLIENTE";

    const [deliverables, matrix] = await Promise.all([
      listProjectDeliverables(id, clientVisibleOnly),
      getDeliverableMatrix(id, clientVisibleOnly),
    ]);

    return NextResponse.json({ deliverables, matrix, requestId });
  } catch (error) {
    logError("deliverables_get_failed", error, { requestId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar pranchas.", requestId },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request);
  try {
    const { id: projectId } = await params;
    await requireRole("ADMIN");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "Arquivo obrigatório para envio.", requestId }, { status: 400 });
    }

    const sheetCode = String(formData.get("sheetCode") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || `${sheetCode} - ${subject}`).trim();
    const discipline = (formData.get("discipline") || "ARQUITETURA") as ProjectDiscipline;
    const type = (formData.get("type") || "PRANCHA_EXECUTIVA") as DeliverableType;
    const version = String(formData.get("version") || "R00").trim();
    const stageId = formData.get("stageId") ? String(formData.get("stageId")) : null;
    const environmentId = formData.get("environmentId") ? String(formData.get("environmentId")) : null;
    const description = formData.get("description") ? String(formData.get("description")) : null;
    const status = (formData.get("status") || "EM_ELABORACAO") as ApprovalStatus;
    const isClientView = formData.get("isClientView") === "true";
    const isRequired = formData.get("isRequired") !== "false";

    if (!sheetCode || !subject) {
      return NextResponse.json({ error: "Código da prancha e assunto são obrigatórios.", requestId }, { status: 400 });
    }

    // Gravação no Storage oficial
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `deliverables/${projectId}/${randomUUID()}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await putStoredObject(storageKey, bytes, file.type || "application/pdf");

    // Cálculo amigável do tamanho do arquivo
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const fileSize = file.size > 1024 * 1024 ? `${sizeInMB} MB` : `${Math.round(file.size / 1024)} KB`;

    // Criação do Registro
    const deliverable = await createProjectDeliverable({
      projectId,
      folderId: null,
      environmentId,
      stageId,
      discipline,
      type,
      sheetCode,
      subject,
      title,
      description,
      fileUrl: storageKey,
      thumbnailUrl: null,
      version,
      fileSize,
      status,
      isClientView,
      isRequired,
    });

    return NextResponse.json({ deliverable, success: true, requestId }, { status: 201 });
  } catch (error) {
    logError("deliverables_post_failed", error, { requestId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao cadastrar prancha.", requestId },
      { status: 400 },
    );
  }
}
