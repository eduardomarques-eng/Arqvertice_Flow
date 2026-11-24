import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { detectOutdatedAcervoSources } from "@/server/eap/reconciler";

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
        sourceFiles: { orderBy: { createdAt: "desc" } },
      },
    });

    // Leitura SOMENTE LEITURA dos PDFs do Acervo Manager da obra
    const acervoDocs = await prisma.acervoDocument.findMany({
      where: { projectId, isArchived: false },
      orderBy: [{ discipline: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        discipline: true,
        revisions: {
          where: { isCurrent: true },
          take: 1,
          select: {
            id: true,
            revisionNumber: true,
            fileName: true,
            fileUrl: true,
            fileKey: true,
            fileType: true,
            createdAt: true,
          },
        },
      },
    });

    const acervoPdfs = acervoDocs
      .map((doc) => {
        const rev = doc.revisions[0];
        if (!rev) return null;
        const isPdf = rev.fileType === "PDF" || rev.fileName.toLowerCase().endsWith(".pdf");
        if (!isPdf) return null;
        return {
          acervoDocumentId: doc.id,
          code: doc.code,
          title: doc.title,
          discipline: String(doc.discipline),
          revisionNumber: rev.revisionNumber,
          fileName: rev.fileName,
          fileUrl: rev.fileUrl,
          fileKey: rev.fileKey,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    let sources = eap?.sourceFiles ?? [];
    if (eap && sources.length > 0) {
      const outdated = detectOutdatedAcervoSources(
        sources.map((s) => ({
          id: s.id,
          acervoDocumentId: s.acervoDocumentId,
          revisionLabel: s.revisionLabel,
        })),
        acervoPdfs.map((d) => ({
          id: d.acervoDocumentId,
          latestRevisionNumber: d.revisionNumber,
        }))
      );

      if (outdated.length > 0) {
        const outdatedIds = outdated.map((o) => o.sourceFileId);
        await prisma.eapSourceFile.updateMany({
          where: { id: { in: outdatedIds } },
          data: { status: "DESATUALIZADO_NO_ACERVO" },
        });
        sources = sources.map((s) =>
          outdatedIds.includes(s.id) ? { ...s, status: "DESATUALIZADO_NO_ACERVO" } : s
        );
      }
    }

    return NextResponse.json(
      { ok: true, sources, acervoPdfs },
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
    await context.params;
    const sourceFileId = request.nextUrl.searchParams.get("sourceFileId");
    if (!sourceFileId) {
      return NextResponse.json({ ok: false, error: "sourceFileId obrigatório." }, { status: 400 });
    }
    await prisma.eapSourceFile.delete({ where: { id: sourceFileId } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao remover fonte." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
