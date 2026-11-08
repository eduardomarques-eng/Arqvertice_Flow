import { NextResponse } from "next/server";
import { requireProjectAccess, requireRole } from "@/server/auth";
import {
  deleteProjectDeliverable,
  getDeliverableById,
  updateProjectDeliverable,
} from "@/server/services/deliverable-service";
import { createRequestContext, logError } from "@/server/observability";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> },
) {
  const { requestId } = createRequestContext(request);
  try {
    const { id, deliverableId } = await params;
    await requireProjectAccess(id);
    const deliverable = await getDeliverableById(deliverableId);
    return NextResponse.json({ deliverable, requestId });
  } catch (error) {
    logError("deliverable_get_failed", error, { requestId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prancha não encontrada.", requestId },
      { status: 404 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> },
) {
  const { requestId } = createRequestContext(request);
  try {
    const { id, deliverableId } = await params;
    await requireRole("ADMIN");

    const body = await request.json();
    const updated = await updateProjectDeliverable(deliverableId, {
      folderId: body.folderId,
      environmentId: body.environmentId,
      stageId: body.stageId,
      discipline: body.discipline,
      type: body.type,
      sheetCode: body.sheetCode,
      subject: body.subject,
      title: body.title,
      description: body.description,
      version: body.version,
      status: body.status,
      isClientView: body.isClientView,
      isRequired: body.isRequired,
    });

    return NextResponse.json({ deliverable: updated, success: true, requestId });
  } catch (error) {
    logError("deliverable_patch_failed", error, { requestId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar metadados da prancha.", requestId },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> },
) {
  const { requestId } = createRequestContext(request);
  try {
    const { id, deliverableId } = await params;
    await requireRole("ADMIN");
    await deleteProjectDeliverable(deliverableId);
    return NextResponse.json({ success: true, requestId });
  } catch (error) {
    logError("deliverable_delete_failed", error, { requestId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir prancha.", requestId },
      { status: 400 },
    );
  }
}

