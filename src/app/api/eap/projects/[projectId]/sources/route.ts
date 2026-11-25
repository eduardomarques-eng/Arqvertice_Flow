import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSourceSchema = z.object({
  sourceFileId: z.string().uuid(),
  includedInMining: z.boolean().optional(),
  sourceSoftware: z.enum(["TQS", "REVIT", "MANUAL"]).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      include: {
        sourceFiles: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            eapProjectId: true,
            acervoDocumentId: true,
            fileName: true,
            storageKey: true,
            url: true,
            sourceSoftware: true,
            discipline: true,
            revisionLabel: true,
            versionCode: true,
            versionNumber: true,
            isActive: true,
            revisionNote: true,
            supersedesId: true,
            includedInMining: true,
            status: true,
            extractedSummaryJson: true,
            processedAt: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(
      { ok: true, sources: eap?.sourceFiles ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao listar fontes." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const body = await request.json();
    const parsed = patchSourceSchema.parse(body);

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    const updated = await prisma.eapSourceFile.update({
      where: { id: parsed.sourceFileId },
      data: {
        ...(parsed.includedInMining !== undefined ? { includedInMining: parsed.includedInMining } : {}),
        ...(parsed.sourceSoftware !== undefined ? { sourceSoftware: parsed.sourceSoftware } : {}),
      },
    });

    return NextResponse.json({ ok: true, source: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar fonte." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { projectId } = await context.params;
    const sourceFileId = request.nextUrl.searchParams.get("sourceFileId");
    if (!sourceFileId) {
      return NextResponse.json({ ok: false, error: "sourceFileId obrigatório." }, { status: 400 });
    }

    const eap = await prisma.eapProject.findUnique({
      where: { projectId },
      select: { id: true },
    });
    if (!eap) {
      return NextResponse.json({ ok: false, error: "EAP não encontrada." }, { status: 404 });
    }

    const deleted = await prisma.eapSourceFile.deleteMany({
      where: { id: sourceFileId, eapProjectId: eap.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ ok: false, error: "Arquivo não encontrado nesta EAP." }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao remover fonte." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
