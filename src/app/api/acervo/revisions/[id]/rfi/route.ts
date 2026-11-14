import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { AcervoRfiStatus, AcervoMarkupType } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: revisionId } = await params;

    const rfis = await prisma.acervoRfiMarkup.findMany({
      where: { revisionId },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, rfis });
  } catch (err: unknown) {
    console.error("[ACERVO_RFI_GET_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao carregar RFIs da revisão." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: revisionId } = await params;
    const body = await request.json();
    const {
      title,
      description,
      markupType = "PIN",
      pageNumber = 1,
      coordX,
      coordY,
      cameraState,
      geometryJson,
      assignedToId,
    } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Título e descrição da RFI são obrigatórios." },
        { status: 400 }
      );
    }

    const revision = await prisma.acervoRevision.findUniqueOrThrow({
      where: { id: revisionId },
      select: { documentId: true },
    });

    const count = await prisma.acervoRfiMarkup.count({
      where: { documentId: revision.documentId },
    });
    const code = `RFI-${(count + 1).toString().padStart(3, "0")}`;

    const rfi = await prisma.acervoRfiMarkup.create({
      data: {
        code,
        documentId: revision.documentId,
        revisionId,
        title,
        description,
        status: AcervoRfiStatus.ABERTA,
        markupType: markupType as AcervoMarkupType,
        pageNumber,
        coordX,
        coordY,
        cameraState,
        geometryJson,
        createdById: user.id,
        assignedToId,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ success: true, rfi });
  } catch (err: unknown) {
    console.error("[ACERVO_RFI_POST_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao registrar RFI na prancha." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { rfiId, status, answer } = body;

    if (!rfiId) {
      return NextResponse.json({ error: "rfiId é obrigatório" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status && Object.values(AcervoRfiStatus).includes(status)) {
      updateData.status = status;
    }
    if (answer) {
      updateData.answer = answer;
      updateData.answeredAt = new Date();
      if (!status) updateData.status = AcervoRfiStatus.RESPONDIDA;
    }

    const updated = await prisma.acervoRfiMarkup.update({
      where: { id: rfiId },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ success: true, rfi: updated });
  } catch (err: unknown) {
    console.error("[ACERVO_RFI_PATCH_ERROR]", err);
    return NextResponse.json(
      { error: "Falha ao atualizar status da RFI." },
      { status: 500 }
    );
  }
}
